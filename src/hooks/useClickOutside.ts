import { useEffect, useRef, type RefObject } from 'react';

interface UseClickOutsideOptions {
  handler: (event: MouseEvent) => void;
  enabled?: boolean;
}

/**
 * 点击外部关闭的 hook
 * @param ref - 目标元素的 ref
 * @param options - 配置选项
 */
export const useClickOutside = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseClickOutsideOptions
) => {
  const { handler, enabled = true } = options;
  
  // 使用 ref 稳定 handler 引用，避免频繁重新添加事件监听
  const handlerRef = useRef(handler);

  // 使用 useEffect 更新 ref，避免在渲染期间更新
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target)) {
        handlerRef.current(event);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, enabled]);
};
