import { create } from 'zustand';
import type { WallpaperData, WallpaperType } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { loadLocalWallpaper } from '../utils/wallpaperStorage';

interface WallpaperState {
  wallpaper: string | null;
  wallpaperType: WallpaperType;
  blurLevel: number;
  overlayLevel: number;
  solidColor: string;
  /** 自动更换壁纸开关（持久化，整页生效） */
  autoChangeEnabled: boolean;
  /** 自动更换间隔（小时） */
  autoChangeIntervalHours: number;
  /** 最近一次壁纸切换时间戳，作为自动更换计时的锚点 */
  lastAutoChangeAt: number;

  setWallpaper: (wallpaper: string | null, type: WallpaperType) => void;
  /** 静默更新壁纸（不触发持久化），用于自动刷新 Bing/随机壁纸 */
  setWallpaperSilent: (wallpaper: string | null, type: WallpaperType) => void;
  setBlurLevel: (blurLevel: number) => void;
  setOverlayLevel: (overlayLevel: number) => void;
  setSolidColor: (color: string) => void;
  setAutoChangeEnabled: (enabled: boolean) => void;
  setAutoChangeIntervalHours: (hours: number) => void;
  initialize: (wallpaperData?: WallpaperData) => void;
}

const initialState: Omit<WallpaperState, 'setWallpaper' | 'setWallpaperSilent' | 'setBlurLevel' | 'setOverlayLevel' | 'setSolidColor' | 'setAutoChangeEnabled' | 'setAutoChangeIntervalHours' | 'initialize'> = {
  wallpaper: null,
  wallpaperType: 'gradient',
  blurLevel: 0,
  overlayLevel: 0.3,
  solidColor: '#667eea',
  autoChangeEnabled: false,
  autoChangeIntervalHours: 24,
  lastAutoChangeAt: 0,
};

export const useWallpaperStore = create<WallpaperState>((set, get) => ({
  ...initialState,

  setWallpaper: (wallpaper, type) => {
    const { autoChangeEnabled } = get();
    set({
      wallpaper,
      wallpaperType: type,
      // 自动更换开启时，任何一次切换都重置锚点，从该时刻起重新计时
      ...(autoChangeEnabled ? { lastAutoChangeAt: Date.now() } : {}),
    });
  },

  setWallpaperSilent: (wallpaper, type) => {
    suppressWallpaperPersist = true;
    set({ wallpaper, wallpaperType: type });
    suppressWallpaperPersist = false;
  },

  setBlurLevel: (blurLevel) => {
    set({ blurLevel });
  },

  setOverlayLevel: (overlayLevel) => {
    set({ overlayLevel });
  },

  setSolidColor: (solidColor) => {
    set({ solidColor });
  },

  setAutoChangeEnabled: (enabled) => {
    set(() => ({
      autoChangeEnabled: enabled,
      // 开启时重置锚点，保证从开启时刻起满一个间隔后才首次更换
      ...(enabled ? { lastAutoChangeAt: Date.now() } : {}),
    }));
  },

  setAutoChangeIntervalHours: (hours) => {
    set({ autoChangeIntervalHours: Math.max(1, Math.min(24, hours)) });
  },

  initialize: (wallpaperData) => {
    if (wallpaperData) {
      const type = wallpaperData.type || 'gradient';
      // bing/randomBing 类型的 URL 每次加载都由 useWallpaperInit 重新获取，不使用旧值，避免重复请求
      const wallpaper = (type === 'bing' || type === 'randomBing')
        ? null
        : (wallpaperData.url || null);
      set({
        wallpaper,
        wallpaperType: type,
        blurLevel: wallpaperData.blurLevel ?? 0,
        overlayLevel: wallpaperData.overlayLevel ?? 0.3,
        solidColor: wallpaperData.solidColor || '#667eea',
        autoChangeEnabled: wallpaperData.autoChangeEnabled ?? false,
        autoChangeIntervalHours: wallpaperData.autoChangeIntervalHours ?? 24,
        lastAutoChangeAt: wallpaperData.lastAutoChangeAt ?? 0,
      });
      // 如果是 IndexedDB 标记，异步加载实际 data URL
      if (wallpaper === 'indexeddb://wallpaper') {
        loadLocalWallpaper()
          .then((dataUrl) => {
            if (dataUrl) {
              suppressWallpaperPersist = true;
              set({ wallpaper: dataUrl });
              suppressWallpaperPersist = false;
            }
          })
          .catch((err) => {
            console.error('从 IndexedDB 加载壁纸失败', err);
          });
      }
    }
  },
}));

const getDM = () => getServices().dataManager;

/** 抑制壁纸持久化标志，用于 setWallpaperSilent 阻止自动刷新触发未保存提示 */
let suppressWallpaperPersist = false;

// 防抖持久化壁纸状态（wallpaper 和 wallpaperType 应该一起更新）
let wallpaperPersistTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedPersistWallpaperState = () => {
  if (suppressWallpaperPersist) return;
  if (wallpaperPersistTimer) {
    clearTimeout(wallpaperPersistTimer);
  }
  wallpaperPersistTimer = setTimeout(() => {
    wallpaperPersistTimer = null;
    const { wallpaper, wallpaperType } = useWallpaperStore.getState();
    // data: URL 不存入 KV，用标记代替（实际数据在 IndexedDB 中）
    const persistUrl = wallpaper?.startsWith('data:') ? 'indexeddb://wallpaper' : wallpaper;
    getDM().updateWallpaper(persistUrl, wallpaperType);
  }, 100);
};

// cleanup 函数，用于应用卸载时清理
export const cleanupWallpaperPersist = () => {
  if (wallpaperPersistTimer) {
    clearTimeout(wallpaperPersistTimer);
    wallpaperPersistTimer = null;
  }
};

// 自动更换开关与间隔可能同时变化，持久化时读取最新状态一次写全
const persistAutoChangeSettings = () => {
  const { autoChangeEnabled, autoChangeIntervalHours } = useWallpaperStore.getState();
  getDM().updateWallpaperAutoChange(autoChangeEnabled, autoChangeIntervalHours);
};

setupAutoPersist(useWallpaperStore, [
  { key: 'wallpaper', persist: debouncedPersistWallpaperState },
  { key: 'wallpaperType', persist: debouncedPersistWallpaperState },
  { key: 'blurLevel', persist: (v) => getDM().updateBlurLevel(v as number) },
  { key: 'overlayLevel', persist: (v) => getDM().updateOverlayLevel(v as number) },
  { key: 'solidColor', persist: (v) => getDM().updateSolidColor(v as string) },
  { key: 'autoChangeEnabled', persist: persistAutoChangeSettings },
  { key: 'autoChangeIntervalHours', persist: persistAutoChangeSettings },
  { key: 'lastAutoChangeAt', persist: (v) => getDM().updateWallpaperLastChangeAt(v as number) },
]);