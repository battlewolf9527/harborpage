import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  hasUnsavedChanges: boolean;
  autoSaveEnabled: boolean;
  autoSaveDuration: number;
  isSaving: boolean;
  onAutoSave: () => void;
}

export function useAutoSave({
  hasUnsavedChanges,
  autoSaveEnabled,
  autoSaveDuration,
  isSaving,
  onAutoSave,
}: UseAutoSaveOptions) {
  const [countdown, setCountdown] = useState(autoSaveDuration);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef(autoSaveDuration);
  // 用 ref 存储 onAutoSave，避免内联函数导致 effect 反复重置
  const onAutoSaveRef = useRef(onAutoSave);
  useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  const shouldRun = hasUnsavedChanges && autoSaveEnabled && !isSaving;

  // 当 shouldRun 切换时管理定时器
  useEffect(() => {
    if (!shouldRun) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    countdownRef.current = autoSaveDuration;
    setCountdown(autoSaveDuration);

    timerRef.current = window.setInterval(() => {
      countdownRef.current -= 1;

      if (countdownRef.current <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onAutoSaveRef.current();
        countdownRef.current = autoSaveDuration;
      } else {
        setCountdown(countdownRef.current);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [shouldRun, autoSaveDuration]);

  const resetCountdown = useCallback(() => {
    countdownRef.current = autoSaveDuration;
    setCountdown(autoSaveDuration);
  }, [autoSaveDuration]);

  const progress = (Math.max(0, countdown) / autoSaveDuration) * 100;

  return { countdown, progress, resetCountdown };
}