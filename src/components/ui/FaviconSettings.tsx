import React, { useState, useCallback } from 'react';
import type { FaviconSource } from '../../types';
import FaviconConfigService from '../../services/FaviconConfigService';
import './FaviconSettings.css';

interface FaviconSettingsProps {
  onSourcesChange?: (sources: FaviconSource[]) => void;
}

type DialogMode = 'add' | 'edit';
interface DialogState {
  mode: DialogMode;
  index?: number;
  name: string;
  urlTemplate: string;
}

const FaviconSettings: React.FC<FaviconSettingsProps> = ({ onSourcesChange }) => {
  const [sources, setSources] = useState<FaviconSource[]>(() => FaviconConfigService.getSources());
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; source: FaviconSource } | null>(null);

  const isBuiltIn = (source: FaviconSource): boolean => {
    return FaviconConfigService.getDefaultSources().some(s => s.id === source.id);
  };

  const updateSources = useCallback((newSources: FaviconSource[]) => {
    setSources(newSources);
    FaviconConfigService.saveSources(newSources);
    onSourcesChange?.(newSources);
  }, [onSourcesChange]);

  const toggleEnabled = useCallback((index: number) => {
    const newSources = [...sources];
    newSources[index] = { ...newSources[index], enabled: !newSources[index].enabled };
    updateSources(newSources);
  }, [sources, updateSources]);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newSources = [...sources];
    const [moved] = newSources.splice(dragIndex, 1);
    newSources.splice(index, 0, moved);
    setDragIndex(index);
    setSources(newSources);
  }, [dragIndex, sources]);

  const handleDrop = useCallback(() => {
    if (dragIndex !== null) {
      FaviconConfigService.saveSources(sources);
      onSourcesChange?.(sources);
    }
    setDragIndex(null);
  }, [dragIndex, sources, onSourcesChange]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  const deleteSource = useCallback((index: number) => {
    const source = sources[index];
    if (isBuiltIn(source)) return;
    const newSources = sources.filter((_, i) => i !== index);
    updateSources(newSources);
    setDeleteTarget(null);
  }, [sources, updateSources]);

  const openAddDialog = useCallback(() => {
    setDialog({ mode: 'add', name: '', urlTemplate: '' });
  }, []);

  const openEditDialog = useCallback((index: number) => {
    const source = sources[index];
    setDialog({ mode: 'edit', index, name: source.name, urlTemplate: source.urlTemplate });
  }, [sources]);

  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const handleSaveDialog = useCallback(() => {
    if (!dialog) return;
    if (!dialog.name.trim() || !dialog.urlTemplate.trim()) return;
    if (!dialog.urlTemplate.includes('{domain}')) return;

    if (dialog.mode === 'add') {
      const newEntry: FaviconSource = {
        id: `custom_${Date.now()}`,
        name: dialog.name.trim(),
        urlTemplate: dialog.urlTemplate.trim(),
        enabled: true,
      };
      updateSources([...sources, newEntry]);
    } else if (dialog.mode === 'edit' && dialog.index !== undefined) {
      const newSources = [...sources];
      newSources[dialog.index] = {
        ...newSources[dialog.index],
        name: dialog.name.trim(),
        urlTemplate: dialog.urlTemplate.trim(),
      };
      updateSources(newSources);
    }

    setDialog(null);
  }, [dialog, sources, updateSources]);

  const handleResetDefaults = useCallback(() => {
    const defaults = FaviconConfigService.getDefaultSources();
    updateSources(defaults);
  }, [updateSources]);

  const isDialogValid = dialog !== null &&
    dialog.name.trim().length > 0 &&
    dialog.urlTemplate.trim().length > 0 &&
    dialog.urlTemplate.includes('{domain}');

  return (
    <div className="favicon-settings">
      <div className="favicon-settings-header">
        <span className="favicon-settings-title">图标源配置</span>
        <div className="favicon-settings-actions">
          <button
            className="favicon-btn favicon-btn-add"
            onClick={openAddDialog}
          >
            添加源
          </button>
          <button
            className="favicon-btn favicon-btn-reset"
            onClick={handleResetDefaults}
          >
            重置默认
          </button>
        </div>
      </div>

      <p className="favicon-settings-hint">
        配置图标获取源，支持拖拽调整顺序，按优先级依次尝试。URL 模板中使用 <code>{'{domain}'}</code> 作为域名占位符。
      </p>

      <div className="favicon-sources-list">
        {sources.map((source, index) => (
          <div
            key={source.id}
            className={`favicon-source-item ${dragIndex === index ? 'dragging' : ''} ${!source.enabled ? 'disabled' : ''}`}
            draggable={dialog !== null}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            <div className="favicon-source-drag" title="拖拽排序">⋮⋮</div>

            <div className="favicon-source-priority">
              {index + 1}
            </div>

            <div className="favicon-source-content">
              <div className="favicon-source-name">
                {source.name}
                {isBuiltIn(source) && <span className="favicon-builtin-badge">内置</span>}
              </div>
              <div className="favicon-source-url" title={source.urlTemplate}>
                {source.urlTemplate}
              </div>
            </div>

            <div className="favicon-source-controls">
              {dialog === null && !isBuiltIn(source) && (
                <>
                  <button
                    className="favicon-icon-btn"
                    onClick={() => openEditDialog(index)}
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    className="favicon-icon-btn favicon-icon-btn-delete"
                    onClick={() => setDeleteTarget({ index, source })}
                    title="删除"
                  >
                    ×
                  </button>
                </>
              )}
              <label className="favicon-toggle">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={() => toggleEnabled(index)}
                  disabled={dialog !== null}
                />
                <span className="favicon-toggle-slider" />
              </label>
            </div>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="favicon-add-overlay" onClick={closeDialog}>
          <div className="favicon-add-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>{dialog.mode === 'add' ? '添加图标源' : '编辑图标源'}</h4>
            <div className="favicon-add-form">
              <div className="favicon-add-field">
                <label>名称</label>
                <input
                  type="text"
                  value={dialog.name}
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  placeholder="例如: 我的图标源"
                  autoFocus
                />
              </div>
              <div className="favicon-add-field">
                <label>URL 模板 <span className="favicon-required">*</span></label>
                <input
                  type="text"
                  value={dialog.urlTemplate}
                  onChange={(e) => setDialog({ ...dialog, urlTemplate: e.target.value })}
                  placeholder="https://example.com/favicon?domain={domain}"
                />
                <span className="favicon-field-hint">使用 {'{domain}'} 作为域名占位符</span>
              </div>
            </div>
            <div className="favicon-add-actions">
              <button
                className="favicon-btn favicon-btn-save"
                onClick={handleSaveDialog}
                disabled={!isDialogValid}
              >
                {dialog.mode === 'add' ? '添加' : '保存'}
              </button>
              <button
                className="favicon-btn favicon-btn-cancel"
                onClick={closeDialog}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="favicon-add-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="favicon-add-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>删除图标源</h4>
            <p className="favicon-confirm-text">
              确定要删除 <strong>{deleteTarget.source.name}</strong> 吗？
              <br />
              删除后将无法恢复。
            </p>
            <div className="favicon-add-actions">
              <button
                className="favicon-btn favicon-btn-delete-confirm"
                onClick={() => deleteSource(deleteTarget.index)}
              >
                删除
              </button>
              <button
                className="favicon-btn favicon-btn-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaviconSettings;
