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

  // 渲染期调整（替代 effect 内同步 setState）：shouldRun 或时长变化时，
  // 把倒计时归零到完整时长。ref 同步留在 effect（规则禁止渲染期写 ref）。
  const [runConfig, setRunConfig] = useState({ active: shouldRun, duration: autoSaveDuration });
  if (runConfig.active !== shouldRun || runConfig.duration !== autoSaveDuration) {
    setRunConfig({ active: shouldRun, duration: autoSaveDuration });
    if (shouldRun) {
      setCountdown(autoSaveDuration);
    }
  }

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

    // 保持简单稳定：每秒更新一次。
    // SavePrompt 组件只有在 hasUnsavedChanges=true 且 isVisible=true 时才会渲染倒计时SVG，
    // 平时（绝大多数闲置时间）SavePrompt 图标本身就是 memo 级别的极小渲染开销。
    // 过度优化这里的减频逻辑反而容易引入状态边界 bug。
    timerRef.current = window.setInterval(() => {
      countdownRef.current -= 1;

      if (countdownRef.current <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setCountdown(0);
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