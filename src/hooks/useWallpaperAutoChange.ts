import { useEffect } from 'react';
import { useWallpaperStore } from '../store/useWallpaperStore';
import { addCacheBustToUrl, fetchBingWallpaperUrl, getRandomBingWallpaperUrl } from '../utils/wallpaperRefresh';

/**
 * 全局自动更换壁纸：挂载在 App 层，整页生效（不依赖壁纸设置弹窗是否打开）。
 * - 开关/间隔持久化到云端，锚点为最近一次壁纸切换时间；
 * - 刷新页面后按「锚点 + 间隔」计算剩余时间，到点即换（已到期则立即换）；
 * - 仅对能持续产出新图的来源生效：Bing每日 / 随机 / 自定义；
 *   纯色、渐变、本地壁纸在到点时跳过，改为按间隔轮询，待切回可换来源后继续生效。
 */
export function useWallpaperAutoChange(isAuthenticated: boolean, isCheckingAuth: boolean) {
  const autoChangeEnabled = useWallpaperStore((s) => s.autoChangeEnabled);
  const autoChangeIntervalHours = useWallpaperStore((s) => s.autoChangeIntervalHours);
  const lastAutoChangeAt = useWallpaperStore((s) => s.lastAutoChangeAt);
  const wallpaperType = useWallpaperStore((s) => s.wallpaperType);

  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth) return;
    if (!autoChangeEnabled) return;

    const intervalMs = Math.max(1, autoChangeIntervalHours) * 60 * 60 * 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    // 尝试换一次壁纸；换不成功（来源不可换）也不影响后续轮询
    const trySwap = async () => {
      if (disposed) return;
      const state = useWallpaperStore.getState();
      const type = state.wallpaperType;
      if (type === 'bing') {
        const url = await fetchBingWallpaperUrl(state.wallpaper);
        if (disposed) return;
        // setWallpaper 会刷新锚点（lastAutoChangeAt），下一轮据此重新计时
        state.setWallpaper(url, 'bing');
      } else if (type === 'randomBing') {
        state.setWallpaper(getRandomBingWallpaperUrl(), 'randomBing');
      } else if (type === 'custom' && state.wallpaper) {
        // 自定义地址可能指向动态图源（如 picsum），追加缓存破坏参数强制重新拉取
        state.setWallpaper(addCacheBustToUrl(state.wallpaper), 'custom');
      }
      scheduleNext();
    };

    const scheduleNext = () => {
      if (disposed) return;
      const state = useWallpaperStore.getState();
      const swappable =
        state.wallpaperType === 'bing' ||
        state.wallpaperType === 'randomBing' ||
        (state.wallpaperType === 'custom' && !!state.wallpaper);
      // 可换来源按锚点精确计时；不可换来源按完整间隔轮询，避免立即重试死循环
      const delay = swappable
        ? Math.max(0, intervalMs - (Date.now() - (state.lastAutoChangeAt || Date.now())))
        : intervalMs;
      timer = setTimeout(() => {
        timer = null;
        void trySwap();
      }, delay);
    };

    scheduleNext();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [isAuthenticated, isCheckingAuth, autoChangeEnabled, autoChangeIntervalHours, lastAutoChangeAt, wallpaperType]);
}
