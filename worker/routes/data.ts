import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { TRACKED_KEYS, isTrackedKey, API_ERROR_CODES } from '../utils/constants';
import { loadNoteIndex, writeNotesAsShards, clearAllNotes } from './notes';

// 单个数据项最大允许大小：1MB（防止滥用和性能问题）
const MAX_DATA_SIZE = 1024 * 1024;

// 笔记走分片存储（notes:index + note:{id}），'notes' 键在此仅作为兼容入口转发
const NOTES_KEY = 'notes';

async function handleGetAll(_request: Request, _url: URL, env: Env): Promise<Response> {
  // 并行读取所有 KV 键，避免串行往返延迟
  const entries = await Promise.all(
    TRACKED_KEYS.map(async (k) => {
      if (k === NOTES_KEY) {
        // 笔记已拆分为索引 + 分片，这里返回索引中的元数据列表
        const index = await loadNoteIndex(env);
        return [k, index.items] as const;
      }
      const raw = await env.USER_DATA.get(k);
      if (!raw) return [k, undefined] as const;
      try {
        return [k, JSON.parse(raw)] as const;
      } catch {
        console.warn(`[data] Failed to parse key: ${k}`);
        return [k, undefined] as const;
      }
    })
  );
  const result: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return Response.json(result);
}

async function handleGetByKey(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get('key');
  if (!key) {
    return Response.json({ error: API_ERROR_CODES.MISSING_KEY }, { status: 400 });
  }
  if (!isTrackedKey(key)) {
    return Response.json({ error: API_ERROR_CODES.INVALID_KEY }, { status: 400 });
  }
  if (key === NOTES_KEY) {
    const index = await loadNoteIndex(env);
    return Response.json(index.items);
  }
  const data = await env.USER_DATA.get(key);
  if (!data) {
    return Response.json({});
  }
  try {
    return Response.json(JSON.parse(data));
  } catch {
    return Response.json({ error: API_ERROR_CODES.DATA_PARSE_FAILED }, { status: 500 });
  }
}

async function handlePost(request: Request, url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get('key');
  if (!key || !isTrackedKey(key)) {
    return Response.json({ error: API_ERROR_CODES.INVALID_KEY }, { status: 400 });
  }

  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: API_ERROR_CODES.INVALID_JSON }, { status: 400 });
  }

  const jsonData = JSON.stringify(data);
  // 使用 UTF-8 字节长度而非字符串长度，确保多字节字符正确计算
  const byteLength = new TextEncoder().encode(jsonData).byteLength;
  if (byteLength > MAX_DATA_SIZE) {
    return Response.json(
      { error: API_ERROR_CODES.DATA_TOO_LARGE, maxSize: MAX_DATA_SIZE / 1024 / 1024 },
      { status: 413 }
    );
  }

  // 兼容兜底：整包笔记写入时改写成「每篇一个分片 + 索引」，避免复活旧键
  if (key === NOTES_KEY) {
    await writeNotesAsShards(env, data);
    return Response.json({ success: true });
  }

  await env.USER_DATA.put(key, jsonData);
  return Response.json({ success: true });
}

async function handleDelete(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get('key');
  if (!key || !isTrackedKey(key)) {
    return Response.json({ error: API_ERROR_CODES.INVALID_KEY }, { status: 400 });
  }
  if (key === NOTES_KEY) {
    await clearAllNotes(env);
    return Response.json({ success: true });
  }
  await env.USER_DATA.delete(key);
  return Response.json({ success: true });
}

async function dataHandler(request: Request, url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get('key');

  try {
    switch (request.method) {
      case 'GET':
        if (!key) {
          return handleGetAll(request, url, env);
        }
        return handleGetByKey(url, env);
      case 'POST':
        return handlePost(request, url, env);
      case 'DELETE':
        return handleDelete(url, env);
      default:
        return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
    }
  } catch {
    return Response.json({ error: API_ERROR_CODES.INTERNAL_ERROR }, { status: 500 });
  }
}

// 模块级缓存：避免每次请求都重新创建闭包
const authenticatedDataHandler = requireAuth(dataHandler);

export async function handleDataRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/data')) {
    return null;
  }
  return authenticatedDataHandler(request, url, env);
}
