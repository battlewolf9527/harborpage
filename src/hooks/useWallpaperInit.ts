import { useEffect, useRef } from 'react';
import { useWallpaperStore } from '../store/useWallpaperStore';
import AuthService from '../services/AuthService';
import createLogger from '../utils/logger';
import type { WallpaperType } from '../types';

const logger = createLogger('useWallpaperInit');

const FALLBACK_WALLPAPER = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&q=80';

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
        try {
          const response = await fetch(
            '/api/bing/HPImageArchive.aspx?format=json&idx=0&n=8&mkt=zh-CN',
            { headers: AuthService.getAuthHeaders(), cache: 'no-store' },
          );
          if (!response.ok) throw new Error(`Bing API请求失败: ${response.status}`);
          const data = await response.json();
          if (data?.images?.length > 0) {
            const images: Array<{ url: string }> = data.images;
            const toFullUrl = (img: { url: string }) =>
              `https://cn.bing.com${img.url.split('&')[0]}`;
            const image = images[Math.floor(Math.random() * images.length)];
            setWallpaperSilent(toFullUrl(image), 'bing');
          } else {
            throw new Error('Bing API返回数据格式异常');
          }
        } catch (error) {
          logger.error('初始化获取Bing壁纸失败', error);
          setWallpaperSilent(FALLBACK_WALLPAPER, 'bing');
        }
      })();
    } else if (wallpaperType === 'randomBing') {
      const randomParam = Date.now().toString(36);
      setWallpaperSilent(`https://wp.upx8.com/api.php?r=${randomParam}`, 'randomBing');
    }
  }, [wallpaperType, setWallpaperSilent, isAuthenticated, isCheckingAuth]);
}
