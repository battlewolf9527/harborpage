import React, { useState, useCallback, useMemo } from 'react';
import presetData from '../../data/presetSites.json';
import { useImport } from '../../hooks/useImport';
import type { DuplicateSite } from '../../hooks/useImport';
import { useTreeSelection } from '../../hooks/useTreeSelection';
import TreeSelector from '../common/TreeSelector';
import { collectSelectedItems } from '../../utils/importExportUtils';
import './ImportPresetDialog.css';

interface ImportPresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ImportPresetDialog: React.FC<ImportPresetDialogProps> = ({ isOpen, onClose }) => {
  const [importStructure, setImportStructure] = useState(true);
  const [overwriteAll, setOverwriteAll] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateSite[]>([]);

  const { findDuplicates, doImport, setDuplicateAction, duplicateAction } = useImport();

  const selection = useTreeSelection(presetData.sites, true);
  const { selectedItems, toggleAll, getAllItemCount } = selection;

  const sitesToImport = useMemo(
    () => collectSelectedItems(presetData.sites, selectedItems, importStructure),
    [selectedItems, importStructure]
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
          <h2>导入预设站点</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="import-dialog-body">
          <div className="select-all-row">
            <button className="select-all-btn" onClick={toggleAll}>
              {selectedItems.size === getAllItemCount() ? '取消全选' : '全选'}
            </button>
            <span className="selected-count">
              已选择 {selectedItems.size} / {getAllItemCount()} 项
            </span>
          </div>

          <TreeSelector data={presetData.sites} selection={selection} />
        </div>

        <div className="import-dialog-footer">
          <div className="footer-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={importStructure}
                onChange={(e) => setImportStructure(e.target.checked)}
              />
              <span className="label-text">导入目录结构</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={overwriteAll}
                onChange={(e) => setOverwriteAll(e.target.checked)}
              />
              <span className="label-text">覆盖所有已存在的站点</span>
            </label>
          </div>

          <div className="action-buttons">
            <button className="cancel-btn" onClick={onClose}>取消</button>
            <button
              className="import-btn"
              onClick={handleImport}
              disabled={selectedItems.size === 0}
            >
              导入 ({selectedItems.size})
            </button>
          </div>
        </div>
      </div>

      {showDuplicateDialog && (
        <div className="duplicate-dialog-overlay">
          <div className="duplicate-dialog">
            <div className="duplicate-dialog-header">
              <h3>发现重复站点</h3>
            </div>
            <div className="duplicate-dialog-body">
              <p>以下站点已存在于您的桌面或目录中：</p>
              <ul className="duplicate-list">
                {duplicates.map((dup) => (
                  <li key={`${dup.name}-${dup.location}`}>
                    <span className="site-name">{dup.name}</span>
                    <span className="site-location">
                      位置：{dup.location === 'desktop' ? '桌面' : `目录「${dup.location}」`}
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
                  <span>忽略重复站点</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="duplicate-action"
                    value="overwrite"
                    checked={duplicateAction === 'overwrite'}
                    onChange={() => handleSetDuplicateAction('overwrite')}
                  />
                  <span>覆盖重复站点</span>
                </label>
              </div>
            </div>
            <div className="duplicate-dialog-footer">
              <button
                className="cancel-btn"
                onClick={() => setShowDuplicateDialog(false)}
              >
                取消
              </button>
              <button
                className="confirm-btn"
                onClick={handleDuplicateConfirm}
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportPresetDialog;