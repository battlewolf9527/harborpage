import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('icons');
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
    setProgress({ phase: 'fetching_candidates', current: 0, total: 0, message: t('autoFetch.analyzingPage') });

    try {
      const results = await autoFetchService.fetchAllIcons(websiteUrl, (p) => {
        setProgress(p);
      });

      if (results.length > 0) {
        setIcons(results);
        setSelectedIndex(0);
      } else {
        setError(t('autoFetch.noIconsFound'));
      }
    } catch (err) {
      logger.error(t('autoFetch.fetchIconsFailed'), err);
      setError(t('autoFetch.fetchFailed', {
        message: err instanceof Error ? err.message : t('autoFetch.networkError'),
      }));
    } finally {
      setIsLoading(false);
    }
  }, [websiteUrl, t]);

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
        throw new Error(t('autoFetch.cacheFailed'));
      }

      const result = await response.json();
      if (result.success && result.iconUrl) {
        onSelect(null, result.iconUrl);
      } else {
        throw new Error(t('autoFetch.cacheResultInvalid'));
      }
    } catch (err) {
      logger.error(t('autoFetch.cacheIconFailed'), err);
      setError(t('autoFetch.cacheFailedWithMessage', {
        message: err instanceof Error ? err.message : t('autoFetch.unknownError'),
      }));
    } finally {
      setIsCaching(false);
    }
  }, [selectedIcon, websiteId, authService, onSelect, t]);

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
          <h3>{t('autoFetch.title')}</h3>
          <button
            className="auto-fetch-close"
            onClick={onClose}
            aria-label={t('autoFetch.close')}
          >
            ✕
          </button>
        </div>

        <div className="auto-fetch-content">
          <div className="auto-fetch-info">
            <span className="auto-fetch-info-label">{t('autoFetch.websiteLabel')}</span>
            <span className="auto-fetch-info-url" title={websiteUrl}>{websiteName || websiteUrl}</span>
          </div>

          {isLoading ? (
            <div className="auto-fetch-loading">
              <div className="auto-fetch-spinner" />
              <p>{t('autoFetch.loading')}</p>
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
                {t('autoFetch.retry')}
              </button>
            </div>
          ) : icons.length === 0 ? (
            <div className="auto-fetch-empty">
              <div className="auto-fetch-empty-icon">🔍</div>
              <p>{t('autoFetch.empty')}</p>
              <p className="auto-fetch-empty-hint">{t('autoFetch.emptyHint')}</p>
            </div>
          ) : (
            <>
              <div className="auto-fetch-results-info">
                {t('autoFetch.resultsInfoPrefix')}<strong>{icons.length}</strong>{t('autoFetch.resultsInfoSuffix')}
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
                      alt={t('autoFetch.iconAlt', { index: index + 1 })}
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
            {t('autoFetch.use')}
          </button>
          <button
            className="auto-fetch-btn auto-fetch-btn-primary"
            onClick={handleCacheToR2}
            disabled={!selectedIcon || isCaching}
          >
            {isCaching ? t('autoFetch.saving') : t('autoFetch.saveToR2')}
          </button>
          <button
            className="auto-fetch-btn auto-fetch-btn-secondary"
            onClick={onClose}
          >
            {t('autoFetch.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutoFetchDialog;
