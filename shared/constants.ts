export const TRACKED_KEYS = ['settings', 'websites', 'searchEngines', 'todos', 'todoList', 'notes', 'wallpaper', 'pages', 'palette', 'paletteAliases', 'paletteLightness'] as const;

export type TrackedKey = typeof TRACKED_KEYS[number];

export function isTrackedKey(key: string): key is TrackedKey {
  return (TRACKED_KEYS as readonly string[]).includes(key);
}

// ===== 笔记分片存储 =====
// 笔记不再以「一个 notes 键存整个数组」的方式保存，而是拆成：
//   · notes:index  —— 元数据索引（含顺序与 preview 摘要），值是 { v, items }
//   · note:{id}    —— 单篇正文，值是 { v, id, content }
// 这样改一条笔记只写一条分片 + 一个小索引，避免整包重写与单键 1MB 上限。
// 注：TRACKED_KEYS 中的 'notes' 保留为「逻辑变更标记」，其读写由 worker 路由转发到索引。

/** 笔记元数据索引键 */
export const NOTES_INDEX_KEY = 'notes:index';

/** 单篇正文分片的键前缀 */
export const NOTE_KEY_PREFIX = 'note:';

/** 单篇正文分片的键名 */
export function noteContentKey(id: string): string {
  return `${NOTE_KEY_PREFIX}${id}`;
}

/** 笔记 id 合法性（同时也是 KV key 的安全子集） */
export const NOTE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** 索引中携带的正文摘要长度上限（与便签球悬浮提示的取值对齐） */
export const NOTE_PREVIEW_LIMIT = 140;

/** 由正文生成索引摘要：折叠空白 + 截断 */
export function buildNotePreview(content: string, limit: number = NOTE_PREVIEW_LIMIT): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, limit);
}