import type { UserData, Website, SearchEngine, Todo, Note, Page } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';
import { useIconsStore } from '../store/useIconsStore';
import { useWallpaperStore } from '../store/useWallpaperStore';
import { useSearchStore } from '../store/useSearchStore';
import { useTodoStore } from '../store/useTodoStore';
import { useNotesStore } from '../store/useNotesStore';
import { usePaletteStore } from '../store/usePaletteStore';
import { usePagesStore } from '../store/usePagesStore';
import { getServices } from './serviceContainer';
import createLogger from '../utils/logger';

const logger = createLogger('StoreInitializer');

const nextFrame = (): Promise<void> =>
  new Promise(resolve => requestAnimationFrame(() => resolve()));

// 将各 store 的实际状态同步回 DataManager
// 原因：初始化期间 dataManager.isInitializing() 为 true，setupAutoPersist 会跳过持久化，
// 导致 store 中使用的默认值（如默认搜索引擎）未同步到 DataManager，导出时数据缺失
function syncToDataManager(): void {
  const dataManager = getServices().dataManager;
  const syncResults: Record<string, boolean> = {};

  const safeSync = (name: string, fn: () => void): void => {
    try {
      fn();
      syncResults[name] = true;
    } catch (error) {
      logger.error(`同步 ${name} 到 DataManager 失败`, error);
      syncResults[name] = false;
    }
  };

  // 注意：以下同步操作会触发 ChangeTracker.markChanged，
  // 是否清除变更标记应由调用方自行决定

  safeSync('settings', () => {
    const s = useSettingsStore.getState();
    dataManager.updateSiteTitle(s.siteTitle);
    dataManager.updateIconColumns(s.iconColumns);
    dataManager.updateAutoSaveEnabled(s.autoSaveEnabled);
    dataManager.updateAutoSaveDuration(s.autoSaveDuration);
    dataManager.updateWeatherEnabled(s.weatherEnabled);
    dataManager.updateSearchEnabled(s.searchEnabled);
    dataManager.updateNotesEnabled(s.notesEnabled);
    dataManager.updateTodosEnabled(s.todosEnabled);
    dataManager.updatePagesEnabled(s.pagesEnabled);
    dataManager.updateDefaultSearchEngineId(useSearchStore.getState().defaultSearchEngineId);
  });

  safeSync('websites', () => {
    const ws: Website[] = useIconsStore.getState().getWebsites() ?? [];
    dataManager.updateWebsiteIcons(ws);
  });

  safeSync('wallpaper', () => {
    const w = useWallpaperStore.getState();
    dataManager.updateWallpaper(w.wallpaper, w.wallpaperType);
    dataManager.updateWallpaperAutoChange(w.autoChangeEnabled, w.autoChangeIntervalHours);
    dataManager.updateWallpaperLastChangeAt(w.lastAutoChangeAt);
    if (w.solidColor) dataManager.updateSolidColor(w.solidColor);
    if (w.blurLevel !== undefined) dataManager.updateBlurLevel(w.blurLevel);
    if (w.overlayLevel !== undefined) dataManager.updateOverlayLevel(w.overlayLevel);
  });

  safeSync('searchEngines', () => {
    const se: SearchEngine[] = useSearchStore.getState().searchEngines ?? [];
    dataManager.updateSearchEngines(se);
  });

  safeSync('todos', () => {
    const ts: Todo[] = useTodoStore.getState().todos ?? [];
    dataManager.updateTodos(ts);
  });

  safeSync('notes', () => {
    const ns: Note[] = useNotesStore.getState().notes ?? [];
    dataManager.updateNotes(ns);
  });

  safeSync('palette', () => {
    const p = usePaletteStore.getState();
    dataManager.updatePalette(p.slots);
    dataManager.updatePaletteAliases(p.aliases);
    dataManager.updatePaletteLightness(p.lightness);
  });

  safeSync('pages', () => {
    const ps: Page[] = usePagesStore.getState().pages ?? [];
    dataManager.updatePages(ps);
  });

  safeSync('currentPageId', () => {
    const cpid: string = usePagesStore.getState().currentPageId ?? '';
    dataManager.updateCurrentPageId(cpid);
  });

  const failedSyncs = Object.entries(syncResults)
    .filter(([, success]) => !success)
    .map(([name]) => name);

  if (failedSyncs.length > 0) {
    logger.warn(`以下数据同步到 DataManager 失败: ${failedSyncs.join(', ')}`);
  }
}

export function initializeAllStores(data: UserData): void {
  const initResults: Record<string, boolean> = {};

  const safeInit = (name: string, fn: () => void): void => {
    try {
      fn();
      initResults[name] = true;
    } catch (error) {
      logger.error(`初始化 ${name} 失败`, error);
      initResults[name] = false;
    }
  };

  safeInit('settings', () => useSettingsStore.getState().initialize(data.settings));
  safeInit('pages', () => usePagesStore.getState().initialize(data.pages, data.currentPageId, data.websites));
  // ⚠️ 注意：websites 由 pages 管理，这里不要再传 []（之前传 [] 会触发 icons initialize 把 pages 刚写入的网站清空！）
  safeInit('icons', () => useIconsStore.getState().initialize());
  safeInit('wallpaper', () => useWallpaperStore.getState().initialize(data.wallpaper));
  safeInit('search', () => useSearchStore.getState().initialize(data.searchEngines, data.settings?.defaultSearchEngineId));
  safeInit('todos', () => useTodoStore.getState().initialize(data.todos ?? data.todoList ?? []));
  safeInit('notes', () => useNotesStore.getState().initialize(data.notes));
  safeInit('palette', () => usePaletteStore.getState().initialize(data.palette, data.paletteAliases, data.paletteLightness));

  const failedStores = Object.entries(initResults)
    .filter(([, success]) => !success)
    .map(([name]) => name);

  if (failedStores.length > 0) {
    logger.warn(`以下 store 初始化失败: ${failedStores.join(', ')}`);
  }

  syncToDataManager();
}

// 异步版本：逐步初始化各 store 并通过 onProgress 回调报告进度
// 用于导入数据时显示进度条
export async function initializeAllStoresAsync(
  data: UserData,
  onProgress?: (task: string, percent: number) => void,
): Promise<void> {
  const initResults: Record<string, boolean> = {};

  const safeInit = (name: string, fn: () => void): void => {
    try {
      fn();
      initResults[name] = true;
    } catch (error) {
      logger.error(`初始化 ${name} 失败`, error);
      initResults[name] = false;
    }
  };

  const steps: Array<[string, number, string, () => void]> = [
    ['settings', 15, '正在初始化设置...', () => useSettingsStore.getState().initialize(data.settings)],
    ['pages', 30, '正在初始化页面...', () => usePagesStore.getState().initialize(data.pages, data.currentPageId, data.websites)],
    // ⚠️ 注意：websites 由 pages 管理，这里不要再传 []（之前传 [] 会触发 icons initialize 把 pages 刚写入的网站清空！）
    ['icons', 40, '正在初始化网站...', () => useIconsStore.getState().initialize()],
    ['wallpaper', 50, '正在初始化壁纸...', () => useWallpaperStore.getState().initialize(data.wallpaper)],
    ['search', 65, '正在初始化搜索引擎...', () => useSearchStore.getState().initialize(data.searchEngines, data.settings?.defaultSearchEngineId)],
    ['todos', 77, '正在初始化待办列表...', () => useTodoStore.getState().initialize(data.todos ?? data.todoList ?? [])],
    ['notes', 87, '正在初始化笔记...', () => useNotesStore.getState().initialize(data.notes)],
    ['palette', 92, '正在初始化调色板...', () => usePaletteStore.getState().initialize(data.palette, data.paletteAliases, data.paletteLightness)],
  ];

  for (const [name, percent, task, fn] of steps) {
    onProgress?.(task, percent);
    await nextFrame();
    safeInit(name, fn);
  }

  const failedStores = Object.entries(initResults)
    .filter(([, success]) => !success)
    .map(([name]) => name);

  if (failedStores.length > 0) {
    logger.warn(`以下 store 初始化失败: ${failedStores.join(', ')}`);
  }

  onProgress?.('正在同步数据...', 92);
  await nextFrame();
  syncToDataManager();

  onProgress?.('导入完成', 100);
  await nextFrame();
}

export function clearAllPendingDeletes(): void {
  try {
    useIconsStore.getState().clearPendingDeletes();
  } catch (error) {
    logger.error('清理待删除项失败', error);
  }
}
