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

  // 关键优化：只有 blurLevel > 0 时才应用 backdrop-filter，
  // 因为即便 blur(0px) 也会创建一个 GPU 合成层，消耗资源
  const hasBlur = blurLevel > 0;
  const overlayStyle = useMemo<React.CSSProperties>(() => {
    const style: React.CSSProperties = {
      background: `rgba(0, 0, 0, ${overlayLevel})`,
    };
    if (hasBlur) {
      // 通过 CSS 变量传递给类样式
      (style as React.CSSProperties & { ['--blur-value']?: string })['--blur-value'] = `${blurLevel / 5}px`;
    }
    return style;
  }, [overlayLevel, hasBlur, blurLevel]);

  const overlayClassName = useMemo(() => {
    return hasBlur ? 'background-overlay background-overlay--has-blur' : 'background-overlay';
  }, [hasBlur]);

  return (
    <>
      <div className="background" style={backgroundStyle}></div>
      <div className={overlayClassName} style={overlayStyle}></div>
    </>
  );
};

export default Background;