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
      const target = event.target;
      // contains 参数必须是真 Node：非 Node 目标（异常穿越对象）视为"点在外部"
      const node = target instanceof Node ? target : null;
      if (!ref.current || !node || !ref.current.contains(node)) {
        handlerRef.current(event);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, enabled]);
};
