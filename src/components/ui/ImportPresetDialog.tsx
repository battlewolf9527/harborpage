import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import presetData from '../../data/presetSites.json';
import type { Website } from '../../types';
import { useImport } from '../../hooks/useImport';
import type { DuplicateSite } from '../../hooks/useImport';
import { useTreeSelection } from '../../hooks/useTreeSelection';
import TreeSelector from '../common/TreeSelector';
import { collectSelectedItems } from '../../utils/importExportUtils';
import './ImportPresetDialog.css';

type PresetFolderKey =
  | 'search'
  | 'social'
  | 'video'
  | 'music'
  | 'shopping'
  | 'news'
  | 'dev'
  | 'learning'
  | 'tools'
  | 'other';

/** 预设分类文件夹 id → importExport.presetFolders 的 key（id 是稳定标识，名称走 i18n） */
const PRESET_FOLDER_KEYS: Record<string, PresetFolderKey> = {
  'preset-search': 'search',
  'preset-social': 'social',
  'preset-video': 'video',
  'preset-music': 'music',
  'preset-shopping': 'shopping',
  'preset-news': 'news',
  'preset-dev': 'dev',
  'preset-learning': 'learning',
  'preset-tools': 'tools',
  'preset-other': 'other',
};

interface ImportPresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportPresetDialog: React.FC<ImportPresetDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('importExport');
  const [importStructure, setImportStructure] = useState(true);
  const [overwriteAll, setOverwriteAll] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateSite[]>([]);

  const { findDuplicates, doImport, setDuplicateAction, duplicateAction } = useImport();

  // 预设分类文件夹按当前语言本地化：选择树的展示、以及导入后落库的文件夹名都随之本地化
  const localizedPresetSites = useMemo(() => {
    const localize = (items: Website[]): Website[] =>
      items.map((item) => {
        const folderKey = PRESET_FOLDER_KEYS[item.id];
        const name = folderKey ? t(`presetFolders.${folderKey}`) : item.name;
        return item.children
          ? { ...item, name, children: localize(item.children as Website[]) }
          : { ...item, name };
      });
    return localize(presetData.sites as Website[]);
  }, [t]);

  const selection = useTreeSelection(localizedPresetSites, true);
  const { selectedItems, toggleAll, getAllItemCount } = selection;

  const sitesToImport = useMemo(
    () => collectSelectedItems(localizedPresetSites, selectedItems, importStructure),
    [localizedPresetSites, selectedItems, importStructure]
  );

  const handleImport = useCallback(() => {
    if (!overwriteAll) {
      const foundDuplicates = findDuplicates(sitesToImport);
      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        setShowDuplicateDialog(true);
        return;
      }
    }

    doImport(sitesToImport, importStructure, overwriteAll, duplicateAction);
    onClose();
  }, [sitesToImport, overwriteAll, importStructure, duplicateAction, findDuplicates, doImport, onClose]);

  const handleDuplicateConfirm = useCallback(() => {
    doImport(sitesToImport, importStructure, overwriteAll, duplicateAction);
    setShowDuplicateDialog(false);
    onClose();
  }, [sitesToImport, importStructure, overwriteAll, duplicateAction, doImport, onClose]);

  const handleSetDuplicateAction = useCallback((value: 'ignore' | 'overwrite') => {
    setDuplicateAction(value);
  }, [setDuplicateAction]);

  if (!isOpen) return null;

  return (
    <div className="import-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="import-dialog">
        <div className="import-dialog-header">
          <h2>{t('preset.title')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="import-dialog-body">
          <div className="select-all-row">
            <button className="select-all-btn" onClick={toggleAll}>
              {selectedItems.size === getAllItemCount() ? t('preset.deselectAll') : t('preset.selectAll')}
            </button>
            <span className="selected-count">
              {t('preset.selectedCount', { selected: selectedItems.size, total: getAllItemCount() })}
            </span>
          </div>

          <TreeSelector data={localizedPresetSites} selection={selection} />
        </div>

        <div className="import-dialog-footer">
          <div className="footer-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={importStructure}
                onChange={(e) => setImportStructure(e.target.checked)}
              />
              <span className="label-text">{t('preset.importStructure')}</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={overwriteAll}
                onChange={(e) => setOverwriteAll(e.target.checked)}
              />
              <span className="label-text">{t('preset.overwriteAll')}</span>
            </label>
          </div>

          <div className="action-buttons">
            <button
              className="import-btn"
              onClick={handleImport}
              disabled={selectedItems.size === 0}
            >
              {t('preset.importButton', { count: selectedItems.size })}
            </button>
            <button className="cancel-btn" onClick={onClose}>{t('actions.cancel')}</button>
          </div>
        </div>
      </div>

      {showDuplicateDialog && (
        <div className="duplicate-dialog-overlay">
          <div className="duplicate-dialog">
            <div className="duplicate-dialog-header">
              <h3>{t('duplicate.title')}</h3>
            </div>
            <div className="duplicate-dialog-body">
              <p>{t('duplicate.message')}</p>
              <ul className="duplicate-list">
                {duplicates.map((dup) => (
                  <li key={`${dup.name}-${dup.location}`}>
                    <span className="site-name">{dup.name}</span>
                    <span className="site-location">
                      {t('duplicate.location', {
                        location: dup.location === 'desktop'
                          ? t('duplicate.desktop')
                          : t('duplicate.folder', { name: dup.location }),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="action-radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="duplicate-action"
                    value="ignore"
                    checked={duplicateAction === 'ignore'}
                    onChange={() => handleSetDuplicateAction('ignore')}
                  />
                  <span>{t('duplicate.ignore')}</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="duplicate-action"
                    value="overwrite"
                    checked={duplicateAction === 'overwrite'}
                    onChange={() => handleSetDuplicateAction('overwrite')}
                  />
                  <span>{t('duplicate.overwrite')}</span>
                </label>
              </div>
            </div>
            <div className="duplicate-dialog-footer">
              <button
                className="confirm-btn"
                onClick={handleDuplicateConfirm}
              >
                {t('duplicate.confirm')}
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowDuplicateDialog(false)}
              >
                {t('actions.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPresetDialog;