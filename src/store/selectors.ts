import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from './useSettingsStore';
import { useIconsStore } from './useIconsStore';
import { useIconsUIStore } from './useIconsUIStore';
import { useImportStore } from './useImportStore';
import { useWallpaperStore } from './useWallpaperStore';
import { useSearchStore } from './useSearchStore';
import { useTodoStore } from './useTodoStore';
import { useNotesStore } from './useNotesStore';
import { usePagesStore } from './usePagesStore';
import type { Website } from '../types';

// ⚠️ 关键：模块级稳定引用的空数组，避免每次 selector 返回新对象造成"假变化"
// Zustand 用 Object.is() 比较 selector 返回值，新引用会被判定为状态变化 → 触发重渲染
// 如果不使用稳定引用，当 pages 为空/找不到当前页时，每次执行都 return [] → 新对象引用 → 无限重渲染
const EMPTY_WEBSITES: Website[] = [];

export const useSettingsSelector = () => useSettingsStore(useShallow((s) => ({
  siteTitle: s.siteTitle,
  iconColumns: s.iconColumns,
  weatherEnabled: s.weatherEnabled,
  searchEnabled: s.searchEnabled,
  notesEnabled: s.notesEnabled,
  todosEnabled: s.todosEnabled,
  pagesEnabled: s.pagesEnabled,
  settingsReady: s.settingsReady,
  setSiteTitle: s.setSiteTitle,
  setIconColumns: s.setIconColumns,
  initializeSettings: s.initialize,
})));

export const usePagesSelector = () => usePagesStore(useShallow((s) => ({
  pages: s.pages,
  currentPageId: s.currentPageId,
  currentPage: s.pages.find(p => p.id === s.currentPageId),
  setPages: s.setPages,
  setCurrentPageId: s.setCurrentPageId,
  addPage: s.addPage,
  renamePage: s.renamePage,
  deletePage: s.deletePage,
  reorderPages: s.reorderPages,
})));

export const useIconsDataSelector = () => {
  // 关键性能优化：只订阅当前页的 websites，不订阅整个 pages 数组
  // - 空/未找到时返回稳定引用 EMPTY_WEBSITES，避免无限重渲染
  // - 当前页 websites 数组引用本身不变时（其他页面改动），Zustand 判定未变化 → 不重渲染
  const websites = usePagesStore((s): Website[] => {
    const currentPage = s.pages.find(p => p.id === s.currentPageId);
    return currentPage?.websites ?? EMPTY_WEBSITES;
  });

  // 从 useIconsStore 订阅其他 UI 状态和方法
  const iconsState = useIconsStore(useShallow((s) => ({
    openFolder: s.openFolder,
    setWebsiteIcons: s.setWebsiteIcons,
    setOpenFolder: s.setOpenFolder,
    setTargetIconId: s.setTargetIconId,
    addIcon: s.addIcon,
    updateIcon: s.updateIcon,
    deleteIcon: s.deleteIcon,
    dragIconOut: s.dragIconOut,
    changeFolderName: s.changeFolderName,
    changeFolderColor: s.changeFolderColor,
    disbandFolder: s.disbandFolder,
    deleteFolder: s.deleteFolder,
    updateFolderIcons: s.updateFolderIcons,
    createFolder: s.createFolder,
  })));

  return {
    websites,
    ...iconsState,
  };
};

export const useIconsUISelector = () => useIconsUIStore(useShallow((s) => ({
  isEditMode: s.isEditMode,
  showAddIcon: s.showAddIcon,
  showEditIcon: s.showEditIcon,
  editingIcon: s.editingIcon,
  showFolderNameDialog: s.showFolderNameDialog,
  showSettings: s.showSettings,
  setIsEditMode: s.setIsEditMode,
  setShowAddIcon: s.setShowAddIcon,
  setShowEditIcon: s.setShowEditIcon,
  setEditingIcon: s.setEditingIcon,
  setShowSettings: s.setShowSettings,
  setShowFolderNameDialog: s.setShowFolderNameDialog,
})));

export const useImportSelector = () => useImportStore(useShallow((s) => ({
  isImporting: s.isImporting,
  importProgress: s.importProgress,
  importMessage: s.importMessage,
  setIsImporting: s.setIsImporting,
  setImportProgress: s.setImportProgress,
  setImportMessage: s.setImportMessage,
  resetImport: s.resetImport,
})));

export const useWallpaperSelector = () => useWallpaperStore(useShallow((s) => ({
  wallpaper: s.wallpaper,
  wallpaperType: s.wallpaperType,
  blurLevel: s.blurLevel,
  overlayLevel: s.overlayLevel,
  solidColor: s.solidColor,
})));

export const useSearchSelector = () => useSearchStore(useShallow((s) => ({
  searchEngines: s.searchEngines,
  defaultSearchEngineId: s.defaultSearchEngineId,
  setSearchEngines: s.setSearchEngines,
  setDefaultSearchEngineId: s.setDefaultSearchEngineId,
})));

export const useTodoSelector = () => useTodoStore(useShallow((s) => ({
  todos: s.todos,
  setTodos: s.setTodos,
})));

export const useNotesSelector = () => useNotesStore(useShallow((s) => ({
  notes: s.notes,
  setNotes: s.setNotes,
})));
