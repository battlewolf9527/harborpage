import React, { useEffect, useState, useRef } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  onClose: () => void;
  onContinue?: () => void;
  continueText?: string;
}

const Toast: React.FC<ToastProps> = ({
  type,
  message,
  duration = 2000,
  onClose,
  onContinue,
  continueText = '继续'
}) => {
  // 使用 lazy initialization 避免在 useEffect 中同步调用 setState
  const [isVisible, setIsVisible] = useState(() => true);
  const [progress, setProgress] = useState(100);
  const progressRef = useRef<number>(100);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 用 ref 保存 onClose，避免内联函数引用变化导致 effect 重置
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    startTimeRef.current = Date.now();

    // 进度条动画
    const animateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, duration - elapsed);
      const newProgress = (remaining / duration) * 100;

      progressRef.current = newProgress;
      setProgress(newProgress);

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(animateProgress);
      }
    };

    rafRef.current = requestAnimationFrame(animateProgress);

    // 自动关闭定时器
    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      // 等待动画完成后调用 onClose
      delayTimerRef.current = setTimeout(() => onCloseRef.current(), 400);
    }, duration);

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [duration]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '!';
      case 'info':
        return 'i';
      default:
        return '';
    }
  };

  return (
    <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : ''}`}>
      <div className="toast-content">
        <div className="toast-icon-wrapper">
          <span className="toast-icon">{getIcon()}</span>
        </div>
        <div className="toast-message">{message}</div>
        {onContinue && (
          <button className="toast-continue-btn" onClick={onContinue}>
            {continueText}
          </button>
        )}
        <div
          className="toast-progress"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
    </div>
  );
};

export default Toast;
