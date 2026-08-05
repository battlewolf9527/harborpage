import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './WallpaperManager.css';
import { useWallpaperStore } from '../../store/useWallpaperStore';
import type { WallpaperType } from '../../types';
import AuthService from '../../services/AuthService';
import createLogger from '../../utils/logger';
import { saveLocalWallpaper } from '../../utils/wallpaperStorage';

const logger = createLogger('WallpaperManager');

const FALLBACK_WALLPAPER = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&q=80';

interface WallpaperSource {
  id: string;
  name: string;
  type: WallpaperType;
  url?: string;
  color?: string;
}

const WallpaperManager: React.FC = () => {
  const { 
    setWallpaper, 
    setBlurLevel, 
    setOverlayLevel, 
    setSolidColor,
    blurLevel, 
    overlayLevel, 
    solidColor,
    wallpaper,
    wallpaperType
  } = useWallpaperStore(
    useShallow((s) => ({
      setWallpaper: s.setWallpaper,
      setBlurLevel: s.setBlurLevel,
      setOverlayLevel: s.setOverlayLevel,
      setSolidColor: s.setSolidColor,
      blurLevel: s.blurLevel,
      overlayLevel: s.overlayLevel,
      solidColor: s.solidColor,
      wallpaper: s.wallpaper,
      wallpaperType: s.wallpaperType,
    })),
  );
  
  const wallpapers = useMemo<WallpaperSource[]>(() => [
    { id: '1', name: 'Bing每日壁纸', type: 'bing' },
    { id: '2', name: '随机壁纸', type: 'randomBing' },
    { id: '3', name: '本地壁纸', type: 'local' },
    { id: '4', name: '纯色背景', type: 'solid', color: solidColor },
  ], [solidColor]);

  const selectedSource = useMemo(() => {
    const source = wallpapers.find(w => w.type === wallpaperType);
    return source?.id || '1';
  }, [wallpaperType, wallpapers]);
  
  const [autoChange, setAutoChange] = useState<boolean>(false);
  const [changeInterval, setChangeInterval] = useState<number>(1);

  // 记录上次使用的 Bing 壁纸 URL，避免刷新时选到同一张
  const lastBingWallpaperRef = useRef<string | null>(null);

  const getRandomBingWallpaper = useCallback(() => {
    const randomParam = Date.now().toString(36);
    const fullUrl = `https://wp.upx8.com/api.php?r=${randomParam}`;
    setWallpaper(fullUrl, 'randomBing');
  }, [setWallpaper]);

  const getBingWallpaper = useCallback(async () => {
    try {
      const response = await fetch('/api/bing/HPImageArchive.aspx?format=json&idx=0&n=8&mkt=zh-CN', {
        headers: AuthService.getAuthHeaders(),
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Bing API请求失败: ${response.status}`);
      }
      const data = await response.json();
      if (data?.images?.length > 0) {
        const images: Array<{ url: string; urlbase: string }> = data.images;
        // 从 url 字段构造图片地址，去掉 & 后的附加参数
        // 例如 /th?id=XXX_UHD.jpg&rf=... -> /th?id=XXX_UHD.jpg
        const toFullUrl = (img: { url: string }) =>
          `https://cn.bing.com${img.url.split('&')[0]}`;

        // 过滤掉上次使用的壁纸
        const available = images.filter(
          (img) => toFullUrl(img) !== lastBingWallpaperRef.current
        );
        const pool = available.length > 0 ? available : images;
        const image = pool[Math.floor(Math.random() * pool.length)];
        const wallpaperUrl = toFullUrl(image);
        lastBingWallpaperRef.current = wallpaperUrl;
        setWallpaper(wallpaperUrl, 'bing');
      } else {
        throw new Error('Bing API返回数据格式异常');
      }
    } catch (error) {
      logger.error('获取Bing每日壁纸失败', error);
      setWallpaper(FALLBACK_WALLPAPER, 'bing');
    }
  }, [setWallpaper]);

  const refreshWallpaperByType = useCallback((type: WallpaperType) => {
    switch (type) {
      case 'bing':
        getBingWallpaper();
        break;
      case 'randomBing':
        getRandomBingWallpaper();
        break;
    }
  }, [getBingWallpaper, getRandomBingWallpaper]);

  const handleSourceChange = useCallback((sourceId: string) => {
    const source = wallpapers.find(w => w.id === sourceId);
    if (!source) return;

    if (source.type === 'solid' || source.type === 'local') {
      setWallpaper(null, source.type);
    } else {
      refreshWallpaperByType(source.type);
    }
  }, [wallpapers, setWallpaper, refreshWallpaperByType]);

  useEffect(() => {
    let interval: number | null = null;
    if (autoChange) {
      interval = setInterval(() => {
        const currentSource = wallpapers.find(w => w.id === selectedSource);
        if (currentSource) {
          refreshWallpaperByType(currentSource.type);
        }
      }, changeInterval * 60 * 60 * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoChange, changeInterval, selectedSource, wallpapers, refreshWallpaperByType]);

  const handleLocalUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/wallpaper/upload', {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // R2 上传成功，用 R2 URL + 时间戳防缓存
        const wallpaperUrl = `${data.wallpaperUrl}?t=${Date.now()}`;
        setWallpaper(wallpaperUrl, 'local');
        return;
      }
      // R2 不可用（503）或其他错误，降级到浏览器存储
      logger.warn('R2 上传失败，降级到浏览器存储', response.status);
    } catch (error) {
      logger.warn('R2 上传请求失败，降级到浏览器存储', error);
    }

    // 降级：base64 存入 IndexedDB，store 直接用 data URL 渲染
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        await saveLocalWallpaper(dataUrl);
        setWallpaper(dataUrl, 'local');
      } catch (err) {
        logger.error('IndexedDB 存储失败', err);
      }
    };
    reader.readAsDataURL(file);
  }, [setWallpaper]);

  const handleColorChange = useCallback((color: string) => {
    setSolidColor(color);
    setWallpaper(null, 'solid');
  }, [setSolidColor, setWallpaper]);

  return (
    <div className="wallpaper-manager">
      <h3>壁纸设置</h3>
      
      <div className="wallpaper-sources">
        <h4>壁纸来源</h4>
        <div className="source-list">
          {wallpapers.map((source) => (
            <div 
              key={source.id} 
              className={`source-item ${selectedSource === source.id ? 'selected' : ''}`}
              onClick={() => handleSourceChange(source.id)}
            >
              {source.name}
            </div>
          ))}
        </div>
      </div>

      {selectedSource === '3' && (
        <div className="local-upload">
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleLocalUpload}
          />
        </div>
      )}

      {selectedSource === '4' && (
        <div className="solid-color">
          <input 
            type="color" 
            value={solidColor}
            onChange={(e) => handleColorChange(e.target.value)}
          />
        </div>
      )}

      <div className="wallpaper-options">
        <h4>壁纸选项</h4>
        
        <div className="option-item">
          <label>
            <input 
              type="checkbox" 
              checked={autoChange} 
              onChange={(e) => setAutoChange(e.target.checked)}
            />
            自动更换壁纸
          </label>
        </div>

        {autoChange && (
          <div className="option-item">
            <label>
              更换间隔: {changeInterval} 小时
              <input 
                type="range" 
                min="1" 
                max="24" 
                value={changeInterval} 
                onChange={(e) => setChangeInterval(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        <div className="option-item">
          <label>
            模糊度: {Math.round(blurLevel)}%
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="1" 
              value={blurLevel} 
              onChange={(e) => {
                setBlurLevel(Number(e.target.value));
              }}
            />
          </label>
        </div>

        <div className="option-item">
          <label>
            遮罩浓度: {Math.round(overlayLevel * 100)}%
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.1" 
              value={overlayLevel} 
              onChange={(e) => {
                setOverlayLevel(Number(e.target.value));
              }}
            />
          </label>
        </div>
      </div>

      {wallpaper && !wallpaper.startsWith('indexeddb://') && (
        <div className="wallpaper-preview">
          <h4>预览</h4>
          <div 
            className="preview-image"
            style={{
              backgroundImage: `url(${wallpaper.startsWith('data:') || wallpaperType === 'local' ? wallpaper : `/api/wallpaper?url=${encodeURIComponent(wallpaper)}`})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              width: '100%',
              height: '200px',
              borderRadius: '8px',
              filter: `blur(${blurLevel / 5}px)`,
              position: 'relative'
            }}
          >
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: `rgba(0, 0, 0, ${overlayLevel})`,
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WallpaperManager;