import { useSyncExternalStore } from 'react';

// navigator.onLine 是同步可读的外部状态，用 useSyncExternalStore 订阅
// online / offline 事件即可，比 useState + useEffect 少一次额外渲染
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

const getSnapshot = (): boolean => navigator.onLine;

/**
 * 当前浏览器是否在线（离线徽标等需要随联网状态重渲染的 UI 使用）。
 *
 * 注意：判断「此刻能否发出请求」请直接读 navigator.onLine，
 * 不要用本 hook 的快照 —— online 事件刚触发时 React 尚未重渲染，
 * 快照可能仍是过期的旧值（SavePrompt 的补同步就踩过这个坑）。
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}