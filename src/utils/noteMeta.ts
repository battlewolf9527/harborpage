import type { Note, NoteMeta } from '../types';
import { buildNotePreview } from '../constants';

/** 笔记正文摘要（索引与列表/悬浮提示共用同一口径） */
export function previewOf(note: Note): string {
  return buildNotePreview(note.content || note.preview || '');
}

/** 剥离正文与运行时标记，得到可写入索引的元数据 */
export function toNoteMeta(note: Note): NoteMeta {
  return {
    id: note.id,
    title: note.title,
    preview: previewOf(note),
    createdAt: note.createdAt,
    ...(note.updatedAt ? { updatedAt: note.updatedAt } : {}),
    ...(note.color ? { color: note.color } : {}),
    ...(note.colorSlot ? { colorSlot: note.colorSlot } : {}),
    ...(note.pinned ? { pinned: note.pinned } : {}),
  };
}

/**
 * 得到可写入本地镜像的笔记：
 * · keepContent = true  —— 正文尚未确认落到云端（待写队列中），必须保留
 * · keepContent = false —— 只留元数据，正文以云端为准，避免本地 5MB 配额被笔记撑爆
 */
export function toPersistedNote(note: Note, keepContent: boolean): Note {
  return {
    id: note.id,
    title: note.title,
    content: keepContent ? note.content : '',
    createdAt: note.createdAt,
    ...(note.updatedAt ? { updatedAt: note.updatedAt } : {}),
    ...(note.color ? { color: note.color } : {}),
    ...(note.colorSlot ? { colorSlot: note.colorSlot } : {}),
    ...(note.pinned ? { pinned: note.pinned } : {}),
    ...(note.preview ? { preview: note.preview } : {}),
  };
}