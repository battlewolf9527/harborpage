import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './Background.css';
import { useWallpaperStore } from '../../store/useWallpaperStore';

const getWallpaperUrl = (originalUrl: string, type: string): string => {
  // data: URL（base64）和 local 类型（R2 直链）不需要走代理
  if (originalUrl.startsWith('data:') || type === 'local') {
    return originalUrl;
  }
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
    if (wallpaperType === 'solid') {
      return { background: solidColor };
    }
    if (wallpaperType === 'gradient') {
      return { background: DEFAULT_GRADIENT };
    }
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

  const overlayStyle = useMemo<React.CSSProperties>(() => ({
    background: `rgba(0, 0, 0, ${overlayLevel})`,
    backdropFilter: `blur(${blurLevel / 5}px)`,
  }), [overlayLevel, blurLevel]);

  return (
    <>
      <div className="background" style={backgroundStyle}></div>
      <div className="background-overlay" style={overlayStyle}></div>
    </>
  );
};

export default Background;