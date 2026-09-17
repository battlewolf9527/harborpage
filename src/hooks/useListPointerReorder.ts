import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { computeListDropPosition } from '../utils/dropGeometry';
import type { ListDropPosition } from '../utils/dropGeometry';
import { usePointerDrag } from './usePointerDrag';

/**
 * 一维列表的指针拖拽排序（替换 5 处各自手写的 HTML5 DnD 样板）。
 *
 * 迁移前每个列表都重复了同一套：dragStart 记下标 → dragOver 里 preventDefault +
 * 按中线算 top/bottom（或 left/right）→ dragLeave 里用 relatedTarget 过滤子节点穿越
 * → drop 里算插入位。这些现在全部收进这里，调用点只剩下「拿到索引后怎么改 store」。
 *
 * 两种提交时机（对应迁移前的两类实现，行为逐字保留）：
 *  - 默认（live = false）：拖动中只维护 overKey / overPosition 用于画指示线，松手才 onReorder。
 *  - live = true：不存在指示线，指针移到哪就立刻重排并落库（搜索源、favicon 源就是如此）。
 */
export interface UseListPointerReorderOptions {
  /** 当前列表顺序的稳定 key（可见列表：带过滤时传过滤后的数组） */
  keys: readonly string[];
  /** 判定 before/after 的轴：'y' 纵向列表，'x' 横向（便签球），默认 'y' */
  axis?: 'x' | 'y' | undefined;
  /** 拖动中即时重排并提交，默认 false（松手才提交） */
  live?: boolean | undefined;
  /** 命中测试属性名（不带方括号），默认 'data-drag-key' */
  hitAttribute?: string | undefined;
  /** 该 key 此刻是否允许起拖（编辑态、删除确认中、过滤态下禁止） */
  canStart?: ((key: string) => boolean) | undefined;
  /** 触屏长按起拖延时（ms），默认 500 */
  touchDelay?: number | undefined;
  /** 是否绘制跟随指针的 ghost，默认 true */
  ghost?: boolean | undefined;
  /** 是否禁用拖拽 */
  disabled?: boolean | undefined;
  /**
   * 顺序变化。from / over 都是 keys 数组里的下标。
   * - live：拖动中每次越过一个新目标就调用一次，语义为「把 from 处的项移到 over 处」。
   * - 非 live：松手时调用一次，语义为「from 处的项落在了 over 处的前/后」，
   *   由调用点自行用 position 换算 insertAt（各列表对「原数组下标映射」的要求不同，
   *   无法在这里统一，例如便签球列表只覆盖前 8 条，而 reorderNotes 作用于完整数组）。
   */
  onReorder: (from: number, over: number, position: ListDropPosition) => void;
  /** 拖拽真正开始（仅已激活时触发），用于收起 tooltip 之类的副作用 */
  onDragStart?: ((key: string) => void) | undefined;
  /** 拖拽结束（含取消），用于清理额外状态 */
  onDragEnd?: (() => void) | undefined;
}

/** 挂到列表项元素上的 props：既提供命中标记，也提供起拖把手。 */
export interface ListItemDragProps {
  'data-drag-key': string;
  onPointerDown: (e: ReactPointerEvent) => void;
}

interface OverState {
  key: string;
  position: ListDropPosition;
}

export function useListPointerReorder(options: UseListPointerReorderOptions) {
  // 回调统一放 ref：usePointerDrag 每次渲染都会刷新它自己的 optionsRef，
  // 因此这里闭包读到的永远是最新一次渲染的 props，不必把回调塞进依赖数组。
  // 渲染期不允许写 ref，统一在每次渲染后的 effect 里同步。
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [over, setOver] = useState<OverState | null>(null);
  const overRef = useRef<OverState | null>(null);
  const draggingKeyRef = useRef<string | null>(null);

  /** over 去重：拖拽中每帧都会回调，值没变就不 setState，避免整列表无谓重渲染 */
  const setOverState = useCallback((next: OverState | null) => {
    const prev = overRef.current;
    if (prev?.key === next?.key && prev?.position === next?.position) return;
    overRef.current = next;
    setOver(next);
  }, []);

  const clearOver = useCallback(() => {
    setOverState(null);
  }, [setOverState]);

  /** 把「指针下方的元素」翻译成 over 状态，并决定是即时重排还是只画指示线 */
  const resolveOver = useCallback(
    (key: string, el: HTMLElement, x: number, y: number) => {
      const opts = optionsRef.current;
      const position = computeListDropPosition(
        el.getBoundingClientRect(),
        x,
        y,
        opts.axis ?? 'y',
      );

      if (!opts.live) {
        setOverState({ key, position });
        return;
      }

      // 即时重排：把被拖项移动到指针下方的目标下标处。
      // 重排后被拖项自己就会落到指针下方，所以下一次移动会命中它本身并在此提前返回，
      // 天然不会来回抖动 —— 与迁移前 SearchManager / FaviconSettings 的手感一致。
      const from = opts.keys.indexOf(draggingKeyRef.current ?? '');
      const at = opts.keys.indexOf(key);
      if (from < 0 || at < 0 || from === at) return;
      opts.onReorder(from, at, position);
    },
    [setOverState],
  );

  const { getDragHandleProps } = usePointerDrag({
    hitAttribute: options.hitAttribute,
    touchDelay: options.touchDelay,
    canStart: options.canStart,
    disabled: options.disabled,
    ghost: options.ghost,

    onDragStart: (key) => {
      draggingKeyRef.current = key;
      setDraggingKey(key);
      setOverState(null);
      optionsRef.current.onDragStart?.(key);
    },

    onDragMove: (hit, point) => {
      const key = draggingKeyRef.current;
      // 指针不在任何列表项上（拖到列表外），或悬停在被拖项自己身上 —— 都不算落点
      if (!key || !hit || hit.key === key) {
        clearOver();
        return;
      }
      resolveOver(hit.key, hit.el, point.x, point.y);
    },

    onDragEnd: (hit, point) => {
      const key = draggingKeyRef.current;
      const prevOver = overRef.current;
      draggingKeyRef.current = null;
      setDraggingKey(null);
      setOverState(null);
      optionsRef.current.onDragEnd?.();

      const opts = optionsRef.current;
      if (opts.live) return;
      if (!key) return;

      // 优先用松手瞬间的命中结果：最后一段位移可能没走完一帧，over 状态会落后于指针
      let target = prevOver;
      if (hit && hit.key !== key) {
        target = {
          key: hit.key,
          position: computeListDropPosition(
            hit.el.getBoundingClientRect(),
            point.x,
            point.y,
            opts.axis ?? 'y',
          ),
        };
      }
      if (!target) return;

      const from = opts.keys.indexOf(key);
      const at = opts.keys.indexOf(target.key);
      if (from < 0 || at < 0 || from === at) return;
      opts.onReorder(from, at, target.position);
    },

    onDragCancel: () => {
      draggingKeyRef.current = null;
      setDraggingKey(null);
      setOverState(null);
      optionsRef.current.onDragEnd?.();
    },
  });

  // 每个 key 复用同一个 props 对象，避免拖拽把手击穿列表项的 React.memo
  const propsCacheRef = useRef(new Map<string, ListItemDragProps>());
  const getItemProps = useCallback(
    (key: string): ListItemDragProps => {
      const cache = propsCacheRef.current;
      const cached = cache.get(key);
      if (cached) return cached;
      const props: ListItemDragProps = {
        'data-drag-key': key,
        onPointerDown: getDragHandleProps(key).onPointerDown,
      };
      cache.set(key, props);
      return props;
    },
    [getDragHandleProps],
  );

  return { draggingKey, overKey: over?.key ?? null, overPosition: over?.position ?? null, getItemProps };
}
