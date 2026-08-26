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

export const useSettingsSelector = () => useSettingsStore(useShallow((s) => ({
  siteTitle: s.siteTitle,
  iconColumns: s.iconColumns,
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
  // 从 usePagesStore 订阅当前页面的 websites（触发重渲染）
  const { currentPageId, pages } = usePagesStore(useShallow((s) => ({
    currentPageId: s.currentPageId,
    pages: s.pages,
  })));
  const currentPage = pages.find(p => p.id === currentPageId);
  const websites = currentPage?.websites ?? [];

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
