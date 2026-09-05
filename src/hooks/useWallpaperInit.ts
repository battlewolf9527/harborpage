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
  const wallpaper = useWallpaperStore((s) => s.wallpaper);
  const setWallpaperSilent = useWallpaperStore((s) => s.setWallpaperSilent);
  const lastInitTypeRef = useRef<WallpaperType | null>(null);

  useEffect(() => {
    // 等待认证完成、数据初始化后再执行
    if (!isAuthenticated || isCheckingAuth) return;

    const isRemoteType = wallpaperType === 'bing' || wallpaperType === 'randomBing';
    // 同一类型只初始化一次；但远程类型的 URL 不持久化到云端，登出后重新登录时
    // store 会重新初始化把 wallpaper 置空，此时允许补拉，否则背景图会丢失
    if (lastInitTypeRef.current === wallpaperType && !(isRemoteType && !wallpaper)) return;
    lastInitTypeRef.current = wallpaperType;
    // 仅处理需要远程获取的壁纸类型
    if (!isRemoteType) return;

    if (wallpaperType === 'bing') {
      (async () => {
        const url = await fetchBingWallpaperUrl();
        setWallpaperSilent(url, 'bing');
      })();
    } else if (wallpaperType === 'randomBing') {
      setWallpaperSilent(getRandomBingWallpaperUrl(), 'randomBing');
    }
  }, [wallpaperType, wallpaper, setWallpaperSilent, isAuthenticated, isCheckingAuth]);
}
