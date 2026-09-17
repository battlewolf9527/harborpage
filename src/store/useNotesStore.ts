import { create } from 'zustand';
import type { Note, NoteMeta } from '../types';
import i18n from '../i18n';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import NotesRepository from '../services/NotesRepository';
import { generateId } from '../utils/idUtils';
import { canonicalSlotId, DEFAULT_PALETTE_HEXES, type ColorSelection } from '../utils/paletteColors';

type NotesUpdater = Note[] | ((prev: Note[]) => Note[]);

// 预设便签颜色循环（新增笔记时随机分配，避免一排同色；取出厂 16 槽默认色 hex，与调色板同一套颜色）
const COLOR_ROTATION: string[] = Object.values(DEFAULT_PALETTE_HEXES);

/**
 * 保留已加载的正文：外部只写元数据（对象里没有正文）时，沿用 store 中已加载的正文，
 * 避免 UI 回写把已加载的正文清空、进而用空串覆盖云端分片。
 */
function keepLoadedContent(prev: Note[], next: Note[]): Note[] {
  if (next.length === 0) return next;
  const prevById = new Map(prev.map((note) => [note.id, note]));
  return next.map((note) => {
    const before = prevById.get(note.id);
    if (!before || note.contentLoaded) return note;
    if (before.contentLoaded === true && !note.content) {
      return { ...note, content: before.content, contentLoaded: true };
    }
    return note;
  });
}

export interface NotesState {
  notes: Note[];

  /** 原子式覆盖/函数式更新（旧 API，保留以兼容持久化订阅方） */
  setNotes: (notes: NotesUpdater) => void;

  /** 新增笔记：在当前数组开头插入，分配颜色与时间戳；返回生成的 id */
  addNote: (input: { title?: string; content?: string; color?: string; colorSlot?: string }) => string;

  /** 按 id 更新笔记（浅合并），自动刷新 updatedAt */
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;

  /** 按 id 删除笔记 */
  deleteNote: (id: string) => void;

  /** 更换便签颜色为静态色（预设名或自定义 #rrggbb），清除槽位绑定 */
  setNoteColor: (id: string, color: string) => void;

  /** 应用颜色选择：sel 含 colorSlot → 绑定槽位（color 记快照）；否则为静态自定义色（移除 colorSlot） */
  applyNoteColor: (id: string, sel: ColorSelection) => void;

  /** 拖拽重排（任意两项之间重排；允许 toIndex === notes.length 即末尾） */
  reorderNotes: (fromIndex: number, toIndex: number) => void;

  /**
   * 按需加载单篇正文（分片后正文不在初始化数据里）。
   * 已加载直接返回；失败返回 null 并保持未加载态，下次可重试。
   */
  loadContent: (id: string) => Promise<string | null>;

  /** 批量加载全部未加载的正文（全文搜索 / 导出用）；返回加载失败的篇数 */
  loadAllContents: () => Promise<number>;

  /** 初始化（不触发持久化回调）；兼容元数据（无正文）与旧格式完整笔记 */
  initialize: (notes?: Array<Note | NoteMeta>) => void;
}

const initialState: Omit<NotesState,
  | 'setNotes' | 'addNote' | 'updateNote' | 'deleteNote' | 'setNoteColor' | 'applyNoteColor'
  | 'reorderNotes' | 'loadContent' | 'loadAllContents' | 'initialize'
> = {
  notes: [],
};

export const useNotesStore = create<NotesState>((set, get) => ({
  ...initialState,

  setNotes: (notes) => {
    set((state) => ({
      notes: keepLoadedContent(
        state.notes,
        typeof notes === 'function' ? notes(state.notes) : notes,
      ),
    }));
  },

  addNote: (input) => {
    const { notes: prev } = get();
    const id = generateId('note-');
    const now = new Date().toISOString();

    // 分配颜色：若调用方显式传 color → 用传入；否则从 COLOR_ROTATION 随机挑，保证新建笔记每次默认颜色不同。
    const randomIdx = Math.floor(Math.random() * COLOR_ROTATION.length);
    const color: string = input.color ?? COLOR_ROTATION[randomIdx];

    const note: Note = {
      id,
      title: input.title?.trim() || i18n.t('notes:untitled'),
      content: input.content?.trim() || '',
      createdAt: now,
      updatedAt: now,
      // pinned 字段仅保留用于历史数据读取；UI 入口已移除不再写入
      pinned: false,
      color,
      // 新笔记正文就在本地，标记为已加载，避免保存时被「未加载保护」拦下
      contentLoaded: true,
      // colorSlot 落盘前归一化为 palette-N（兼容旧预设名入参）
      ...(canonicalSlotId(input.colorSlot) ? { colorSlot: canonicalSlotId(input.colorSlot) } : {}),
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
    get().applyNoteColor(id, color ? { color } : {});
  },

  applyNoteColor: (id, sel) => {
    set((state) => {
      let changed = false;
      const next = state.notes.map((n) => {
        if (n.id !== id) return n;
        const copy: Note = { ...n };
        if (sel?.color) copy.color = sel.color;
        if (sel?.colorSlot) copy.colorSlot = sel.colorSlot;
        else delete copy.colorSlot;
        const sameColor = copy.color === n.color;
        const sameSlot = (copy.colorSlot ?? '') === (n.colorSlot ?? '');
        if (sameColor && sameSlot) return n;
        changed = true;
        copy.updatedAt = new Date().toISOString();
        return copy;
      });
      return changed ? { notes: next } : state;
    });
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
    const list = notes ?? initialState.notes;
    set({
      notes: list.map((note) => {
        // 分片存储下初始化只拿到元数据（无 content）；本地镜像/旧格式可能带回正文
        const content = typeof (note as Note).content === 'string' ? (note as Note).content : '';
        return { ...note, content, contentLoaded: content !== '' };
      }),
    });
  },

  loadContent: async (id) => {
    const target = get().notes.find((note) => note.id === id);
    if (!target) return null;
    if (target.contentLoaded) return target.content;

    const content = await NotesRepository.loadContent(id);
    if (content === null) return null;

    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id && !note.contentLoaded ? { ...note, content, contentLoaded: true } : note
      ),
    }));
    return content;
  },

  loadAllContents: async () => {
    const ids = get()
      .notes.filter((note) => !note.contentLoaded)
      .map((note) => note.id);
    if (ids.length === 0) return 0;

    const loaded = await NotesRepository.loadContents(ids);

    set((state) => ({
      notes: state.notes.map((note) => {
        const content = loaded.get(note.id);
        return content !== undefined && !note.contentLoaded
          ? { ...note, content, contentLoaded: true }
          : note;
      }),
    }));

    return ids.length - loaded.size;
  },
}));

setupAutoPersist(useNotesStore, [
  { key: 'notes', persist: (v) => getServices().dataManager.updateNotes(v as Note[]) },
]);
