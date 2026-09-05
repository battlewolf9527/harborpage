import { useEffect, useRef } from 'react';
import { useWallpaperStore } from '../store/useWallpaperStore';
import type { WallpaperType } from '../types';
import { fetchBingWallpaperUrl, getRandomBingWallpaperUrl } from '../utils/wallpaperRefresh';

/**
 * 页面加载、数据初始化完成后，对 bing/randomBing 类型壁纸自动刷新。
 * 通过记录上次处理的 wallpaperType，确保每种类型只触发一次获取，
 * 避免与 WallpaperManager 的手动操作冲突。
 */
export function useWallpaperInit(isAuthenticated: boolean, isCheckingAuth: boolean) {
  const wallpaperType = useWallpaperStore((s) => s.wallpaperType);
  const setWallpaperSilent = useWallpaperStore((s) => s.setWallpaperSilent);
  const lastInitTypeRef = useRef<WallpaperType | null>(null);

  useEffect(() => {
    // 等待认证完成、数据初始化后再执行
    if (!isAuthenticated || isCheckingAuth) return;
    // 同一类型只初始化一次
    if (lastInitTypeRef.current === wallpaperType) return;
    // 仅处理需要远程获取的壁纸类型
    if (wallpaperType !== 'bing' && wallpaperType !== 'randomBing') {
      lastInitTypeRef.current = wallpaperType;
      return;
    }
    lastInitTypeRef.current = wallpaperType;

    if (wallpaperType === 'bing') {
      (async () => {
        const url = await fetchBingWallpaperUrl();
        setWallpaperSilent(url, 'bing');
      })();
    } else if (wallpaperType === 'randomBing') {
      setWallpaperSilent(getRandomBingWallpaperUrl(), 'randomBing');
    }
  }, [wallpaperType, setWallpaperSilent, isAuthenticated, isCheckingAuth]);
}
