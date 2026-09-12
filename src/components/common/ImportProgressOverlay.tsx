import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useImportStore } from '../../store/useImportStore';
import { usePagesStore } from '../../store/usePagesStore';
import { getServices } from '../../services/serviceContainer';
import { initializeAllStoresAsync, clearAllPendingDeletes } from '../../services/storeInitializer';
import Toast from './Toast';
import './ImportProgressOverlay.css';

const nextFrame = (): Promise<void> =>
  new Promise(resolve => requestAnimationFrame(() => resolve()));

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

interface ImportProgressOverlayProps {
  isImporting: boolean;
  importProgress: number;
  importMessage: string;
}

const ImportProgressOverlay: React.FC<ImportProgressOverlayProps> = ({
  isImporting,
  importProgress,
  importMessage,
}) => {
  const { t } = useTranslation('importExport');
  const importTask = useImportStore((s) => s.importTask);
  const setImportProgress = useImportStore((s) => s.setImportProgress);
  const setImportMessage = useImportStore((s) => s.setImportMessage);
  const finishImport = useImportStore((s) => s.finishImport);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const executedRef = useRef(false);

  // 执行导入逻辑
  useEffect(() => {
    if (!isImporting || !importTask || executedRef.current) return;
    executedRef.current = true;

    let cancelled = false;

    const runImport = async () => {
      const dataManager = getServices().dataManager;
      const modeText = importTask.mode === 'merge' ? t('modes.merge') : t('modes.overwrite');

      try {
        setImportProgress(5);
        setImportMessage(t('progress.parsing'));
        await nextFrame();

        setImportProgress(10);
        setImportMessage(t('progress.applying', { mode: modeText }));
        await nextFrame();

        dataManager.startInitialization();
        try {
          const merged = dataManager.applyImportedData(importTask.data, importTask.mode);

          await initializeAllStoresAsync(merged, (task, percent) => {
            if (!cancelled) {
              setImportProgress(percent);
              setImportMessage(task);
            }
          });

          setImportProgress(96);
          setImportMessage(t('progress.cleaning'));
          await nextFrame();
          clearAllPendingDeletes();

          // 导入完成后，确保落在"默认页面"：如果导入进来的网站都在默认页面里（旧格式迁移
          // 或 pages 合并时默认页有新网站），强制切到默认页面让用户立刻看到导入结果，
          // 避免还停留在其他空页面导致误以为"没导入进来"
          try {
            const pagesState = usePagesStore.getState();
            const defaultPage = pagesState.pages.find(p => p.isDefault);
            if (defaultPage && defaultPage.websites.length > 0 && pagesState.currentPageId !== defaultPage.id) {
              pagesState.setCurrentPageId(defaultPage.id);
            }
          } catch {
            /* 非关键逻辑，异常不影响导入结果 */
          }
        } finally {
          dataManager.endInitialization();
        }

        if (cancelled) return;

        setImportProgress(100);
        setImportMessage(t('progress.completed'));
        await delay(500);

        if (!cancelled) {
          finishImport();
          setToast({ type: 'success', message: t('toasts.importSuccess', { mode: modeText }) });
        }
      } catch {
        if (!cancelled) {
          finishImport();
          setToast({ type: 'error', message: t('toasts.importFailed') });
        }
      }
    };

    runImport();

    return () => {
      cancelled = true;
      executedRef.current = false;
    };
  }, [isImporting, importTask, setImportProgress, setImportMessage, finishImport, t]);

  // 导入期间阻止页面刷新/关闭
  useEffect(() => {
    if (!isImporting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isImporting]);

  if (!isImporting && !toast) return null;

  return (
    <>
      {isImporting && (
        <div className="fullscreen-progress-overlay">
          <div className="progress-container">
            <div className="progress-icon">📥</div>
            <h2 className="progress-title">{t('progress.title')}</h2>
            <p className="progress-message">{importMessage}</p>
            <div className="import-progress-bar-container">
              <div className="import-progress-bar-large">
                <div
                  className="import-progress-fill-large"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <span className="import-progress-percentage">{importProgress}%</span>
            </div>
            <p className="progress-hint">{t('progress.hint')}</p>
          </div>
        </div>
      )}
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </>
  );
};

export default ImportProgressOverlay;
