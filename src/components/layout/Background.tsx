import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './Background.css';
import { useWallpaperStore } from '../../store/useWallpaperStore';

const getWallpaperUrl = (originalUrl: string, type: string): string => {
  // 自定义 URL 壁纸直接加载（/api/wallpaper 代理有域名白名单，无法代理任意用户 URL）
  if (originalUrl.startsWith('data:') || type === 'local' || type === 'custom') return originalUrl;
  return `/api/wallpaper?url=${encodeURIComponent(originalUrl)}`;
};

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';

const Background: React.FC = () => {
  const { wallpaper, wallpaperType, blurLevel, overlayLevel, solidColor } = useWallpaperStore(
    useShallow((s) => ({
      wallpaper: s.wallpaper,
      wallpaperType: s.wallpaperType,
      blurLevel: s.blurLevel,
      overlayLevel: s.overlayLevel,
      solidColor: s.solidColor,
    })),
  );

  const backgroundStyle = useMemo<React.CSSProperties>(() => {
    if (wallpaperType === 'solid') return { background: solidColor };
    if (wallpaperType === 'gradient') return { background: DEFAULT_GRADIENT };
    if (wallpaper && !wallpaper.startsWith('indexeddb://')) {
      return {
        backgroundImage: `url(${getWallpaperUrl(wallpaper, wallpaperType)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return { background: DEFAULT_GRADIENT };
  }, [wallpaperType, solidColor, wallpaper]);

  const blurPx = blurLevel / 5;
  const scale = 1 + Math.min(blurPx, 30) * 0.008;

  const filterStyle = useMemo<React.CSSProperties>(() => {
    if (blurLevel <= 0) return { filter: 'none', WebkitFilter: 'none', transform: 'scale(1)' };
    return {
      filter: `blur(${blurPx}px)`,
      WebkitFilter: `blur(${blurPx}px)`,
      transform: `scale(${scale.toFixed(3)})`,
    };
  }, [blurLevel, blurPx, scale]);

  const overlayStyle = useMemo<React.CSSProperties>(() => ({
    background: `rgba(0, 0, 0, ${overlayLevel})`,
  }), [overlayLevel]);

  return (
    <div className="background-shell">
      <div className="background" style={{ ...backgroundStyle, ...filterStyle }} />
      <div className="background-overlay" style={overlayStyle} />
    </div>
  );
};

export default Background;
