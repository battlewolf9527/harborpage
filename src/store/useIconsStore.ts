import { create } from 'zustand';
import { getServices } from '../services/serviceContainer';
import type { Website, OpenFolder } from '../types';
import { setupAutoPersist } from './persistence';
import { generateId } from '../utils/idUtils';
import createLogger from '../utils/logger';

const logger = createLogger('IconsStore');

interface PendingDeleteItem {
  id: string;
  url: string;
}

interface IconsState {
  websites: Website[];
  openFolder: OpenFolder | null;
  draggedIcon: Website | null;
  targetIconId: string | null;
  pendingDeletes: PendingDeleteItem[];

  setWebsiteIcons: (icons: Website[]) => void;
  setOpenFolder: (folder: OpenFolder | null) => void;
  setDraggedIcon: (icon: Website | null) => void;
  setTargetIconId: (id: string | null) => void;
  setPendingDeletes: (items: PendingDeleteItem[]) => void;

  addIcon: (icon: Website) => void;
  updateIcon: (icon: Website) => void;
  deleteIcon: (iconId: string) => void;
  dragIconOut: (icon: Website) => void;
  changeFolderName: (newName: string) => void;
  disbandFolder: () => void;
  deleteFolder: () => void;
  updateFolderIcons: (icons: Website[]) => void;
  addIconToFolder: (folderName: string, icon: Website) => void;
  createFolder: (folderName?: string) => void;
  createFolderDirectly: (folderName: string) => void;
  initialize: (icons: Website[]) => void;
  processPendingDeletes: (onProgress?: (current: number, total: number) => void) => Promise<void>;
  clearPendingDeletes: () => void;
}

const initialState = {
  websites: [] as Website[],
  openFolder: null as OpenFolder | null,
  draggedIcon: null as Website | null,
  targetIconId: null as string | null,
  pendingDeletes: [] as PendingDeleteItem[],
};

export const useIconsStore = create<IconsState>((set, get) => ({
  ...initialState,

  setWebsiteIcons: (icons) => {
    set((state) => {
      if (!state.openFolder) return { websites: icons };
      const folder = icons.find(item => item.isFolder && item.id === state.openFolder!.id);
      return {
        websites: icons,
        openFolder: { ...state.openFolder, websites: folder?.children || [] },
      };
    });
  },

  setOpenFolder: (folder) => set({ openFolder: folder }),
  setDraggedIcon: (icon) => set({ draggedIcon: icon }),
  setTargetIconId: (id) => set({ targetIconId: id }),
  setPendingDeletes: (items) => set({ pendingDeletes: items }),

  addIcon: (icon) => {
    const { websites } = get();
    const updatedIcons = [...websites, icon];
    get().setWebsiteIcons(updatedIcons);
  },

  updateIcon: (updatedIcon) => {
    const { websites } = get();

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
    const { websites, pendingDeletes, openFolder } = get();

    let iconToDelete: Website | null = null;

    const findIcon = (icons: Website[]): Website | null => {
      for (const icon of icons) {
        if (icon.id === iconId) {
          return icon;
        }
        if (icon.isFolder && icon.children) {
          const found = findIcon(icon.children);
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

    set({ websites: updatedIcons, pendingDeletes: newPendingDeletes, openFolder: newOpenFolder });
  },

  dragIconOut: (icon) => {
    const { openFolder, websites } = get();
    if (!openFolder) return;

    const updatedFolderWebsites = openFolder.websites.filter(i => i.id !== icon.id);
    const iconToAdd: Website = { ...icon, isFolder: false };
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
    const { openFolder, websites } = get();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const newIcons = [...websites];
    newIcons[folderIndex] = { ...targetFolder, name: newName };

    set({
      websites: newIcons,
      openFolder: { ...openFolder, name: newName },
    });
  },

  disbandFolder: () => {
    const { openFolder, websites } = get();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const iconsToRelease = openFolder.websites.map((website): Website => ({
      ...website,
      isFolder: false,
    }));

    const newIcons = [
      ...websites.filter((_, index) => index !== folderIndex),
      ...iconsToRelease
    ];

    set({ websites: newIcons, openFolder: null });
  },

  deleteFolder: () => {
    const { openFolder, websites, pendingDeletes } = get();
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
      websites: newIcons,
      pendingDeletes: newPendingDeletes,
      openFolder: null,
    });
  },

  updateFolderIcons: (icons) => {
    const { openFolder, websites } = get();
    if (!openFolder) return;

    const folderIndex = websites.findIndex(item => item.isFolder && item.id === openFolder.id);
    if (folderIndex === -1) return;

    const targetFolder = websites[folderIndex];
    const newIcons = [...websites];
    newIcons[folderIndex] = { ...targetFolder, children: icons };

    get().setWebsiteIcons(newIcons);
  },

  addIconToFolder: (folderName, icon) => {
    const { websites } = get();

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
    const { websites } = get();

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

  initialize: (icons: Website[]) => {
    if (icons !== undefined && icons !== null) {
      set({ websites: icons });
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

  createFolder: (folderName?: string) => {
    const { websites, draggedIcon, targetIconId, openFolder } = get();

    if (!folderName || !draggedIcon || !targetIconId) {
      return;
    }

    const draggedIconObj = websites.find(icon => icon.id === draggedIcon.id);
    const targetIconObj = websites.find(icon => icon.id === targetIconId);

    if (!draggedIconObj || !targetIconObj) {
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
      if (icon.id === draggedIcon.id) return [];
      return [icon];
    });

    // 同步 openFolder（虽然创建文件夹时通常无 openFolder，但保持一致性）
    let newOpenFolder = openFolder;
    if (openFolder) {
      const folder = newIcons.find(item => item.isFolder && item.id === openFolder.id);
      newOpenFolder = { ...openFolder, websites: folder?.children || [] };
    }

    set({ websites: newIcons, targetIconId: null, openFolder: newOpenFolder });
  },
}));

setupAutoPersist(useIconsStore, [
  { key: 'websites', persist: (icons) => getServices().dataManager.updateWebsiteIcons(icons as Website[]) },
]);