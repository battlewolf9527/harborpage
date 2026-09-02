import { create } from 'zustand';
import type { Note, NoteColor } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { generateId } from '../utils/idUtils';

type NotesUpdater = Note[] | ((prev: Note[]) => Note[]);

// 预设便签颜色循环（新增笔记时轮询分配，避免一排同色；与 types/NoteColor 字面量严格一致 16 色）
const COLOR_ROTATION: NoteColor[] = [
  'yellow', 'amber', 'orange', 'coral',
  'pink', 'rose',
  'red',
  'green', 'lime', 'emerald', 'teal', 'cyan',
  'blue', 'sky',
  'purple', 'indigo',
];

export interface NotesState {
  notes: Note[];

  /** 原子式覆盖/函数式更新（旧 API，保留以兼容持久化订阅方） */
  setNotes: (notes: NotesUpdater) => void;

  /** 新增笔记：在当前数组开头插入，分配颜色与时间戳；返回生成的 id */
  addNote: (input: { title?: string; content?: string; color?: NoteColor }) => string;

  /** 按 id 更新笔记（浅合并），自动刷新 updatedAt */
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;

  /** 按 id 删除笔记 */
  deleteNote: (id: string) => void;

  /** 更换便签颜色 */
  setNoteColor: (id: string, color: NoteColor) => void;

  /** 拖拽重排（任意两项之间重排；允许 toIndex === notes.length 即末尾） */
  reorderNotes: (fromIndex: number, toIndex: number) => void;

  /** 初始化（不触发持久化回调） */
  initialize: (notes?: Note[]) => void;
}

const initialState: Omit<NotesState,
  | 'setNotes' | 'addNote' | 'updateNote' | 'deleteNote'
  | 'setNoteColor' | 'reorderNotes' | 'initialize'
> = {
  notes: [],
};

export const useNotesStore = create<NotesState>((set, get) => ({
  ...initialState,

  setNotes: (notes) => {
    set((state) => ({
      notes: typeof notes === 'function' ? notes(state.notes) : notes,
    }));
  },

  addNote: (input) => {
    const { notes: prev } = get();
    const id = generateId('note-');
    const now = new Date().toISOString();

    // 分配颜色：若调用方显式传 color → 用传入；否则从 COLOR_ROTATION 随机挑，保证新建笔记每次默认颜色不同。
    const randomIdx = Math.floor(Math.random() * COLOR_ROTATION.length);
    const color: NoteColor = input.color ?? COLOR_ROTATION[randomIdx];

    const note: Note = {
      id,
      title: input.title?.trim() || '无标题',
      content: input.content?.trim() || '',
      createdAt: now,
      updatedAt: now,
      // pinned 字段仅保留用于历史数据读取；UI 入口已移除不再写入
      pinned: false,
      color,
    };

    // 新笔记插在数组最前（置顶语义已移除，拖拽排序自由重排）
    const next = [note, ...prev];
    set({ notes: next });
    return id;
  },

  updateNote: (id, patch) => {
    set((state) => {
      let changed = false;
      const next = state.notes.map((n) => {
        if (n.id !== id) return n;
        changed = true;
        const merged: Note = { ...n, ...patch, updatedAt: new Date().toISOString() };
        return merged;
      });
      return changed ? { notes: next } : state;
    });
  },

  deleteNote: (id) => {
    set((state) => {
      const next = state.notes.filter((n) => n.id !== id);
      return next.length === state.notes.length ? state : { notes: next };
    });
  },

  setNoteColor: (id, color) => {
    get().updateNote(id, { color });
  },

  reorderNotes: (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const { notes } = get();
    const n = notes.length;
    if (fromIndex < 0 || fromIndex >= n) return;
    if (toIndex < 0 || toIndex > n) return;

    const reordered = [...notes];
    const [moved] = reordered.splice(fromIndex, 1);
    const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
    reordered.splice(insertAt, 0, moved);
    set({ notes: reordered });
  },

  initialize: (notes) => {
    set({ notes: notes ?? initialState.notes });
  },
}));

setupAutoPersist(useNotesStore, [
  { key: 'notes', persist: (v) => getServices().dataManager.updateNotes(v as Note[]) },
]);
