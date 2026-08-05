import { useRef, useCallback, useEffect } from 'react';
import { isClickOnEmptyArea } from '../utils/deviceUtils';

interface UseLongPressOptions {
  delay?: number;
  checkEmptyArea?: boolean;
  moveThreshold?: number;
}

export function useLongPress(
  onLongPress: () => void,
  options?: UseLongPressOptions | number
) {
  const opts: UseLongPressOptions = typeof options === 'number' ? { delay: options } : (options ?? {});
  const { delay = 2000, checkEmptyArea = true, moveThreshold = 10 } = opts;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMovedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      onLongPressRef.current();
    }, delay);
  }, [delay, clearTimer]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (checkEmptyArea) {
      const target = e.target as HTMLElement;
      if (!isClickOnEmptyArea(target)) return;
    }
    startTimer();
  }, [checkEmptyArea, startTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchMovedRef.current = false;
    startTimer();
  }, [startTimer]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
      touchMovedRef.current = true;
      clearTimer();
    }
  }, [moveThreshold, clearTimer]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    touchMovedRef.current = false;
    clearTimer();
  }, [clearTimer]);

  return {
    handleMouseDown,
    handleMouseUp: clearTimer,
    handleMouseLeave: clearTimer,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}