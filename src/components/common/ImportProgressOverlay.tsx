import React, { useEffect, useState, useRef } from 'react';
import { useImportStore } from '../../store/useImportStore';
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
      const modeText = importTask.mode === 'merge' ? '合并' : '覆盖';

      try {
        setImportProgress(5);
        setImportMessage('正在解析导入数据...');
        await nextFrame();

        setImportProgress(10);
        setImportMessage(`正在${modeText}数据...`);
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
          setImportMessage('正在清理...');
          await nextFrame();
          clearAllPendingDeletes();
        } finally {
          dataManager.endInitialization();
        }

        if (cancelled) return;

        setImportProgress(100);
        setImportMessage('导入完成');
        await delay(500);

        if (!cancelled) {
          finishImport();
          setToast({ type: 'success', message: `导入成功（${modeText}），请保存以同步到云端` });
        }
      } catch {
        if (!cancelled) {
          finishImport();
          setToast({ type: 'error', message: '导入失败，请重试' });
        }
      }
    };

    runImport();

    return () => {
      cancelled = true;
      executedRef.current = false;
    };
  }, [isImporting, importTask, setImportProgress, setImportMessage, finishImport]);

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
            <h2 className="progress-title">正在导入数据</h2>
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
            <p className="progress-hint">请稍候，导入过程中请勿关闭或刷新页面</p>
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
