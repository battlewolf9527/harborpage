import type { Note, NoteMeta } from '../types';
import AuthService from './AuthService';
import { STORAGE_KEYS } from '../constants';
import { toNoteMeta } from '../utils/noteMeta';
import createLogger from '../utils/logger';

const logger = createLogger('NotesRepository');

const CONTENT_CONCURRENCY = 4;

/**
 * 笔记分片存储的云端读写与增量写入队列。
 *
 * 存储形态：notes:index（元数据 + 顺序） + note:{id}（单篇正文）
 * 保存模型沿用「用户决定何时保存」：store 变更 → DataManager 做 diff 入队 →
 * 保存时 flushPending() 一次性提交，改一条笔记只写一条正文分片 + 一次索引。
 *
 * 仅依赖 AuthService / logger，保持 DataManager → NotesRepository 单向依赖。
 */
class NotesRepository {
  private static instance: NotesRepository;

  /** 待写正文分片：id → 正文（同 id 只保留最新一次） */
  private pendingWrites = new Map<string, string>();
  /** 待写入索引的元数据：id → meta */
  private pendingMeta = new Map<string, NoteMeta>();
  /** 待删除的笔记 id */
  private pendingDeletes = new Set<string>();
  /** 待更新的展示顺序（完整 id 列表，仅顺序变化时记录） */
  private pendingOrder: string[] | null = null;
  /** 进行中的提交，用于复用同一轮请求 */
  private flushing: Promise<boolean> | null = null;
  /** 云端索引已知笔记 id 的本地记录（懒加载） */
  private syncedIds: Set<string> | null = null;

  private constructor() {}

  public static getInstance(): NotesRepository {
    if (!NotesRepository.instance) {
      NotesRepository.instance = new NotesRepository();
    }
    return NotesRepository.instance;
  }

  // ===== 本地格式标记 =====

  /** 本浏览器是否已确认笔记分片格式（确认后才允许从本地镜像剥离正文） */
  public isSharded(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.NOTES_SHARDED) === 'true';
    } catch {
      return false;
    }
  }

  public markSharded(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES_SHARDED, 'true');
    } catch (error) {
      logger.error('Failed to persist notes storage flag', error);
    }
  }

  // ===== 云端已有记录（启动对账用） =====

  /**
   * 本浏览器确认已存在于云端索引的笔记 id。
   * 启动对账只移除「这里记录过、但云端索引已不存在」的笔记，
   * 从未上云过的本地新笔记不在其中，不会被误删。
   */
  public getSyncedIds(): Set<string> {
    if (!this.syncedIds) {
      this.syncedIds = this.readSyncedIds();
    }
    return this.syncedIds;
  }

  public markSynced(ids: Iterable<string>): void {
    const synced = this.getSyncedIds();
    let changed = false;
    for (const id of ids) {
      if (!synced.has(id)) {
        synced.add(id);
        changed = true;
      }
    }
    if (changed) this.persistSyncedIds();
  }

  public unmarkSynced(ids: Iterable<string>): void {
    const synced = this.getSyncedIds();
    let changed = false;
    for (const id of ids) {
      if (synced.delete(id)) changed = true;
    }
    if (changed) this.persistSyncedIds();
  }

  private readSyncedIds(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTES_SYNCED);
      if (!raw) return new Set();
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((id): id is string => typeof id === 'string'));
    } catch {
      return new Set();
    }
  }

  private persistSyncedIds(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES_SYNCED, JSON.stringify([...(this.syncedIds ?? [])]));
    } catch (error) {
      logger.error('Failed to persist synced note ids', error);
    }
  }

  // ===== 读取 =====

  /** 读取元数据索引；失败返回 null（调用方保留本地镜像数据） */
  public async loadIndex(): Promise<NoteMeta[] | null> {
    const result = await this.request<{ items?: NoteMeta[] }>('/api/notes');
    if (!result) return null;
    return Array.isArray(result.items) ? result.items : [];
  }

  /** 读取单篇正文；不存在或失败返回 null */
  public async loadContent(id: string): Promise<string | null> {
    const result = await this.request<{ content?: unknown }>(`/api/notes/${encodeURIComponent(id)}`);
    if (!result || typeof result.content !== 'string') return null;
    return result.content;
  }

  /** 批量读取正文（限制并发），返回已成功读取的 id → 正文 */
  public async loadContents(ids: string[]): Promise<Map<string, string>> {
    const loaded = new Map<string, string>();
    for (let i = 0; i < ids.length; i += CONTENT_CONCURRENCY) {
      const batch = ids.slice(i, i + CONTENT_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (id) => [id, await this.loadContent(id)] as const)
      );
      for (const [id, content] of results) {
        if (content !== null) loaded.set(id, content);
      }
    }
    return loaded;
  }

  // ===== 入队 =====

  /** 正文变化：正文写分片，元数据（摘要/时间）随索引一次性提交 */
  public enqueue(note: Note): void {
    this.pendingWrites.set(note.id, note.content);
    this.pendingMeta.set(note.id, toNoteMeta(note));
  }

  /** 仅元数据变化（标题/颜色等），不重写正文分片 */
  public enqueueMeta(note: Note): void {
    if (this.pendingWrites.has(note.id)) return;
    this.pendingMeta.set(note.id, toNoteMeta(note));
  }

  public enqueueDelete(id: string): void {
    this.pendingWrites.delete(id);
    this.pendingMeta.delete(id);
    this.pendingDeletes.add(id);
  }

  public enqueueOrder(ids: string[]): void {
    this.pendingOrder = ids;
  }

  /** 整包入队：只推送本地真正持有正文的笔记，避免用空串覆盖云端分片 */
  public enqueueAll(notes: Note[]): void {
    for (const note of notes) {
      this.pendingMeta.set(note.id, toNoteMeta(note));
      if (note.contentLoaded === true || note.content !== '') {
        this.pendingWrites.set(note.id, note.content);
      }
    }
  }

  /** 本地镜像需要保留正文的 id（正文尚未确认落到云端） */
  public getPendingIds(): Set<string> {
    return new Set([...this.pendingWrites.keys(), ...this.pendingMeta.keys()]);
  }

  // ===== 提交 =====

  /**
   * 提交待写队列。返回 false 表示本轮有失败（队列保留，下次保存重试）。
   * 写入顺序：正文分片 → 删除 → 索引（保证索引里有的笔记，正文一定已存在）。
   */
  public flushPending(): Promise<boolean> {
    if (this.flushing) return this.flushing;
    this.flushing = this.runFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async runFlush(): Promise<boolean> {
    const hasPending =
      this.pendingWrites.size > 0 ||
      this.pendingMeta.size > 0 ||
      this.pendingDeletes.size > 0 ||
      this.pendingOrder !== null;
    if (!hasPending) return true;

    for (const [id, content] of Array.from(this.pendingWrites.entries())) {
      const ok = await this.request(`/api/notes/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      if (!ok) return false;
      this.pendingWrites.delete(id);
    }

    for (const id of Array.from(this.pendingDeletes)) {
      const ok = await this.request(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!ok) return false;
      this.pendingDeletes.delete(id);
      this.unmarkSynced([id]);
    }

    const upsert = Array.from(this.pendingMeta.values());
    const order = this.pendingOrder;
    if (upsert.length > 0 || order) {
      const ok = await this.request('/api/notes', {
        method: 'PATCH',
        body: JSON.stringify({ ...(upsert.length > 0 ? { upsert } : {}), ...(order ? { order } : {}) }),
      });
      if (!ok) return false;
      for (const meta of upsert) {
        this.pendingMeta.delete(meta.id);
      }
      if (order) this.pendingOrder = null;
      // 索引写入成功后才算「云端已有」：正文分片单独成功但索引没写进去的笔记不能记入
      this.markSynced(upsert.map((meta) => meta.id));
    }

    return true;
  }

  /** 清空云端全部笔记（索引 + 分片）；必须带 all=true 显式确认 */
  public async clearAll(): Promise<boolean> {
    this.pendingWrites.clear();
    this.pendingMeta.clear();
    this.pendingDeletes.clear();
    this.pendingOrder = null;
    const result = await this.request('/api/notes?all=true', { method: 'DELETE' });
    if (result !== null) {
      this.getSyncedIds().clear();
      this.persistSyncedIds();
    }
    return result !== null;
  }

  // ===== 启动对账 =====

  /**
   * 以云端为准做一次启动对账：把「本地镜像里曾有、云端索引已没有」的笔记挑出来交给调用方移除。
   * 只认 `getSyncedIds()` 里记录过的 id，因此从未上云的本地新笔记不会被误删；
   * 拉取失败（离线/未登录）返回 null，调用方保持原样，下次启动再对账。
   */
  public async findNotesDeletedOnCloud(localIds: string[]): Promise<string[] | null> {
    const index = await this.loadIndex();
    if (!index) return null;

    const remoteIds = new Set(index.map((item) => item.id));
    const synced = this.getSyncedIds();
    const removed = localIds.filter((id) => synced.has(id) && !remoteIds.has(id));
    this.unmarkSynced(removed);
    // 云端索引里已有的本地笔记一并登记，首次对账后即可覆盖历史数据
    this.markSynced(localIds.filter((id) => remoteIds.has(id)));
    return removed;
  }

  // ===== 底层请求 =====

  private async request<T = unknown>(path: string, init?: RequestInit): Promise<T | null> {
    try {
      const response = await fetch(path, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeaders(),
        },
      });
      if (response.status === 401) {
        AuthService.handleAuthFailure();
        return null;
      }
      if (!response.ok) {
        logger.error(`Notes API failed: ${init?.method ?? 'GET'} ${path} (${response.status})`);
        return null;
      }
      try {
        return (await response.json()) as T;
      } catch {
        return {} as T;
      }
    } catch (error) {
      logger.error(`Notes API error: ${init?.method ?? 'GET'} ${path}`, error);
      return null;
    }
  }
}

export default NotesRepository.getInstance();