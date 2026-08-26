import { create } from 'zustand';
import { getServices } from '../services/serviceContainer';
import DataRepository from '../services/DataRepository';
import type { Page, Website } from '../types';
import { setupAutoPersist } from './persistence';
import { generateId } from '../utils/idUtils';
import { mergeById } from '../utils/importExportUtils';
import createLogger from '../utils/logger';

const logger = createLogger('PagesStore');

export const DEFAULT_PAGE_NAME = '默认页面';

interface PagesState {
  pages: Page[];
  currentPageId: string;

  setPages: (pages: Page[]) => void;
  setCurrentPageId: (id: string) => void;

  addPage: (name: string) => Page;
  renamePage: (pageId: string, newName: string) => void;
  deletePage: (pageId: string) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;

  updatePageWebsites: (pageId: string, websites: Website[]) => void;
  getCurrentPageWebsites: () => Website[];
  moveWebsites: (fromPageId: string, toPageId: string, websiteIds: string[]) => void;

  initialize: (pages: Page[] | undefined, currentPageId: string | undefined, legacyWebsites?: Website[]) => void;
}

const initialState = {
  pages: [] as Page[],
  currentPageId: '',
};

const createDefaultPage = (websites: Website[] = []): Page => ({
  id: generateId('page-'),
  name: DEFAULT_PAGE_NAME,
  websites,
  createdAt: Date.now(),
});

export const usePagesStore = create<PagesState>((set, get) => ({
  ...initialState,

  setPages: (pages) => set({ pages }),

  setCurrentPageId: (id) => {
    const { pages } = get();
    const exists = pages.some(p => p.id === id);
    if (exists) {
      set({ currentPageId: id });
    } else if (pages.length > 0) {
      set({ currentPageId: pages[0].id });
    }
  },

  addPage: (name) => {
    const { pages } = get();
    const newPage: Page = {
      id: generateId('page-'),
      name: name || `页面 ${pages.length + 1}`,
      websites: [],
      createdAt: Date.now(),
    };
    set({
      pages: [...pages, newPage],
      currentPageId: newPage.id,
    });
    return newPage;
  },

  renamePage: (pageId, newName) => {
    if (!newName.trim()) return;
    const { pages } = get();
    const updatedPages = pages.map(page =>
      page.id === pageId ? { ...page, name: newName.trim() } : page
    );
    set({ pages: updatedPages });
  },

  deletePage: (pageId) => {
    const { pages, currentPageId } = get();
    if (pages.length <= 1) {
      logger.warn('至少保留一个页面');
      return;
    }

    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) return;

    const remainingPages = pages.filter(p => p.id !== pageId);
    let newCurrentId = currentPageId;
    if (currentPageId === pageId) {
      // 删除的是当前页 → 切到剩余的第一页（刷新/打开默认显示第一页的统一行为）
      newCurrentId = remainingPages[0].id;
    }

    set({
      pages: remainingPages,
      currentPageId: newCurrentId,
    });
  },

  reorderPages: (fromIndex, toIndex) => {
    // 参数语义：
    // - fromIndex：被拖拽项在「原始 pages 数组」中的索引
    // - toIndex：期望的插入位置（同样基于「原始 pages 数组」的 index 语义，允许 = pages.length 表示末尾）
    //            例如 toIndex = 3 表示「在原数组 index=3 的位置之前插入」
    if (fromIndex === toIndex) return;
    const { pages } = get();
    const n = pages.length;
    if (fromIndex < 0 || fromIndex >= n) return;
    // toIndex 允许等于 n（追加到末尾），其他要 < n
    if (toIndex < 0 || toIndex > n) return;

    const reordered = [...pages];
    const [moved] = reordered.splice(fromIndex, 1);
    // splice(from,1) 会让 fromIndex 之后的所有元素左移 1 位，因此当 toIndex > fromIndex 时，
    // 实际插入位置需要 -1 才能对齐到用户期望的「原始数组位置之前」的语义
    const adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
    reordered.splice(adjustedTo, 0, moved);
    set({ pages: reordered });
  },

  updatePageWebsites: (pageId, websites) => {
    const { pages } = get();
    const updatedPages = pages.map(page =>
      page.id === pageId ? { ...page, websites } : page
    );
    set({ pages: updatedPages });
  },

  getCurrentPageWebsites: () => {
    const { pages, currentPageId } = get();
    const currentPage = pages.find(p => p.id === currentPageId);
    return currentPage?.websites ?? [];
  },

  moveWebsites: (fromPageId, toPageId, websiteIds) => {
    if (!fromPageId || !toPageId || fromPageId === toPageId || websiteIds.length === 0) return;
    const { pages } = get();
    const fromPage = pages.find(p => p.id === fromPageId);
    const toPage = pages.find(p => p.id === toPageId);
    if (!fromPage || !toPage) return;

    const movingIds = new Set(websiteIds);
    const movingItems = fromPage.websites.filter(w => movingIds.has(w.id));
    if (movingItems.length === 0) return;

    const remainingFrom = fromPage.websites.filter(w => !movingIds.has(w.id));
    const mergedTo = mergeById(toPage.websites, movingItems);

    const updatedPages = pages.map(p => {
      if (p.id === fromPageId) return { ...p, websites: remainingFrom };
      if (p.id === toPageId) return { ...p, websites: mergedTo };
      return p;
    });
    set({ pages: updatedPages });

    // ⚠️ 用户常见操作链路：右键移动 → 立刻 F5 刷新。
    // 但 setupAutoPersist → dataManager.updatePages → saveToLocal 默认有 500ms 防抖，
    // 用户 500ms 内刷新就会从 localStorage 读到旧数据，看起来像"移走的项目又回来了"。
    // 这里直接把 updatedPages 写入 DataManager 数据，并立即 flushLocal(delay=0)，
    // 保证刷新前 localStorage 就是最新 pages 状态；同时清掉 legacy websites 根键防幽灵合并。
    const { dataManager } = getServices();
    dataManager.updatePages(updatedPages);
    dataManager.updateWebsiteIcons([]);
    DataRepository.flushLocal(dataManager.getData());
  },

  initialize: (pages, _currentPageId, legacyWebsites) => {
    let initializedPages: Page[] = [];
    let initializedCurrentId = '';
    // 当有 legacy 数据迁移时，记录承载导入网站的默认页 id，导入后强制切到该页让用户立刻看到
    let migratedDefaultPageId: string | null = null;

    if (pages && pages.length > 0) {
      // ⚠️ 关键：pages 非空说明已经是多页模式，**完全忽略 legacyWebsites 做任何自动合并**。
      // 之前的兜底 merge 是"刷新后移走的项目又回来"的根因：
      // KV 根级 'websites' 键（旧格式）永远是迁移那一瞬间的快照，每次刷新都会和
      // 当前 pages.websites 做 mergeById，造成被移动/删除的旧条目又被并回默认页。
      // 导入时对旧格式的迁移处理统一在 ImportExport/DataManager 上游（migratedPagesFromLegacy /
      // needsLegacyMigration）完成：它们会把旧网站写入 pages，initialize 只要按 pages 初始化即可。
      initializedPages = pages;
    } else if (legacyWebsites && legacyWebsites.length > 0) {
      // 从旧数据迁移：只有 pages 空/undefined 时才走"创建默认页承载 legacy"的首次迁移路径
      const defaultPage = createDefaultPage(legacyWebsites);
      initializedPages = [defaultPage];
      migratedDefaultPageId = defaultPage.id;
    } else {
      // 无数据时创建一个空的默认页面
      initializedPages = [createDefaultPage()];
    }

    // 确定 currentPageId：
    // - 只有导入旧格式数据触发迁移时（migratedDefaultPageId 有效），才切到迁移页；
    // - 其他所有情况（首次加载、刷新、常规初始化）→ 始终显示第一页，不再持久化/恢复 currentPageId
    if (migratedDefaultPageId && initializedPages.some(p => p.id === migratedDefaultPageId)) {
      initializedCurrentId = migratedDefaultPageId;
    } else {
      initializedCurrentId = initializedPages[0].id;
    }

    set({
      pages: initializedPages,
      currentPageId: initializedCurrentId,
    });
  },
}));

setupAutoPersist(usePagesStore, [
  {
    key: 'pages',
    persist: (pages) => {
      const { dataManager } = getServices();
      dataManager.updatePages(pages as Page[]);
      // 保险：每次 pages 写入后同步清空根级 'websites'（旧格式快照），
      // 避免它在任何遗留初始化路径中被重新 merge 回 pages，
      // 导致"移动/删除的网站刷新后又回来"这类幽灵回写问题。
      dataManager.updateWebsiteIcons([]);
    },
  },
  // ⚠️ currentPageId 不再持久化：
  // - 页面打开或刷新时永远显示 pages 中的第一页；
  // - 切换页面不触发任何持久化写入，因此不会有"需要保存"的提示；
  // - 旧数据中的 currentPageId 字段在加载时被忽略，TRACKED_KEYS 也已移除该键。
]);
