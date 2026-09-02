import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Toast from '../common/Toast';
import { getServices } from '../../services/serviceContainer';
import { useImportStore } from '../../store/useImportStore';
import {
  buildFullExportData,
  validateFullImportData,
  downloadFullExportFile,
  readImportFile,
  restoreIsFolder,
  mergeById,
  type FullExportData,
  type DataSelection,
} from '../../utils/importExportUtils';
import { EXPORT_FILE_PREFIX } from '../../constants';
import type { UserData, Website, Page } from '../../types';
import { generateId } from '../../utils/idUtils';
import { DEFAULT_PAGE_NAME } from '../../store/usePagesStore';
import './ImportExport.css';

// 数据分类配置
type CategoryKey = keyof DataSelection;

interface CategoryConfig {
  key: CategoryKey;
  label: string;
}

const DATA_CATEGORIES: CategoryConfig[] = [
  { key: 'searchEngines', label: '搜索引擎' },
  { key: 'pages', label: '页面（含网站）' },
  { key: 'websites', label: '网站（旧格式）' },
  { key: 'todos', label: '待办列表' },
  { key: 'notes', label: '笔记' },
  { key: 'settings', label: '其它设置' },
];

const ALL_SELECTED: DataSelection = {
  searchEngines: true,
  pages: true,
  websites: true,
  todos: true,
  notes: true,
  settings: true,
};

interface ImportPreview {
  raw: FullExportData;
  available: DataSelection;
  counts: Record<CategoryKey, number | null> & { pageSiteCount: number };
}

interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

const buildDefaultFilename = (): string =>
  `${EXPORT_FILE_PREFIX}_${new Date().toISOString().slice(0, 10)}`;

// 递归统计网站数量（排除文件夹本身，只计实际网站）
const countWebsites = (list: Website[] | undefined): number => {
  if (!list) return 0;
  let count = 0;
  for (const item of list) {
    if (item.children?.length) {
      count += countWebsites(item.children);
    } else {
      count++;
    }
  }
  return count;
};

const buildImportSummary = (data: FullExportData): string => {
  const parts: string[] = [];
  if (data.pages?.length) {
    let totalSites = 0;
    for (const page of data.pages) {
      totalSites += countWebsites(page.websites);
    }
    parts.push(`页面 ${data.pages.length} 个（共 ${totalSites} 个站点）`);
  } else {
    const siteCount = countWebsites(data.websites);
    if (siteCount) parts.push(`站点 ${siteCount} 个`);
  }
  if (data.searchEngines?.length) parts.push(`搜索引擎 ${data.searchEngines.length} 个`);
  if (data.todos?.length) parts.push(`待办 ${data.todos.length} 条`);
  if (data.notes?.length) parts.push(`笔记 ${data.notes.length} 条`);
  if (data.settings) parts.push('设置项');
  if (parts.length === 0) return '文件中无有效数据。';
  return `文件包含：${parts.join('，')}。`;
};

const ImportExport: React.FC = () => {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [filename, setFilename] = useState('');
  const [exportSelection, setExportSelection] = useState<DataSelection>(ALL_SELECTED);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importSelection, setImportSelection] = useState<DataSelection>(ALL_SELECTED);
  const [toast, setToast] = useState<ToastState | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const startImport = useImportStore((s) => s.startImport);

  const handleExportClick = useCallback(() => {
    setFilename(buildDefaultFilename());
    setExportSelection(ALL_SELECTED);
    setShowExportDialog(true);
  }, []);

  const hasExportSelection = useMemo(
    () => Object.values(exportSelection).some(v => v),
    [exportSelection],
  );

  const handleConfirmExport = useCallback(() => {
    const dataManager = getServices().dataManager;
    const exportData = buildFullExportData(dataManager.getData(), exportSelection);
    const name = filename.trim() || buildDefaultFilename();
    downloadFullExportFile(exportData, name);
    setShowExportDialog(false);
    setToast({ type: 'success', message: '导出成功' });
  }, [filename, exportSelection]);

  const handleCancelExport = useCallback(() => {
    setShowExportDialog(false);
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const raw = await readImportFile(file);
      if (!validateFullImportData(raw)) {
        setToast({ type: 'error', message: '文件格式无效或数据不完整' });
        return;
      }
      // 统计 pages 中的总站点数
      let pageSiteCount = 0;
      if (raw.pages?.length) {
        for (const page of raw.pages) {
          pageSiteCount += countWebsites(page.websites);
        }
      }
      const available: DataSelection = {
        searchEngines: !!(raw.searchEngines?.length),
        pages: !!(raw.pages?.length),
        websites: countWebsites(raw.websites) > 0,
        todos: !!(raw.todos?.length),
        notes: !!(raw.notes?.length),
        settings: !!raw.settings,
      };
      const counts: ImportPreview['counts'] = {
        searchEngines: raw.searchEngines?.length ?? null,
        pages: raw.pages?.length ?? null,
        pageSiteCount,
        websites: countWebsites(raw.websites) || null,
        todos: raw.todos?.length ?? null,
        notes: raw.notes?.length ?? null,
        settings: null,
      };
      setImportSelection({ ...available });
      setImportPreview({ raw, available, counts });
    } catch {
      setToast({ type: 'error', message: '读取文件失败' });
    }
  }, []);

  const hasImportSelection = useMemo(() => {
    if (!importPreview) return false;
    return (Object.keys(importSelection) as CategoryKey[]).some(
      key => importSelection[key] && importPreview.available[key],
    );
  }, [importSelection, importPreview]);

  const handleApplyImport = useCallback((mode: 'overwrite' | 'merge') => {
    if (!importPreview) return;
    const dataManager = getServices().dataManager;
    const current = dataManager.getData();
    const raw = importPreview.raw;

    // 旧格式迁移：导入文件只有根级 websites 但无 pages 时，把旧网站包装成默认页面
    // 这样后续链路走 pages 通路，不再依赖 legacyWebsites 分支（pages 非空时会被直接使用）
    const rawHasLegacyWebsites =
      importSelection.websites && raw.websites && raw.websites.length > 0;
    let migratedPagesFromLegacy: Page[] | null = null;
    if (rawHasLegacyWebsites && (!raw.pages || raw.pages.length === 0)) {
      const restoredLegacyWebsites = restoreIsFolder(raw.websites!);
      // upsert 同名默认页：current 里已有叫"默认页面"的页就复用 id 并合并 websites，避免产生两个重名默认页
      const existingDefaultInCurrent = (current.pages ?? []).find(p => p.name === DEFAULT_PAGE_NAME);
      if (existingDefaultInCurrent) {
        migratedPagesFromLegacy = [{
          ...existingDefaultInCurrent,
          websites: mergeById(existingDefaultInCurrent.websites, restoredLegacyWebsites),
        }];
      } else {
        migratedPagesFromLegacy = [{
          id: generateId('page-'),
          name: DEFAULT_PAGE_NAME,
          websites: restoredLegacyWebsites,
          createdAt: Date.now(),
        }];
      }
    }

    // 计算 pages：勾选 pages 时优先 raw.pages，否则若有迁移页用迁移页；未勾选则保留当前
    const rawPagesRestored = (raw.pages ?? []).map(page => ({
      ...page,
      websites: restoreIsFolder(page.websites),
    }));
    const resolvedPagesForSelection: Page[] = importSelection.pages
      ? (rawPagesRestored.length > 0 ? rawPagesRestored : (migratedPagesFromLegacy ?? []))
      : (current.pages ?? []);

    // 构建导入数据：未勾选的分类使用当前数据填充
    const imported: UserData = {
      websites: importSelection.websites
        ? restoreIsFolder(raw.websites ?? [])
        : (current.websites ?? []),
      pages: resolvedPagesForSelection,
      searchEngines: importSelection.searchEngines
        ? (raw.searchEngines ?? [])
        : (current.searchEngines ?? []),
      todos: importSelection.todos
        ? (raw.todos ?? [])
        : (current.todos ?? []),
      notes: importSelection.notes
        ? (raw.notes ?? [])
        : (current.notes ?? []),
    };
    // currentPageId 赋值：
    // - 如果做了上游旧格式迁移（默认页面已重建/合并网站），强制切到迁移页；
    // - 否则勾选 pages 时优先用导入文件的 currentPageId，其次用当前的
    // 条件赋值避免 exactOptionalPropertyTypes 报错
    if (migratedPagesFromLegacy && migratedPagesFromLegacy.length > 0) {
      imported.currentPageId = migratedPagesFromLegacy[0].id;
    } else {
      const currentPageIdValue = importSelection.pages
        ? (raw.currentPageId ?? current.currentPageId)
        : (current.currentPageId);
      if (currentPageIdValue !== undefined) {
        imported.currentPageId = currentPageIdValue;
      }
    }
    if (importSelection.settings && raw.settings) {
      imported.settings = raw.settings;
    }

    // 启动导入组件（ImportProgressOverlay），由其完成导入并显示进度
    startImport({ data: imported, mode });
    setImportPreview(null);
  }, [importPreview, importSelection, startImport]);

  const handleCancelImport = useCallback(() => {
    setImportPreview(null);
  }, []);

  // 导出/导入对话框 ESC 关闭
  useEffect(() => {
    if (!showExportDialog && !importPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showExportDialog) handleCancelExport();
      else handleCancelImport();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExportDialog, importPreview, handleCancelExport, handleCancelImport]);

  const toggleExportItem = (key: CategoryKey) => {
    setExportSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleImportItem = (key: CategoryKey) => {
    setImportSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 获取导出数据数量
  const exportCounts = useMemo(() => {
    const data = getServices().dataManager.getData();
    // 统计 pages
    let pageCount = 0;
    let pageSiteCount = 0;
    if (data.pages?.length) {
      pageCount = data.pages.length;
      for (const page of data.pages) {
        pageSiteCount += countWebsites(page.websites);
      }
    }
    return {
      searchEngines: data.searchEngines?.length ?? 0,
      pages: pageCount,
      pageSiteCount,
      websites: countWebsites(data.websites),
      todos: data.todos?.length ?? 0,
      notes: data.notes?.length ?? 0,
      settings: null as number | null,
    };
  }, [showExportDialog]);

  return (
    <>
      <div className="ie-triggers">
        <button
          className="ie-trigger-btn ie-trigger-btn--primary"
          onClick={handleExportClick}
        >
          <span className="ie-trigger-icon">⇪</span>
          <span>导出数据</span>
        </button>
        <button
          className="ie-trigger-btn ie-trigger-btn--secondary"
          onClick={handleImportClick}
        >
          <span className="ie-trigger-icon">⇩</span>
          <span>导入数据</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="ie-file-input"
        onChange={handleFileChange}
      />

      {showExportDialog && (
        <div
          className="ie-overlay"
          onClick={(e) => e.target === e.currentTarget && handleCancelExport()}
        >
          <div className="ie-dialog">
            <div className="ie-dialog-header">
              <h3>导出数据</h3>
              <button className="ie-close-btn" onClick={handleCancelExport} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="ie-dialog-body">
              <label className="ie-label" htmlFor="ie-filename">
                文件名
              </label>
              <input
                id="ie-filename"
                type="text"
                className="ie-filename-input"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={buildDefaultFilename()}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hasExportSelection) handleConfirmExport();
                }}
              />
              <label className="ie-label ie-section-label">
                导出内容
              </label>
              <div className="ie-checkbox-group">
                {DATA_CATEGORIES.map(({ key, label }) => {
                  const count = exportCounts[key];
                  const hasData = key === 'settings' ? true : (count ?? 0) > 0;
                  return (
                    <label
                      key={key}
                      className={`ie-checkbox-item${!hasData ? ' ie-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={exportSelection[key] && hasData}
                        disabled={!hasData}
                        onChange={() => toggleExportItem(key)}
                      />
                      <span className="ie-checkbox-custom" />
                      <span className="ie-checkbox-label">{label}</span>
                      {count !== null && count > 0 && (
                        <span className="ie-checkbox-count">
                          {key === 'pages'
                            ? `${exportCounts.pages}页/${exportCounts.pageSiteCount}站`
                            : `${count} 个`}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              <p className="ie-hint">
                不含壁纸与图标文件
              </p>
            </div>
            <div className="ie-dialog-footer">
              <button
                className="ie-btn ie-btn-primary"
                onClick={handleConfirmExport}
                disabled={!hasExportSelection}
              >
                导出
              </button>
              <button className="ie-btn ie-btn-secondary" onClick={handleCancelExport}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {importPreview && (
        <div
          className="ie-overlay"
          onClick={(e) => e.target === e.currentTarget && handleCancelImport()}
        >
          <div className="ie-dialog">
            <div className="ie-dialog-header">
              <h3>确认导入数据</h3>
              <button className="ie-close-btn" onClick={handleCancelImport} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="ie-dialog-body">
              <p className="ie-summary">{buildImportSummary(importPreview.raw)}</p>
              <label className="ie-label ie-section-label">
                导入内容
              </label>
              <div className="ie-checkbox-group">
                {DATA_CATEGORIES.map(({ key, label }) => {
                  const available = importPreview.available[key];
                  const count = importPreview.counts[key];
                  return (
                    <label
                      key={key}
                      className={`ie-checkbox-item${!available ? ' ie-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={importSelection[key] && available}
                        disabled={!available}
                        onChange={() => toggleImportItem(key)}
                      />
                      <span className="ie-checkbox-custom" />
                      <span className="ie-checkbox-label">{label}</span>
                      {count !== null && (
                        <span className="ie-checkbox-count">
                          {key === 'pages'
                            ? `${importPreview.counts.pages}页/${importPreview.counts.pageSiteCount}站`
                            : `${count} 个`}
                        </span>
                      )}
                      {key === 'settings' && available && (
                        <span className="ie-checkbox-count">已包含</span>
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="ie-mode-list">
                <p className="ie-mode-hint">
                  <span className="ie-mode-label">合并</span>
                  保留现有数据，同 ID 项用导入项替换，其余追加
                </p>
                <p className="ie-mode-hint">
                  <span className="ie-mode-label">覆盖</span>
                  用导入数据整体替换当前对应数据
                </p>
              </div>
              <p className="ie-hint">壁纸与图标不受影响</p>
            </div>
            <div className="ie-dialog-footer">
              <button
                className="ie-btn ie-btn-primary"
                onClick={() => handleApplyImport('merge')}
                disabled={!hasImportSelection}
              >
                合并
              </button>
              <button
                className="ie-btn ie-btn-danger"
                onClick={() => handleApplyImport('overwrite')}
                disabled={!hasImportSelection}
              >
                覆盖
              </button>
              <button className="ie-btn ie-btn-secondary" onClick={handleCancelImport}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </>
  );
};

export default ImportExport;
