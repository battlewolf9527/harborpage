import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('icons');
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
        <span className="favicon-settings-title">{t('faviconSettings.title')}</span>
        <div className="favicon-settings-actions">
          <button
            className="favicon-btn favicon-btn-add"
            onClick={openAddDialog}
          >
            {t('faviconSettings.addSource')}
          </button>
          <button
            className="favicon-btn favicon-btn-reset"
            onClick={handleResetDefaults}
          >
            {t('faviconSettings.resetDefaults')}
          </button>
        </div>
      </div>

      <p className="favicon-settings-hint">
        {t('faviconSettings.hintPrefix')}<code>{'{domain}'}</code>{t('faviconSettings.hintSuffix')}
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
            <div className="favicon-source-drag" title={t('faviconSettings.dragToSort')}>⋮⋮</div>

            <div className="favicon-source-priority">
              {index + 1}
            </div>

            <div className="favicon-source-content">
              <div className="favicon-source-name">
                {source.name}
                {isBuiltIn(source) && <span className="favicon-builtin-badge">{t('faviconSettings.builtIn')}</span>}
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
                    title={t('faviconSettings.edit')}
                  >
                    ✎
                  </button>
                  <button
                    className="favicon-icon-btn favicon-icon-btn-delete"
                    onClick={() => setDeleteTarget({ index, source })}
                    title={t('faviconSettings.delete')}
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
            <h4>{dialog.mode === 'add' ? t('faviconSettings.addTitle') : t('faviconSettings.editTitle')}</h4>
            <div className="favicon-add-form">
              <div className="favicon-add-field">
                <label>{t('faviconSettings.name')}</label>
                <input
                  type="text"
                  value={dialog.name}
                  onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  placeholder={t('faviconSettings.namePlaceholder')}
                  autoFocus
                />
              </div>
              <div className="favicon-add-field">
                <label>{t('faviconSettings.urlTemplate')} <span className="favicon-required">*</span></label>
                <input
                  type="text"
                  value={dialog.urlTemplate}
                  onChange={(e) => setDialog({ ...dialog, urlTemplate: e.target.value })}
                  placeholder={t('faviconSettings.urlTemplatePlaceholder')}
                />
                <span className="favicon-field-hint">{t('faviconSettings.urlTemplateHint')}</span>
              </div>
            </div>
            <div className="favicon-add-actions">
              <button
                className="favicon-btn favicon-btn-save"
                onClick={handleSaveDialog}
                disabled={!isDialogValid}
              >
                {dialog.mode === 'add' ? t('faviconSettings.add') : t('faviconSettings.save')}
              </button>
              <button
                className="favicon-btn favicon-btn-cancel"
                onClick={closeDialog}
              >
                {t('faviconSettings.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="favicon-add-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="favicon-add-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>{t('faviconSettings.deleteTitle')}</h4>
            <p className="favicon-confirm-text">
              {t('faviconSettings.deleteConfirmPrefix')}<strong>{deleteTarget.source.name}</strong>{t('faviconSettings.deleteConfirmSuffix')}
              <br />
              {t('faviconSettings.deleteIrreversible')}
            </p>
            <div className="favicon-add-actions">
              <button
                className="favicon-btn favicon-btn-delete-confirm"
                onClick={() => deleteSource(deleteTarget.index)}
              >
                {t('faviconSettings.delete')}
              </button>
              <button
                className="favicon-btn favicon-btn-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                {t('faviconSettings.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FaviconSettings;
