import React, { useState, useEffect, useCallback, useRef } from 'react';
import './AutoFetchDialog.css';
import { getServices } from '../../services/serviceContainer';
import autoFetchService, { type DownloadedIcon, type FetchProgress } from '../../services/autoFetchService';
import { generateId } from '../../utils/idUtils';
import createLogger from '../../utils/logger';

const logger = createLogger('AutoFetchDialog');

interface AutoFetchDialogProps {
  websiteUrl: string;
  websiteId: string;
  websiteName: string;
  onSelect: (iconDataUrl: string | null, r2Url?: string) => void;
  onClose: () => void;
}

const AutoFetchDialog: React.FC<AutoFetchDialogProps> = ({
  websiteUrl,
  websiteId,
  websiteName,
  onSelect,
  onClose,
}) => {
  const { authService } = getServices();
  const [isLoading, setIsLoading] = useState(true);
  const [icons, setIcons] = useState<DownloadedIcon[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [isCaching, setIsCaching] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const fetchIcons = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setProgress({ phase: 'fetching_candidates', current: 0, total: 0, message: '正在分析页面结构...' });

    try {
      const results = await autoFetchService.fetchAllIcons(websiteUrl, (p) => {
        setProgress(p);
      });

      if (results.length > 0) {
        setIcons(results);
        setSelectedIndex(0);
      } else {
        setError('未能获取到图标，请检查网站URL是否正确');
      }
    } catch (err) {
      logger.error('自动获取图标失败', err);
      setError(`获取失败: ${err instanceof Error ? err.message : '网络错误'}`);
    } finally {
      setIsLoading(false);
    }
  }, [websiteUrl]);

  useEffect(() => {
    fetchIcons();
  }, [fetchIcons]);

  const selectedIcon = selectedIndex >= 0 ? icons[selectedIndex] : null;

  const handleCacheToR2 = useCallback(async () => {
    if (!selectedIcon) return;
    setIsCaching(true);

    try {
      const hashInput = `cache_${websiteId || generateId()}_${Date.now()}`;
      const response = await fetch('/api/icon/autofetch/cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          type: 'site',
          hashInput,
          iconDataUrl: selectedIcon.dataUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('缓存失败');
      }

      const result = await response.json();
      if (result.success && result.iconUrl) {
        onSelect(null, result.iconUrl);
      } else {
        throw new Error('缓存返回异常');
      }
    } catch (err) {
      logger.error('缓存图标失败', err);
      setError(`缓存失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsCaching(false);
    }
  }, [selectedIcon, websiteId, authService, onSelect]);

  const handleUseDirectly = useCallback(() => {
    if (!selectedIcon) return;
    onSelect(selectedIcon.dataUrl);
  }, [selectedIcon, onSelect]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}KB`;
  };

  const renderProgress = () => {
    if (!progress) return null;

    const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
      <div className="auto-fetch-progress">
        <div className="auto-fetch-progress-bar">
          <div
            className="auto-fetch-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="auto-fetch-progress-text">
          {progress.message}
          {progress.total > 0 && (
            <span className="auto-fetch-progress-percent"> {percent}%</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="auto-fetch-overlay" onClick={onClose}>
      <div
        className="auto-fetch-dialog"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auto-fetch-header">
          <h3>自动获取图标</h3>
          <button
            className="auto-fetch-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="auto-fetch-content">
          <div className="auto-fetch-info">
            <span className="auto-fetch-info-label">网站：</span>
            <span className="auto-fetch-info-url" title={websiteUrl}>{websiteName || websiteUrl}</span>
          </div>

          {isLoading ? (
            <div className="auto-fetch-loading">
              <div className="auto-fetch-spinner" />
              <p>正在获取图标...</p>
              {renderProgress()}
            </div>
          ) : error ? (
            <div className="auto-fetch-error">
              <div className="auto-fetch-error-icon">⚠️</div>
              <p>{error}</p>
              <button
                className="auto-fetch-retry"
                onClick={fetchIcons}
              >
                重新获取
              </button>
            </div>
          ) : icons.length === 0 ? (
            <div className="auto-fetch-empty">
              <div className="auto-fetch-empty-icon">🔍</div>
              <p>未找到可用图标</p>
              <p className="auto-fetch-empty-hint">该网站可能没有设置图标，或图标已被阻止</p>
            </div>
          ) : (
            <>
              <div className="auto-fetch-results-info">
                共找到 <strong>{icons.length}</strong> 个可用图标，点击选择一个
              </div>
              <div className="auto-fetch-grid">
                {icons.map((icon, index) => (
                  <div
                    key={index}
                    className={`auto-fetch-item ${selectedIndex === index ? 'selected' : ''}`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <img
                      src={icon.dataUrl}
                      alt={`图标 ${index + 1}`}
                      className="auto-fetch-item-img"
                    />
                    <div className="auto-fetch-item-meta">
                      <span className="auto-fetch-item-source">{icon.source}</span>
                      <span className="auto-fetch-item-size">{formatSize(icon.size)}</span>
                    </div>
                    {selectedIndex === index && (
                      <div className="auto-fetch-selected-badge">✓</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="auto-fetch-footer">
          <button
            className="auto-fetch-btn auto-fetch-btn-secondary"
            onClick={handleUseDirectly}
            disabled={!selectedIcon || isCaching || (selectedIcon && selectedIcon.size > 4096)}
          >
            使用
          </button>
          <button
            className="auto-fetch-btn auto-fetch-btn-primary"
            onClick={handleCacheToR2}
            disabled={!selectedIcon || isCaching}
          >
            {isCaching ? '保存中...' : '保存到R2'}
          </button>
          <button
            className="auto-fetch-btn auto-fetch-btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoFetchDialog;
