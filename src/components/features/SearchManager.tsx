import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './SearchManager.css';
import { useSearchSelector } from '../../store/selectors';
import { IconType, getFaviconUrl } from '../../services/IconManager';
import type { SearchEngine } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';
import { renderSearchEngineIcon, preloadIconForUrl } from '../../services/iconUtils';
import { getServices } from '../../services/serviceContainer';
import createLogger from '../../utils/logger';
import { generateId } from '../../utils/idUtils';
import { useListPointerReorder } from '../../hooks/useListPointerReorder';

const logger = createLogger('SearchManager');

type DialogMode = 'add' | 'edit';
interface DialogState {
  mode: DialogMode;
  engineId?: string;
  name: string;
  url: string;
  icon: string;
}

const SearchManager: React.FC = () => {
  const { t } = useTranslation('search');
  const { iconManager } = getServices();
  const { searchEngines, defaultSearchEngineId, setSearchEngines, setDefaultSearchEngineId } = useSearchSelector();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [engineToDelete, setEngineToDelete] = useState<string | null>(null);

  const selectedEngine = useMemo(() => {
    if (defaultSearchEngineId && searchEngines.some(e => e.id === defaultSearchEngineId)) {
      return defaultSearchEngineId;
    }
    return searchEngines[0]?.id || '';
  }, [searchEngines, defaultSearchEngineId]);

  const handleSetDefault = useCallback((engineId: string) => {
    setDefaultSearchEngineId(engineId);
  }, [setDefaultSearchEngineId]);

  const openAddDialog = useCallback(() => {
    setDialog({ mode: 'add', name: '', url: '', icon: '' });
  }, [setDialog]);

  const openEditDialog = useCallback((engine: SearchEngine) => {
    setDialog({
      mode: 'edit',
      engineId: engine.id,
      name: engine.name,
      url: engine.url,
      icon: engine.icon,
    });
  }, [setDialog]);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, [setDialog]);

  const handleSaveDialog = async () => {
    if (!dialog) return;
    if (!dialog.name.trim() || !dialog.url.trim()) return;
    if (!dialog.url.includes('{q}')) {
      logger.error('Search URL must contain the {q} placeholder');
      return;
    }

    if (dialog.mode === 'add') {
      const id = generateId();
      const iconInput = dialog.icon.trim();
      await preloadIconForUrl(iconManager, 'search', id, dialog.url, iconInput);

      const engine: SearchEngine = {
        id,
        name: dialog.name.trim(),
        url: dialog.url.trim(),
        icon: iconInput,
      };
      setSearchEngines([...searchEngines, engine]);
    } else if (dialog.mode === 'edit' && dialog.engineId) {
      const engineId = dialog.engineId;
      const originalEngine = searchEngines.find(e => e.id === engineId);

      if (originalEngine && originalEngine.url !== dialog.url.trim() && !dialog.icon.trim()) {
        try {
          const domain = new URL(dialog.url).hostname;
          const downloadUrl = getFaviconUrl(domain);
          iconManager.preloadIcon('search', engineId, downloadUrl, domain).catch(() => { /* ignore */ });
        } catch { /* ignore */ }
      }

      const updatedEngines = searchEngines.map(engine =>
        engine.id === engineId
          ? { ...engine, name: dialog.name.trim(), url: dialog.url.trim(), icon: dialog.icon.trim() }
          : engine
      );
      setSearchEngines(updatedEngines);
    }

    setDialog(null);
  };

  const isDialogValid = dialog !== null &&
    dialog.name.trim().length > 0 &&
    dialog.url.trim().length > 0 &&
    dialog.url.includes('{q}');

  const handleDeleteEngine = (id: string) => {
    setEngineToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (engineToDelete && searchEngines.length > 1) {
      const updatedEngines = searchEngines.filter(engine => engine.id !== engineToDelete);
      setSearchEngines(updatedEngines);
      setShowDeleteConfirm(false);
      setEngineToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setEngineToDelete(null);
  };

  // ── 拖拽排序（Pointer Events，桌面与触屏同一套代码）──────────────────────
  // 即时重排：指针越过谁就立刻把被拖项移到谁的位置并落库（原实现在 dragover 里就是这么做的）。
  // 打开编辑/新增弹窗时禁止起拖，避免与弹窗交互冲突。
  const { draggingKey, getItemProps } = useListPointerReorder({
    keys: searchEngines.map((engine) => engine.id),
    live: true,
    canStart: () => dialog === null,
    onReorder: (from, over) => {
      const newEngines = [...searchEngines];
      const [moved] = newEngines.splice(from, 1);
      newEngines.splice(over, 0, moved);
      setSearchEngines(newEngines);
    },
  });

  return (
    <div className="search-manager">
      <h3>{t('manager.title')}</h3>

      <div className="add-engine">
        <button
          className="action-button"
          onClick={openAddDialog}
        >
          {t('manager.addEngine')}
        </button>
      </div>

      <div className="engine-list">
        <h4>{t('manager.engineList')}</h4>
        <div className="engine-items">
          {searchEngines.map((engine) => (
            <div
              key={engine.id}
              {...getItemProps(engine.id)}
              className={`engine-item ${draggingKey === engine.id ? 'dragging' : ''}`}
            >
              <div className="engine-drag-handle" title={t('manager.dragToSort')}>⋮⋮</div>

              <div className="engine-info">
                {renderSearchEngineIcon(
                  engine,
                  iconManager.getIconUrlSync(IconType.SEARCH, engine),
                  'engine-favicon',
                  'engine-icon'
                )}
                <span className="engine-name">{engine.name}</span>
                {engine.id === selectedEngine && (
                  <span className="default-badge">{t('manager.defaultBadge')}</span>
                )}
              </div>

              <div className="engine-actions">
                <button
                  className={`engine-action-btn engine-action-default ${engine.id === selectedEngine ? 'active' : ''}`}
                  onClick={() => handleSetDefault(engine.id)}
                  title={engine.id === selectedEngine ? t('manager.currentDefault') : t('manager.setAsDefault')}
                >
                  {engine.id === selectedEngine ? '★' : '☆'}
                </button>
                <button
                  className="engine-action-btn engine-action-edit"
                  onClick={() => openEditDialog(engine)}
                  title={t('manager.edit')}
                >
                  ✎
                </button>
                <button
                  className="engine-action-btn engine-action-delete"
                  onClick={() => handleDeleteEngine(engine.id)}
                  disabled={searchEngines.length <= 1}
                  title={t('manager.delete')}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {dialog && (
        <div className="engine-dialog-overlay" onClick={closeDialog}>
          <div className="engine-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>{dialog.mode === 'add' ? t('manager.addEngine') : t('manager.editEngine')}</h4>
            <div className="engine-dialog-form">
              <div className="engine-dialog-field">
                <label>{t('manager.name')}</label>
                <input
                  type="text"
                  placeholder={t('manager.namePlaceholder')}
                  value={dialog.name}
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="engine-dialog-field">
                <label>{t('manager.url')} <span className="engine-required">*</span></label>
                <input
                  type="text"
                  placeholder="https://example.com/search?q={q}"
                  value={dialog.url}
                  onChange={(e) => setDialog({ ...dialog, url: e.target.value })}
                />
                <span className="engine-field-hint">{t('manager.urlHint')}</span>
              </div>
              <div className="engine-dialog-field">
                <label>{t('manager.icon')}</label>
                <input
                  type="text"
                  placeholder={t('manager.iconPlaceholder')}
                  value={dialog.icon}
                  onChange={(e) => setDialog({ ...dialog, icon: e.target.value })}
                />
              </div>
            </div>
            <div className="engine-dialog-actions">
              <button
                className="engine-btn engine-btn-primary"
                onClick={handleSaveDialog}
                disabled={!isDialogValid}
              >
                {dialog.mode === 'add' ? t('manager.add') : t('manager.save')}
              </button>
              <button
                className="engine-btn engine-btn-cancel"
                onClick={closeDialog}
              >
                {t('manager.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('manager.deleteTitle')}
        message={t('manager.deleteMessage')}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default SearchManager;
