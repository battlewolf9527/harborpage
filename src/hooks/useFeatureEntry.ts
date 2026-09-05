import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  useFeatureDockStore,
  type FeatureId,
} from '../store/useFeatureDockStore';

/** 宿主侧注册描述（内容由功能组件决定） */
export interface FeatureEntryDescriptor {
  glyph: ReactNode;
  label: string;
  tint: string;
  tint2: string;
  badge: string | null;
  onHoverEnd?: () => void;
}

/**
 * 倒置依赖的“功能侧”接入点：功能组件挂载时向主界面注册自己的入口描述，
 * 卸载时自动注销（功能开关关闭 → 入口球消失）。
 *
 * 用法（宿主内）：
 *   useFeatureEntry('notes', { glyph: '📝', tint: '#34d399', ... });
 * 动态数据（如待办未完成数）：
 *   useFeatureEntry('todos', { ..., label: 计数文案, badge: 计数字符串 });
 */
export function useFeatureEntry(id: FeatureId, descriptor: FeatureEntryDescriptor): void {
  const register = useFeatureDockStore((s) => s.register);
  const unregister = useFeatureDockStore((s) => s.unregister);
  const updateEntry = useFeatureDockStore((s) => s.updateEntry);

  // 1) 挂载/卸载生命周期：注册 + 清理（仅依赖 id，防止每次渲染重建）
  useEffect(() => {
    register({ id, ...descriptor });
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, register, unregister]);

  // 2) 每次渲染后把最新描述同步进注册表（label/badge/回调 随数据变化）
  useEffect(() => {
    updateEntry(id, descriptor);
    // 无依赖数组：每次渲染后同步，保证计数/文案即时生效
  });
}
