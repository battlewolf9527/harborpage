import React, { useState, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './WallpaperManager.css';
import { useWallpaperStore } from '../../store/useWallpaperStore';
import type { WallpaperType } from '../../types';
import AuthService from '../../services/AuthService';
import createLogger from '../../utils/logger';
import { saveLocalWallpaper } from '../../utils/wallpaperStorage';
import { fetchBingWallpaperUrl, getRandomBingWallpaperUrl } from '../../utils/wallpaperRefresh';

const logger = createLogger('WallpaperManager');

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
    setAutoChangeEnabled,
    setAutoChangeIntervalHours,
    blurLevel, 
    overlayLevel, 
    solidColor,
    autoChangeEnabled,
    autoChangeIntervalHours,
    wallpaper,
    wallpaperType
  } = useWallpaperStore(
    useShallow((s) => ({
      setWallpaper: s.setWallpaper,
      setBlurLevel: s.setBlurLevel,
      setOverlayLevel: s.setOverlayLevel,
      setSolidColor: s.setSolidColor,
      setAutoChangeEnabled: s.setAutoChangeEnabled,
      setAutoChangeIntervalHours: s.setAutoChangeIntervalHours,
      blurLevel: s.blurLevel,
      overlayLevel: s.overlayLevel,
      solidColor: s.solidColor,
      autoChangeEnabled: s.autoChangeEnabled,
      autoChangeIntervalHours: s.autoChangeIntervalHours,
      wallpaper: s.wallpaper,
      wallpaperType: s.wallpaperType,
    })),
  );
  
  const wallpapers = useMemo<WallpaperSource[]>(() => [
    { id: '1', name: 'Bing每日壁纸', type: 'bing' },
    { id: '2', name: '随机壁纸', type: 'randomBing' },
    { id: '3', name: '本地壁纸', type: 'local' },
    { id: '4', name: '纯色背景', type: 'solid', color: solidColor },
    { id: '5', name: '自定义', type: 'custom' },
  ], [solidColor]);

  const selectedSource = useMemo(() => {
    const source = wallpapers.find(w => w.type === wallpaperType);
    return source?.id || '1';
  }, [wallpaperType, wallpapers]);

  const [customUrl, setCustomUrl] = useState('');
  const [customUrlError, setCustomUrlError] = useState<string | null>(null);

  // 预填（React 官方「渲染期调整状态」模式）：来源为自定义时，把外部已应用的
  // 壁纸地址同步进输入框。不用 effect 内 setState（会触发级联渲染），
  // 改为「与上一次渲染比较、就地修正」，wallpaper 未变化时保持用户草稿。
  const [prevWallpaper, setPrevWallpaper] = useState(wallpaper);
  if (wallpaperType === 'custom' && wallpaper !== prevWallpaper) {
    setPrevWallpaper(wallpaper);
    setCustomUrl(wallpaper ?? '');
  }

  const getRandomBingWallpaper = useCallback(() => {
    setWallpaper(getRandomBingWallpaperUrl(), 'randomBing');
  }, [setWallpaper]);

  const getBingWallpaper = useCallback(async () => {
    const url = await fetchBingWallpaperUrl(wallpaper);
    setWallpaper(url, 'bing');
  }, [wallpaper, setWallpaper]);

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

    if (source.type === 'custom') {
      // 已应用的自定义地址点击时保留；否则进入等待输入状态
      if (wallpaperType !== 'custom' || !wallpaper) {
        setWallpaper(null, source.type);
      }
    } else if (source.type === 'solid' || source.type === 'local') {
      setWallpaper(null, source.type);
    } else {
      refreshWallpaperByType(source.type);
    }
  }, [wallpapers, wallpaper, wallpaperType, setWallpaper, refreshWallpaperByType]);

  const handleApplyCustomUrl = useCallback(() => {
    const url = customUrl.trim();
    if (!url) {
      setCustomUrlError('请输入图片地址');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setCustomUrlError('URL 格式无效');
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      setCustomUrlError('仅支持 http/https 协议');
      return;
    }
    setCustomUrlError(null);
    setWallpaper(url, 'custom');
  }, [customUrl, setWallpaper]);

  const handleLocalUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const headers = new Headers(AuthService.getAuthHeaders());
      // 传递当前壁纸 URL，供后端清理上一张壁纸文件
      if (wallpaper && !wallpaper.startsWith('data:')) {
        headers.set('X-Previous-Wallpaper', wallpaper);
      }
      const response = await fetch('/api/wallpaper/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // 内容 hash 文件名天然防缓存，URL 直接使用
        setWallpaper(data.wallpaperUrl, 'local');
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
  }, [setWallpaper, wallpaper]);

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

      {selectedSource === '5' && (
        <div className="custom-url">
          <input
            type="text"
            placeholder="粘贴图片 URL，如 https://example.com/wallpaper.jpg"
            value={customUrl}
            onChange={(e) => {
              setCustomUrl(e.target.value);
              if (customUrlError) setCustomUrlError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyCustomUrl();
            }}
          />
          <button onClick={handleApplyCustomUrl}>应用</button>
        </div>
      )}
      {customUrlError && selectedSource === '5' && (
        <div className="custom-url-error">{customUrlError}</div>
      )}

      <div className="wallpaper-options">
        <h4>壁纸选项</h4>

        <div className="auto-change-block">
          <div className="auto-change-row">
            <span className="auto-change-name">自动更换壁纸</span>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={autoChangeEnabled}
                onChange={(e) => setAutoChangeEnabled(e.target.checked)}
                aria-label="自动更换壁纸"
              />
              <span className="settings-switch-track" />
            </label>
          </div>

          {autoChangeEnabled && (
            <div className="option-item auto-change-interval">
              <label>
                <span>更换间隔：{autoChangeIntervalHours} 小时</span>
                <input
                  type="range"
                  min="1"
                  max="24"
                  step="1"
                  value={autoChangeIntervalHours}
                  onChange={(e) => setAutoChangeIntervalHours(Number(e.target.value))}
                />
              </label>
            </div>
          )}

          <p className="auto-change-hint">
            开启后到点自动更换壁纸（Bing每日 / 随机 / 自定义来源）；刷新页面后仍按上次更换时间到点更换。
          </p>
        </div>

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
              backgroundImage: `url(${wallpaper.startsWith('data:') || wallpaperType === 'local' || wallpaperType === 'custom' ? wallpaper : `/api/wallpaper?url=${encodeURIComponent(wallpaper)}`})`,
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