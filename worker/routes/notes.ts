import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { API_ERROR_CODES } from '../utils/constants';
import {
  NOTES_INDEX_KEY,
  NOTE_KEY_PREFIX,
  noteContentKey,
  NOTE_ID_RE,
  buildNotePreview,
} from '../../shared/constants';

// 单篇正文 / 索引的最大字节数，与 /api/data 的单键上限保持一致
const MAX_CONTENT_SIZE = 1024 * 1024;
const MAX_INDEX_SIZE = 1024 * 1024;

// 迁移前旧版把整个笔记数组存在这个键里
const LEGACY_NOTES_KEY = 'notes';

// 分片写入 / 删除的并发批大小
const WRITE_BATCH = 20;

// 清空分片时最多翻页轮数（KV list 每页最多 1000 个 key）
const MAX_LIST_ROUNDS = 50;

/** 索引中单条笔记的元数据（不含正文，正文单独存 note:{id}） */
interface NoteIndexItem {
  id: string;
  preview: string;
  [field: string]: unknown;
}

interface NoteIndex {
  v: number;
  items: NoteIndexItem[];
}

const emptyIndex = (): NoteIndex => ({ v: 1, items: [] });

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

/** 校验并规范化单条索引元数据：id 必须合法，索引绝不携带正文 */
function sanitizeItem(raw: unknown): NoteIndexItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const id = typeof src.id === 'string' ? src.id : '';
  if (!NOTE_ID_RE.test(id)) return null;

  const item: NoteIndexItem = { ...src, id, preview: '' };
  delete item.content;
  item.preview =
    typeof src.preview === 'string'
      ? buildNotePreview(src.preview)
      : typeof src.content === 'string'
        ? buildNotePreview(src.content)
        : '';
  return item;
}

function sanitizeItems(raw: unknown): NoteIndexItem[] {
  if (!Array.isArray(raw)) return [];
  const items: NoteIndexItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const item = sanitizeItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

/** 读取索引原始值；不存在返回 null，解析失败抛错 */
async function readIndex(env: Env): Promise<NoteIndex | null> {
  const raw = await env.USER_DATA.get(NOTES_INDEX_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as NoteIndex;
  return { v: 1, items: sanitizeItems(parsed?.items) };
}

/** 写入索引（含大小上限校验），并保留数组顺序 */
async function writeIndex(env: Env, items: NoteIndexItem[]): Promise<void> {
  const payload = JSON.stringify({ v: 1, items });
  if (byteLength(payload) > MAX_INDEX_SIZE) {
    throw new Error(API_ERROR_CODES.DATA_TOO_LARGE);
  }
  await env.USER_DATA.put(NOTES_INDEX_KEY, payload);
}

/** 批量写入正文分片 */
async function writeShards(env: Env, entries: Array<{ id: string; content: string }>): Promise<void> {
  for (let i = 0; i < entries.length; i += WRITE_BATCH) {
    const batch = entries.slice(i, i + WRITE_BATCH);
    await Promise.all(
      batch.map(({ id, content }) =>
        env.USER_DATA.put(noteContentKey(id), JSON.stringify({ v: 1, id, content }))
      )
    );
  }
}

/**
 * 一次性迁移旧版的整包 notes 键：拆成「每篇一个分片 + 一份索引」，最后删除旧键。
 * 写入顺序保证「索引存在 ⇒ 分片齐全」；任一步失败即抛错，不写索引也不删旧键，下次重试。
 */
async function migrateLegacyNotes(env: Env): Promise<NoteIndex | null> {
  const raw = await env.USER_DATA.get(LEGACY_NOTES_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn('[notes] Legacy notes value is not valid JSON, skip migration');
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const shards: Array<{ id: string; content: string }> = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const src = entry as Record<string, unknown>;
    if (typeof src.id !== 'string' || !NOTE_ID_RE.test(src.id)) continue;
    shards.push({ id: src.id, content: typeof src.content === 'string' ? src.content : '' });
  }

  const index: NoteIndex = { v: 1, items: sanitizeItems(parsed) };
  await writeShards(env, shards);
  await writeIndex(env, index.items);
  await env.USER_DATA.delete(LEGACY_NOTES_KEY);
  return index;
}

/**
 * 读取索引；索引缺失时尝试从旧版整包 notes 键迁移。
 * 由 /api/notes 与 /api/data（key=notes）共用，保证两条读路径都能触发迁移。
 */
export async function loadNoteIndex(env: Env): Promise<NoteIndex> {
  const existing = await readIndex(env);
  if (existing) return existing;
  const migrated = await migrateLegacyNotes(env);
  return migrated ?? emptyIndex();
}

/** 用整包笔记（含正文）覆盖式写成分片 + 索引，供旧版兼容写入路径复用 */
export async function writeNotesAsShards(env: Env, rawNotes: unknown): Promise<void> {
  const items = sanitizeItems(rawNotes);
  const sources = Array.isArray(rawNotes) ? rawNotes : [];
  const shards: Array<{ id: string; content: string }> = [];
  for (const entry of sources) {
    if (!entry || typeof entry !== 'object') continue;
    const src = entry as Record<string, unknown>;
    if (typeof src.id !== 'string' || !NOTE_ID_RE.test(src.id)) continue;
    shards.push({ id: src.id, content: typeof src.content === 'string' ? src.content : '' });
  }
  await writeShards(env, shards);
  await writeIndex(env, items);
}

/** 清空全部笔记：先删索引（立即不可达），再按前缀分批删除分片 */
export async function clearAllNotes(env: Env): Promise<void> {
  await env.USER_DATA.delete(NOTES_INDEX_KEY);
  // 旧版整包键一并删除，避免索引被清空后又从旧数据里「复活」
  await env.USER_DATA.delete(LEGACY_NOTES_KEY);

  let cursor: string | null = null;
  for (let round = 0; round < MAX_LIST_ROUNDS; round++) {
    const listed: KVNamespaceListResult<unknown, string> = await env.USER_DATA.list({
      prefix: NOTE_KEY_PREFIX,
      cursor,
    });
    if (listed.keys.length > 0) {
      await Promise.all(listed.keys.map((key) => env.USER_DATA.delete(key.name)));
    }
    if (listed.list_complete) return;
    cursor = listed.cursor;
  }
  console.warn('[notes] Aborted shard cleanup after reaching the pagination limit');
}

/** 读取单篇正文，不存在返回 undefined */
async function readContent(env: Env, id: string): Promise<string | undefined> {
  const raw = await env.USER_DATA.get(noteContentKey(id));
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { content?: unknown };
    return typeof parsed.content === 'string' ? parsed.content : undefined;
  } catch {
    console.warn(`[notes] Failed to parse content shard: ${id}`);
    return undefined;
  }
}

/** 按 id 从索引中移除；索引不存在或未命中时返回 false */
async function removeFromIndex(env: Env, id: string): Promise<boolean> {
  const index = await loadNoteIndex(env);
  const next = index.items.filter((item) => item.id !== id);
  if (next.length === index.items.length) return false;
  await writeIndex(env, next);
  return true;
}

/** 从 /api/notes 或 /api/notes/{id} 中取出 id */
function extractNoteId(url: URL): string | null {
  const rest = url.pathname.slice('/api/notes'.length);
  if (!rest.startsWith('/')) return null;
  const id = decodeURIComponent(rest.slice(1));
  return id.length > 0 ? id : null;
}

async function handleGet(url: URL, env: Env): Promise<Response> {
  const id = extractNoteId(url);

  if (!id) {
    const index = await loadNoteIndex(env);
    return Response.json({ items: index.items });
  }

  if (!NOTE_ID_RE.test(id)) {
    return Response.json({ error: API_ERROR_CODES.INVALID_NOTE_ID }, { status: 400 });
  }
  const content = await readContent(env, id);
  if (content === undefined) {
    return Response.json({ error: API_ERROR_CODES.NOTE_NOT_FOUND }, { status: 404 });
  }
  return Response.json({ id, content });
}

async function handlePost(request: Request, url: URL, env: Env): Promise<Response> {
  const id = extractNoteId(url);
  if (!id || !NOTE_ID_RE.test(id)) {
    return Response.json({ error: API_ERROR_CODES.INVALID_NOTE_ID }, { status: 400 });
  }

  let body: { meta?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { meta?: unknown; content?: unknown };
  } catch {
    return Response.json({ error: API_ERROR_CODES.INVALID_JSON }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content : '';
  if (byteLength(content) > MAX_CONTENT_SIZE) {
    return Response.json(
      { error: API_ERROR_CODES.DATA_TOO_LARGE, maxSize: MAX_CONTENT_SIZE / 1024 / 1024 },
      { status: 413 }
    );
  }

  const metaSource: Record<string, unknown> =
    body.meta && typeof body.meta === 'object' ? { ...(body.meta as Record<string, unknown>), id } : { id };
  // 只写正文时（客户端增量保存），索引交给 PATCH 统一提交，避免逐条改笔记触发多次索引写入
  const hasMeta = body.meta !== undefined && body.meta !== null;
  if (hasMeta && typeof metaSource.preview !== 'string') {
    // 客户端漏传摘要时用正文兜底，避免索引里的预览为空
    metaSource.preview = buildNotePreview(content);
  }

  await writeShards(env, [{ id, content }]);

  if (!hasMeta) {
    return Response.json({ success: true });
  }

  const meta = sanitizeItem(metaSource);
  if (!meta) {
    return Response.json({ error: API_ERROR_CODES.INVALID_NOTE_ID }, { status: 400 });
  }

  const index = await loadNoteIndex(env);
  const position = index.items.findIndex((item) => item.id === id);
  if (position >= 0) {
    index.items[position] = meta;
  } else {
    index.items.push(meta);
  }
  try {
    await writeIndex(env, index.items);
  } catch (error) {
    if (error instanceof Error && error.message === API_ERROR_CODES.DATA_TOO_LARGE) {
      return Response.json(
        { error: API_ERROR_CODES.DATA_TOO_LARGE, maxSize: MAX_INDEX_SIZE / 1024 / 1024 },
        { status: 413 }
      );
    }
    throw error;
  }

  return Response.json({ success: true });
}

async function handlePatch(request: Request, env: Env): Promise<Response> {
  let body: { upsert?: unknown; removeIds?: unknown; order?: unknown };
  try {
    body = (await request.json()) as { upsert?: unknown; removeIds?: unknown; order?: unknown };
  } catch {
    return Response.json({ error: API_ERROR_CODES.INVALID_JSON }, { status: 400 });
  }

  const upsertItems = sanitizeItems(body.upsert);
  const removeIds = Array.isArray(body.removeIds)
    ? body.removeIds.filter((id): id is string => typeof id === 'string' && NOTE_ID_RE.test(id))
    : [];

  const index = await loadNoteIndex(env);
  let items = index.items;

  if (removeIds.length > 0) {
    const removing = new Set(removeIds);
    items = items.filter((item) => !removing.has(item.id));
  }

  // upsert：已存在则原位替换，新 id 追加到末尾
  for (const item of upsertItems) {
    const position = items.findIndex((entry) => entry.id === item.id);
    if (position >= 0) {
      items[position] = item;
    } else {
      items.push(item);
    }
  }

  // order：按给定 id 顺序重排，未出现在 order 中的条目保持原相对顺序追加到末尾
  if (Array.isArray(body.order)) {
    const orderIds = body.order.filter((id): id is string => typeof id === 'string');
    const byId = new Map(items.map((item) => [item.id, item]));
    const reordered: NoteIndexItem[] = [];
    for (const id of orderIds) {
      const item = byId.get(id);
      if (item) {
        reordered.push(item);
        byId.delete(id);
      }
    }
    items = reordered.concat(Array.from(byId.values()));
  }

  try {
    await writeIndex(env, items);
  } catch (error) {
    if (error instanceof Error && error.message === API_ERROR_CODES.DATA_TOO_LARGE) {
      return Response.json(
        { error: API_ERROR_CODES.DATA_TOO_LARGE, maxSize: MAX_INDEX_SIZE / 1024 / 1024 },
        { status: 413 }
      );
    }
    throw error;
  }

  return Response.json({ success: true });
}

async function handleDelete(url: URL, env: Env): Promise<Response> {
  // 集合路径必须显式确认：/api/notes/ 这类取不到 id 的请求一律拒绝，
  // 避免任何误发的 DELETE 直接清空全部笔记
  if (url.pathname === '/api/notes') {
    if (url.searchParams.get('all') !== 'true') {
      return Response.json({ error: API_ERROR_CODES.CONFIRM_REQUIRED }, { status: 400 });
    }
    await clearAllNotes(env);
    return Response.json({ success: true });
  }

  const id = extractNoteId(url);
  if (!id || !NOTE_ID_RE.test(id)) {
    return Response.json({ error: API_ERROR_CODES.INVALID_NOTE_ID }, { status: 400 });
  }
  await env.USER_DATA.delete(noteContentKey(id));
  await removeFromIndex(env, id);
  return Response.json({ success: true });
}

async function notesHandler(request: Request, url: URL, env: Env): Promise<Response> {
  try {
    switch (request.method) {
      case 'GET':
        return await handleGet(url, env);
      case 'POST':
        return await handlePost(request, url, env);
      case 'PATCH':
        return await handlePatch(request, env);
      case 'DELETE':
        return await handleDelete(url, env);
      default:
        return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === API_ERROR_CODES.DATA_TOO_LARGE) {
      return Response.json(
        { error: API_ERROR_CODES.DATA_TOO_LARGE, maxSize: MAX_INDEX_SIZE / 1024 / 1024 },
        { status: 413 }
      );
    }
    console.error(`[notes] ${request.method} ${url.pathname}:`, error);
    return Response.json({ error: API_ERROR_CODES.INTERNAL_ERROR }, { status: 500 });
  }
}

// 模块级缓存：避免每次请求都重新创建闭包
const authenticatedNotesHandler = requireAuth(notesHandler);

export async function handleNotesRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/notes')) {
    return null;
  }
  return authenticatedNotesHandler(request, url, env);
}