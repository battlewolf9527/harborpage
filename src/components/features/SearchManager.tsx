import React, { useState, useMemo, useCallback } from 'react';
import './SearchManager.css';
import { useSearchSelector } from '../../store/selectors';
import { IconType, getFaviconUrl } from '../../services/IconManager';
import type { SearchEngine } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';
import { renderSearchEngineIcon, preloadIconForUrl } from '../../services/iconUtils';
import { getServices } from '../../services/serviceContainer';
import createLogger from '../../utils/logger';
import { generateId } from '../../utils/idUtils';

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
  const { iconManager } = getServices();
  const { searchEngines, defaultSearchEngineId, setSearchEngines, setDefaultSearchEngineId } = useSearchSelector();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
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
      logger.error('搜索 URL 必须包含 {q} 占位符');
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

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newEngines = [...searchEngines];
    const [moved] = newEngines.splice(dragIndex, 1);
    newEngines.splice(index, 0, moved);
    setDragIndex(index);
    setSearchEngines(newEngines);
  }, [dragIndex, searchEngines, setSearchEngines]);

  const handleDrop = useCallback(() => {
    if (dragIndex !== null) {
      setSearchEngines([...searchEngines]);
    }
    setDragIndex(null);
  }, [dragIndex, searchEngines, setSearchEngines]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  return (
    <div className="search-manager">
      <h3>搜索设置</h3>

      <div className="add-engine">
        <button
          className="action-button"
          onClick={openAddDialog}
        >
          添加搜索引擎
        </button>
      </div>

      <div className="engine-list">
        <h4>搜索引擎列表</h4>
        <div className="engine-items">
          {searchEngines.map((engine, index) => (
            <div
              key={engine.id}
              className={`engine-item ${dragIndex === index ? 'dragging' : ''}`}
              draggable={dialog === null}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              <div className="engine-drag-handle" title="拖拽排序">⋮⋮</div>

              <div className="engine-info">
                {renderSearchEngineIcon(
                  engine,
                  iconManager.getIconUrlSync(IconType.SEARCH, engine),
                  'engine-favicon',
                  'engine-icon'
                )}
                <span className="engine-name">{engine.name}</span>
                {engine.id === selectedEngine && (
                  <span className="default-badge">默认</span>
                )}
              </div>

              <div className="engine-actions">
                <button
                  className={`engine-action-btn engine-action-default ${engine.id === selectedEngine ? 'active' : ''}`}
                  onClick={() => handleSetDefault(engine.id)}
                  title={engine.id === selectedEngine ? '当前默认' : '设为默认'}
                >
                  {engine.id === selectedEngine ? '★' : '☆'}
                </button>
                <button
                  className="engine-action-btn engine-action-edit"
                  onClick={() => openEditDialog(engine)}
                  title="编辑"
                >
                  ✎
                </button>
                <button
                  className="engine-action-btn engine-action-delete"
                  onClick={() => handleDeleteEngine(engine.id)}
                  disabled={searchEngines.length <= 1}
                  title="删除"
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
            <h4>{dialog.mode === 'add' ? '添加搜索引擎' : '编辑搜索引擎'}</h4>
            <div className="engine-dialog-form">
              <div className="engine-dialog-field">
                <label>名称</label>
                <input
                  type="text"
                  placeholder="搜索引擎名称"
                  value={dialog.name}
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="engine-dialog-field">
                <label>搜索URL <span className="engine-required">*</span></label>
                <input
                  type="text"
                  placeholder="https://example.com/search?q={q}"
                  value={dialog.url}
                  onChange={(e) => setDialog({ ...dialog, url: e.target.value })}
                />
                <span className="engine-field-hint">使用 {'{q}'} 作为查询参数占位符</span>
              </div>
              <div className="engine-dialog-field">
                <label>图标</label>
                <input
                  type="text"
                  placeholder="留空自动获取favicon，或输入图标URL/Emoji"
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
                {dialog.mode === 'add' ? '添加' : '保存'}
              </button>
              <button
                className="engine-btn engine-btn-cancel"
                onClick={closeDialog}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="删除搜索引擎"
        message="确定要删除这个搜索引擎吗？"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default SearchManager;
