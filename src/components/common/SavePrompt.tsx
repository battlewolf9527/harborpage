import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useIconsStore } from '../../store/useIconsStore';
import Toast from './Toast';
import { getServices } from '../../services/serviceContainer';
import SaveTooltip from './SaveTooltip';
import SaveProgressIndicator from './SaveProgressIndicator';
import './SavePrompt.css';
import { useAutoSaveSettings } from '../../hooks/useAutoSaveSettings';
import { useAutoSave } from '../../hooks/useAutoSave';

const SavePrompt: React.FC = () => {
  const { dataManager } = getServices();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);

  const { autoSaveEnabled, autoSaveDuration, setAutoSaveEnabled } = useAutoSaveSettings();

  const isMouseInTooltip = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 用 ref 存储 resetCountdown，避免其变化导致 handleChanges 反复重新订阅
  const resetCountdownRef = useRef<() => void>(() => {});
  // 用 ref 跟踪 isSaving，供 handleChanges 闭包读取最新值
  const isSavingRef = useRef(false);
  useEffect(() => { isSavingRef.current = isSaving; }, [isSaving]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (mouseLeaveTimerRef.current) clearTimeout(mouseLeaveTimerRef.current);
    };
  }, []);

  const handleSaveSuccess = useCallback(() => {
    setToast({ type: 'success', message: autoSaveEnabled ? '自动保存成功' : '保存成功' });
    setIsSaving(false);
    exitTimerRef.current = setTimeout(() => {
      setIsExiting(true);
      hideTimerRef.current = setTimeout(() => setIsVisible(false), 300);
    }, 1000);
  }, [autoSaveEnabled]);

  const handleSaveError = useCallback((errorMsg: string) => {
    setSaveError(errorMsg);
    setToast({ type: 'error', message: errorMsg });
    setIsSaving(false);
  }, []);

  const performSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveProgress({ current: 0, total: 0 });
    setSaveError(null);
    setShowTooltip(false);

    const result = await dataManager.saveChanges();
    if (result.performed) {
      await useIconsStore.getState().processPendingDeletes((current, total) => {
        setSaveProgress({ current, total });
      });
      handleSaveSuccess();
    } else if (result.error) {
      handleSaveError(result.error);
    } else {
      setIsSaving(false);
    }
    return result.performed;
  }, [isSaving, handleSaveSuccess, handleSaveError, dataManager]);

  const { countdown, progress, resetCountdown } = useAutoSave({
    hasUnsavedChanges,
    autoSaveEnabled,
    autoSaveDuration,
    isSaving,
    onAutoSave: performSave,
  });

  // 将 resetCountdown 写入 ref，供 handleChanges 使用
  useEffect(() => {
    resetCountdownRef.current = resetCountdown;
  }, [resetCountdown]);

  useEffect(() => {
    const handleChanges = (hasChanges: boolean) => {
      setHasUnsavedChanges(hasChanges);
      if (hasChanges) {
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
          exitTimerRef.current = null;
        }
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        resetCountdownRef.current();
        setIsVisible(true);
        setIsExiting(false);
        setSaveError(null);
        setShowTooltip(false);
        setToast(null);
      } else if (!isSavingRef.current) {
        // 变更被外部清空（非保存成功）时，直接隐藏图标
        // 保存成功时 isSaving=true，由 handleSaveSuccess 处理退出动画
        setIsVisible(false);
        setIsExiting(false);
      }
    };

    handleChanges(dataManager.hasChanges());
    const unsubscribe = dataManager.subscribeChanges(handleChanges);
    return unsubscribe;
  }, [dataManager]);

  useEffect(() => {
    const handleDataLoadedFromCloud = () => {
      // 云端数据加载后，只有当本地没有未保存变更时才隐藏未保存图标
      // 如果本地仍有未保存变更，保留提示以提醒用户保存
      if (!dataManager.hasChanges()) {
        setIsVisible(false);
        setHasUnsavedChanges(false);
      }
    };

    window.addEventListener('dataLoadedFromCloud', handleDataLoadedFromCloud);
    return () => {
      window.removeEventListener('dataLoadedFromCloud', handleDataLoadedFromCloud);
    };
  }, [dataManager]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      resetCountdown();
    }
  }, [hasUnsavedChanges, resetCountdown]);

  const handleManualSave = useCallback(async () => {
    await performSave();
    resetCountdown();
  }, [performSave, resetCountdown]);

  const handleMouseEnter = useCallback(() => {
    if (!isSaving && !isExiting && (hasUnsavedChanges || saveError)) {
      setIsHovered(true);
      setShowTooltip(true);
    }
  }, [isSaving, isExiting, hasUnsavedChanges, saveError]);

  const handleMouseLeave = useCallback(() => {
    if (mouseLeaveTimerRef.current) clearTimeout(mouseLeaveTimerRef.current);
    mouseLeaveTimerRef.current = setTimeout(() => {
      if (!isMouseInTooltip.current) {
        setIsHovered(false);
        setShowTooltip(false);
      }
    }, 200);
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    isMouseInTooltip.current = true;
    setShowTooltip(true);
    setIsHovered(true);
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    isMouseInTooltip.current = false;
    setShowTooltip(false);
    setIsHovered(false);
  }, []);

  const handleToastClose = useCallback(() => setToast(null), []);

  return (
    <>
      {isVisible && (
        <div
          className={`save-prompt-icon-only ${hasUnsavedChanges ? 'has-changes' : ''} ${
            isHovered ? 'hovered' : ''
          } ${isExiting ? 'exiting' : ''}`}
        >
          <div className="save-icon-container">
            {hasUnsavedChanges && autoSaveEnabled && !isSaving && (
              <div className="countdown-ring">
                <svg className="countdown-circle" width="56" height="56" viewBox="0 0 56 56">
                  <circle className="countdown-circle-bg" cx="28" cy="28" r="24" />
                  <circle
                    className="countdown-circle-progress"
                    cx="28"
                    cy="28"
                    r="24"
                    strokeDasharray="150.8"
                    strokeDashoffset={`${150.8 * (1 - progress / 100)}`}
                  />
                </svg>
              </div>
            )}
            <div
              className={`save-icon ${isSaving ? 'saving' : ''} ${isExiting ? 'saved' : ''} ${
                saveError ? 'error' : ''
              }`}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {isSaving
                ? '⏳'
                : isExiting
                ? '✅'
                : saveError
                ? '❌'
                : hasUnsavedChanges
                ? '⚠️'
                : '💾'}
            </div>

            {isSaving && (
              <SaveProgressIndicator saveProgress={saveProgress} />
            )}
          </div>

          {showTooltip && (
            <SaveTooltip
              saveError={saveError}
              isSaving={isSaving}
              saveProgress={saveProgress}
              autoSaveEnabled={autoSaveEnabled}
              countdown={countdown}
              onManualSave={handleManualSave}
              onToggleAutoSave={setAutoSaveEnabled}
              onMouseEnter={handleTooltipMouseEnter}
              onMouseLeave={handleTooltipMouseLeave}
            />
          )}
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={handleToastClose} />}
    </>
  );
};

export default SavePrompt;