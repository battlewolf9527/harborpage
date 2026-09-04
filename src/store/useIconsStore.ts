import { create } from 'zustand';
import { getServices } from '../services/serviceContainer';
import type { Website, OpenFolder } from '../types';
import { setupAutoPersist } from './persistence';
import { generateId } from '../utils/idUtils';
import createLogger from '../utils/logger';
import { usePagesStore } from './usePagesStore';
import type { ColorSelection } from '../utils/paletteColors';

const logger = createLogger('IconsStore');

interface PendingDeleteItem {
  id: string;
  url: string;
}

interface PendingFolderCreation {
  draggedIconId: string;
  targetIconId: string;
}

interface IconsState {
  openFolder: OpenFolder | null;
  draggedIcon: Website | null;
  targetIconId: string | null;
  pendingDeletes: PendingDeleteItem[];
  pendingFolderCreation: PendingFolderCreation | null;

  // ---- websites 代理方法（读写通过 pagesStore）----
  getWebsites: () => Website[];
  setWebsiteIcons: (icons: Website[]) => void;

  setOpenFolder: (folder: OpenFolder | null) => void;
  setDraggedIcon: (icon: Website | null) => void;
  setTargetIconId: (id: string | null) => void;
  setPendingDeletes: (items: PendingDeleteItem[]) => void;
  setPendingFolderCreation: (pending: PendingFolderCreation | null) => void;

  addIcon: (icon: Website) => void;
  updateIcon: (icon: Website) => void;
  deleteIcon: (iconId: string) => void;
  dragIconOut: (icon: Website) => void;
  changeFolderName: (newName: string) => void;
  /** 修改当前打开文件夹的水晶材质色：colorSlot=绑定槽（跟随调色板），否则 color=静态 hex/清除=缺省色 */
  changeFolderColor: (sel: ColorSelection) => void;
  disbandFolder: () => void;
  deleteFolder: () => void;
  updateFolderIcons: (icons: Website[]) => void;
  addIconToFolder: (folderName: string, icon: Website) => void;
  createFolder: (folderName?: string) => void;
  createFolderDirectly: (folderName: string) => void;
  initialize: (icons?: Website[]) => void;
  processPendingDeletes: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  clearPendingDeletes: () => void;
  clearAllSites: () => void;
}

const initialState = {
  openFolder: null as OpenFolder | null,
  draggedIcon: null as Website | null,
  targetIconId: null as string | null,
  pendingDeletes: [] as PendingDeleteItem[],
  pendingFolderCreation: null as PendingFolderCreation | null,
};

// 辅助函数：同步 websites 到当前页面
const syncToCurrentPage = (websites: Website[], openFolder: OpenFolder | null): OpenFolder | null => {
  const pagesStore = usePagesStore.getState();
  const currentPageId = pagesStore.currentPageId;
  if (currentPageId) {
    pagesStore.updatePageWebsites(currentPageId, websites);
  }
  // 同步 openFolder
  if (openFolder) {
    const folder = websites.find(item => item.isFolder && item.id === openFolder.id);
    return { ...openFolder, websites: folder?.children || [] };
  }
  return openFolder;
};

export const useIconsStore = create<IconsState>((set, get) => ({
  ...initialState,

  getWebsites: () => {
    return usePagesStore.getState().getCurrentPageWebsites();
  },

  setWebsiteIcons: (icons) => {
    set((state) => {
      const newOpenFolder = syncToCurrentPage(icons, state.openFolder);
      return { openFolder: newOpenFolder };
    });
  },

  setOpenFolder: (folder) => set({ openFolder: folder }),
  setDraggedIcon: (icon) => set({ draggedIcon: icon }),
  setTargetIconId: (id) => set({ targetIconId: id }),
  setPendingDeletes: (items) => set({ pendingDeletes: items }),
  setPendingFolderCreation: (pending) => set({ pendingFolderCreation: pending }),

  addIcon: (icon) => {
    const websites = get().getWebsites();
    const updatedIcons = [...websites, icon];
    get().setWebsiteIcons(updatedIcons);
  },

  updateIcon: (updatedIcon) => {
    const websites = get().getWebsites();

    const updatedIcons = websites.map(icon => {
      if (icon.id === updatedIcon.id) {
        return updatedIcon;
      }
      if (icon.isFolder && icon.children) {
        return {
          ...icon,
          children: icon.children.map(child =>
            child.id === updatedIcon.id ? updatedIcon : child
          )
        };
      }
      return icon;
    });

    get().setWebsiteIcons(updatedIcons);
  },

  deleteIcon: (iconId) => {
    const websites = get().getWebsites();
    const { pendingDeletes, openFolder } = get();

    let iconToDelete: Website | null = null;

    // 递归查图标：使用 visited 防止数据环导致的栈溢出崩溃
    const findIcon = (icons: Website[], visited: Set<string> = new Set()): Website | null => {
      for (const icon of icons) {
        if (visited.has(icon.id)) continue;
        visited.add(icon.id);
        if (icon.id === iconId) {
          return icon;
        }
        if (icon.isFolder && icon.children) {
          const found = findIcon(icon.children, visited);
          if (found) return found;
        }
      }
      return null;
    };

    iconToDelete = findIcon(websites);

    const newPendingDeletes = iconToDelete?.url
      ? [...pendingDeletes, { id: iconToDelete.id, url: iconToDelete.url }]
      : pendingDeletes;

    const updatedIcons = websites
      .filter(icon => icon.id !== iconId)
      .map(icon => {
        if (icon.isFolder && icon.children) {
          return {
            ...icon,
            children: icon.children.filter(child => child.id !== iconId),
          };
        }
        return icon;
      });

    // 同步 openFolder（若打开的文件夹子项发生变化）
    let newOpenFolder = openFolder;
    if (openFolder) {
      const folder = updatedIcons.find(item => item.isFolder && item.id === openFolder.id);
      newOpenFolder = { ...openFolder, websites: folder?.children || [] };
    }

    set({ pendingDeletes: newPendingDeletes, openFolder: newOpenFolder });
    get().setWebsiteIcons(updatedIcons);
  },

  dragIconOut: (icon) => {
    const { openFolder } = get();
    const websites = get().getWebsites();
    if (!openFolder) return;

    const updatedFolderWebsites = openFolder.websites.filter(i => i.id !== icon.id);
    // 防御性清理：从文件夹拖出的一定是普通网站，显式移除 children/isFolder 残留，
    // 避免之前因嵌套 folder、导入脏数据或 double-drop 产生的 children 属性污染根级数组，
    // 进而在后续递归遍历（findIcon/collectItems/导出）中产生意外路径。
    const { children: _omitChildren, isFolder: _omitIsFolder, ...rest } = icon;
    const iconToAdd: Website = { ...rest, isFolder: false };
    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);

    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const newIcons = [...websites];
    newIcons[folderIndex] = {
      ...targetFolder,
      children: updatedFolderWebsites,
    };

    const finalIcons = [...newIcons, iconToAdd];
    get().setWebsiteIcons(finalIcons);
  },

  changeFolderName: (newName) => {
    const { openFolder } = get();
    const websites = get().getWebsites();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const newIcons = [...websites];
    newIcons[folderIndex] = { ...targetFolder, name: newName };

    set({
      openFolder: { ...openFolder, name: newName },
    });
    get().setWebsiteIcons(newIcons);
  },

  // 修改当前打开文件夹的水晶材质色：选中槽位 → 存 iconColor 快照 + colorSlot 绑定（跟随调色板）；
  // 自定义色 → 仅存 iconColor（静态）；空选择 → 清除、走缺省晶蓝
  changeFolderColor: (sel) => {
    const { openFolder } = get();
    const websites = get().getWebsites();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const updated: Website = { ...targetFolder };
    delete updated.colorSlot;
    if (sel?.colorSlot) {
      updated.iconColor = sel.color || '';
      updated.colorSlot = sel.colorSlot;
    } else if (sel?.color) {
      updated.iconColor = sel.color;
    } else {
      delete updated.iconColor;
    }

    const newIcons = [...websites];
    newIcons[folderIndex] = updated;
    get().setWebsiteIcons(newIcons);
  },

  disbandFolder: () => {
    const { openFolder } = get();
    const websites = get().getWebsites();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const iconsToRelease = openFolder.websites.map((website): Website => {
      // 解散时所有子项变为普通网站：显式去掉 children 防止嵌套脏数据泄漏到根级
      const { children: _omitChildren, ...rest } = website;
      return { ...rest, isFolder: false };
    });

    const newIcons = [
      ...websites.filter((_, index) => index !== folderIndex),
      ...iconsToRelease
    ];

    set({ openFolder: null });
    get().setWebsiteIcons(newIcons);
  },

  deleteFolder: () => {
    const { openFolder, pendingDeletes } = get();
    const websites = get().getWebsites();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    let newPendingDeletes = pendingDeletes;
    if (openFolder.websites) {
      const newItems: PendingDeleteItem[] = [];
      for (const child of openFolder.websites) {
        if (child.url) {
          newItems.push({ id: child.id, url: child.url });
        }
      }
      newPendingDeletes = [...pendingDeletes, ...newItems];
    }

    const newIcons = websites.filter((_, index) => index !== folderIndex);

    set({
      pendingDeletes: newPendingDeletes,
      openFolder: null,
    });
    get().setWebsiteIcons(newIcons);
  },

  updateFolderIcons: (icons) => {
    const { openFolder } = get();
    const websites = get().getWebsites();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const newIcons = [...websites];
    newIcons[folderIndex] = { ...targetFolder, children: icons };

    get().setWebsiteIcons(newIcons);
  },

  addIconToFolder: (folderName, icon) => {
    const websites = get().getWebsites();

    const folderIndex = websites.findIndex(item => item.isFolder && item.name === folderName);
    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const folderIcons = targetFolder.children || [];

    const exists = folderIcons.some(s => s.name === icon.name && s.url === icon.url);
    if (exists) return;

    const newIcons = [...websites];
    newIcons[folderIndex] = {
      ...targetFolder,
      children: [...folderIcons, icon]
    };

    get().setWebsiteIcons(newIcons);
  },

  createFolderDirectly: (folderName) => {
    const websites = get().getWebsites();

    const exists = websites.some(item => item.isFolder && item.name === folderName);
    if (exists) return;

    const newFolder: Website = {
      id: generateId('folder-'),
      name: folderName,
      url: '',
      isFolder: true,
      children: []
    };

    const newIcons = [...websites, newFolder];
    get().setWebsiteIcons(newIcons);
  },

  initialize: (icons?: Website[]) => {
    // ⚠️ 注意：初始化主流程由 usePagesStore.initialize 完成（pages 内的 websites 才是唯一真源）。
    // 这里保留兼容：只有当调用方明确传入了非空的 websites 数组时，才把它同步到当前页。
    // 严禁传入空数组 []（之前 storeInitializer 传 [] 的写法会把 pages 初始化刚写进去的网站全清空！）。
    if (icons !== undefined && icons !== null && icons.length > 0) {
      const currentPageId = usePagesStore.getState().currentPageId;
      if (currentPageId) {
        usePagesStore.getState().updatePageWebsites(currentPageId, icons);
      }
    }
  },

  processPendingDeletes: async (onProgress?: (current: number, total: number) => void) => {
    const { pendingDeletes } = get();
    if (pendingDeletes.length === 0) return;

    const iconManager = getServices().iconManager;
    try {
      await iconManager.deleteIconsFromR2(pendingDeletes, onProgress);
      // 只有成功时才清空
      set({ pendingDeletes: [] });
    } catch (error) {
      // 保留 pendingDeletes 以便下次保存时重试
      logger.error('删除图标失败，将在下次保存时重试', error);
      throw error;
    }
  },

  clearPendingDeletes: () => {
    set({ pendingDeletes: [] });
  },

  clearAllSites: () => {
    const websites = get().getWebsites();
    const { pendingDeletes } = get();

    // 收集所有站点（含文件夹内子项）中有 URL 的项，用于 R2 图标清理
    const newItems: PendingDeleteItem[] = [];
    // 使用 visited 防止数据环导致的栈溢出崩溃
    const collectItems = (icons: Website[], visited: Set<string> = new Set()) => {
      for (const icon of icons) {
        if (visited.has(icon.id)) continue;
        visited.add(icon.id);
        if (icon.url) {
          newItems.push({ id: icon.id, url: icon.url });
        }
        if (icon.isFolder && icon.children) {
          collectItems(icon.children, visited);
        }
      }
    };
    collectItems(websites);

    set({
      pendingDeletes: [...pendingDeletes, ...newItems],
      openFolder: null,
    });
    get().setWebsiteIcons([]);
  },

  createFolder: (folderName?: string) => {
    const websites = get().getWebsites();
    const { pendingFolderCreation, openFolder } = get();

    if (!pendingFolderCreation) {
      return;
    }

    // 用户取消对话框时清空待创建状态
    if (!folderName) {
      set({ pendingFolderCreation: null, targetIconId: null });
      return;
    }

    const { draggedIconId, targetIconId } = pendingFolderCreation;

    const draggedIconObj = websites.find(icon => icon.id === draggedIconId);
    const targetIconObj = websites.find(icon => icon.id === targetIconId);

    if (!draggedIconObj || !targetIconObj) {
      set({ pendingFolderCreation: null });
      return;
    }

    const newFolder: Website = {
      id: generateId('folder-'),
      name: folderName,
      url: '',
      isFolder: true,
      children: [draggedIconObj, targetIconObj]
    };

    // 在 targetIcon 原位置插入新文件夹，跳过 draggedIcon 和 targetIcon
    const newIcons = websites.flatMap(icon => {
      if (icon.id === targetIconId) return [newFolder];
      if (icon.id === draggedIconId) return [];
      return [icon];
    });

    // 同步 openFolder（虽然创建文件夹时通常无 openFolder，但保持一致性）
    let newOpenFolder = openFolder;
    if (openFolder) {
      const folder = newIcons.find(item => item.isFolder && item.id === openFolder.id);
      newOpenFolder = { ...openFolder, websites: folder?.children || [] };
    }

    set({ pendingFolderCreation: null, targetIconId: null, openFolder: newOpenFolder });
    get().setWebsiteIcons(newIcons);
  },
}));

setupAutoPersist(useIconsStore, [
  // websites 的持久化现在通过 usePagesStore 完成
  // 这里仅作占位，保留未来扩展可能
]);
