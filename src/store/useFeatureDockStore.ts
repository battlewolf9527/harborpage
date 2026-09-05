import { create } from 'zustand';
import type { ReactNode } from 'react';

/**
 * 功能 Dock 注册中心（倒置依赖核心）
 *
 * 设计意图：
 *  · 功能组件（宿主）只声明自己的「入口描述符」——图形、文案、角标、身份色、
 *    以及必要的悬停结束回调；它们不关心入口球渲染在哪、如何呈现。
 *  · 主界面（FeatureDock）消费注册表，按槽位配置（位置/呈现/交互）放置共享 PeekBall。
 *  · 面板的开合状态集中在 open 表里：入口球触发 open，功能宿主订阅 open 决定
 *    何时挂载/卸载自己的面板。
 *  · 功能开关关闭 → 宿主卸载 → unregister → 入口球自然消失（open 状态一并清理）。
 */

export type FeatureId = 'todos' | 'pages' | 'notes';

export interface FeatureDockEntry {
  /** 功能 id（同时是 open 状态的键） */
  id: FeatureId;
  /** 入口图形：emoji 文本或 svg 节点（由功能组件决定内容） */
  glyph: ReactNode;
  /** 悬停提示文案（允许宿主随数据动态更新） */
  label: string;
  /** 身份主色 / 次色：水晶球全部派生变量由它生成 */
  tint: string;
  tint2: string;
  /** 角标文本；null 不显示 */
  badge: string | null;
  /** 悬停结束回调（仅 hover-open 槽位使用；用于触发“离开即收起”的调度判定） */
  onHoverEnd?: () => void;
}

export type DockOpenMap = Partial<Record<FeatureId, boolean>>;
export type DockEntryMap = Partial<Record<FeatureId, FeatureDockEntry>>;

interface FeatureDockState {
  /** 各功能面板当前是否打开（入口球与功能宿主共享的单一事实源） */
  open: DockOpenMap;
  /** 已注册的入口描述符 */
  entries: DockEntryMap;

  register: (entry: FeatureDockEntry) => void;
  unregister: (id: FeatureId) => void;
  updateEntry: (id: FeatureId, patch: Partial<Omit<FeatureDockEntry, 'id'>>) => void;
  setOpen: (id: FeatureId, open: boolean) => void;
  toggle: (id: FeatureId) => void;
}

export const useFeatureDockStore = create<FeatureDockState>((set) => ({
  open: {},
  entries: {},

  register: (entry) =>
    set((s) => ({ entries: { ...s.entries, [entry.id]: entry } })),

  unregister: (id) =>
    set((s) => {
      const entries = { ...s.entries };
      delete entries[id];
      const open = { ...s.open };
      delete open[id];
      return { entries, open };
    }),

  updateEntry: (id, patch) =>
    set((s) => {
      const cur = s.entries[id];
      if (!cur) return s;
      // 短路：patch 各字段与当前值逐一相同 → 状态无实际变化，返回原引用，
      // 阻断 zustand 通知（避免每次功能组件重渲染都带动 FeatureDock/球重渲染）。
      const keys = Object.keys(patch) as (keyof Omit<FeatureDockEntry, 'id'>)[];
      if (keys.every((k) => cur[k] === patch[k])) return s;
      return { entries: { ...s.entries, [id]: { ...cur, ...patch } } };
    }),

  setOpen: (id, open) =>
    set((s) => {
      if (s.open[id] === open) return s;
      return { open: { ...s.open, [id]: open } };
    }),

  toggle: (id) =>
    set((s) => ({ open: { ...s.open, [id]: !s.open[id] } })),
}));
