import { useState, useRef, useCallback, useEffect } from 'react';
import type { Website } from '../types';
import { usePointerDrag, type DragHit, type DragPoint } from './usePointerDrag';
import { computeGridDropZone } from '../utils/dropGeometry';

export type DragPosition = 'before' | 'after' | 'center' | 'invalid';

/**
 * 长按起拖后未移动即松手时，需要弹出上下文菜单的目标图标与指针位置（视口坐标）。
 * 由拖拽引擎的 onLongPressTap 产生，经 IconGrid 下发给对应条目。
 */
export interface IconLongPressInfo {
  iconId: string;
  x: number;
  y: number;
}

interface UseDragAndDropOptions {
  icons: Website[];
  onIconsChange: (icons: Website[]) => void;
  allowFolderCreation?: boolean;
  onHandleDrop?: (
    targetIconId: string,
    draggedIcon: Website,
    targetIcon: Website,
    dragOverPosition: DragPosition
  ) => boolean;
  draggedIcon?: Website | null;
  setDraggedIcon?: (icon: Website | null) => void;
  /** 拖拽中指针移动（视口坐标）。FolderWindow 用它实时判断「是否已拖出窗口」 */
  onDragMovePoint?: ((point: DragPoint) => void) | undefined;
  /**
   * 内部排序 / 入夹逻辑执行完之后的收尾回调，用于「拖出宿主容器」这类宿主级语义。
   * hit 为 null 表示指针下方没有可投放目标。
   */
  onDragEndPoint?:
    | ((draggedIcon: Website, point: DragPoint, hit: DragHit | null) => void)
    | undefined;
  /** 逐项判断该图标此刻是否允许起拖 */
  canStart?: ((iconId: string) => boolean) | undefined;
  /** 拖拽被异常中断（Esc / pointercancel / 失焦）时的收尾回调。
   *  这条路径不会执行落库，宿主需要用它与正常结束一样复位自己的视觉状态。 */
  onDragCancel?: (() => void) | undefined;
  /** 是否禁用拖拽 */
  disabled?: boolean | undefined;
}

/**
 * 图标网格的拖拽排序 / 入夹逻辑。
 *
 * 迁移说明：对外 API 与文件名保持不变，内部实现已从 HTML5 Drag & Drop 换成
 * usePointerDrag（Pointer Events），因此桌面端与触屏端共用同一套代码。
 * 「左右 drop-zone」这种依靠 dragover 事件分区的做法已删除 —— 落点改由
 * computeGridDropZone 按指针 x 坐标相对目标矩形的位置算出，分界规则（25% / 75%）逐字保留。
 */
export const useDragAndDrop = ({
  icons,
  onIconsChange,
  allowFolderCreation = true,
  onHandleDrop,
  draggedIcon: externalDraggedIcon,
  setDraggedIcon: externalSetDraggedIcon,
  onDragMovePoint,
  onDragEndPoint,
  canStart,
  onDragCancel: externalOnDragCancel,
  disabled,
}: UseDragAndDropOptions) => {
  const [internalDraggedIcon, setInternalDraggedIcon] = useState<Website | null>(null);
  const [dragOverIcon, setDragOverIcon] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<DragPosition | null>(null);
  const [longPressInfo, setLongPressInfo] = useState<IconLongPressInfo | null>(null);

  const draggedIcon = externalDraggedIcon ?? internalDraggedIcon;
  const setDraggedIcon = externalSetDraggedIcon ?? setInternalDraggedIcon;

  // 指针回调注册在 document 上，只注册一次；通过 ref 读取最新值，避免闭包过期。
  // 渲染期不允许写 ref，统一在每次渲染后的 effect 里同步。
  const iconsRef = useRef(icons);
  const allowFolderCreationRef = useRef(allowFolderCreation);
  const onHandleDropRef = useRef(onHandleDrop);
  const onIconsChangeRef = useRef(onIconsChange);
  const onDragMovePointRef = useRef(onDragMovePoint);
  const onDragEndPointRef = useRef(onDragEndPoint);
  const onDragCancelRef = useRef(externalOnDragCancel);

  useEffect(() => {
    iconsRef.current = icons;
    allowFolderCreationRef.current = allowFolderCreation;
    onHandleDropRef.current = onHandleDrop;
    onIconsChangeRef.current = onIconsChange;
    onDragMovePointRef.current = onDragMovePoint;
    onDragEndPointRef.current = onDragEndPoint;
    onDragCancelRef.current = externalOnDragCancel;
  });

  /**
   * 本次会话正在拖拽的图标。
   * 只由「起拖 / 结束」两个时机写入，不随渲染同步 —— 外部 store 的 setDraggedIcon
   * 是异步生效的，若依赖渲染期同步，onDragMove 可能读到上一帧的 null。
   */
  const activeIconRef = useRef<Website | null>(null);

  const debounceTimerRef = useRef<number | null>(null);
  // 存储最后一次实际落点（不受异步 state 影响，确保松手时能读到正确值）
  const lastPositionRef = useRef<{ iconId: string; position: DragPosition } | null>(null);
  // 记录最后一次 setState 的 {iconId, position}。
  // 指针哪怕没动，rAF 节流后的 onDragMove 仍会每帧重算一次落点；
  // 若无脑 setState，组件重渲染 → React 把 className 重新写入 →
  // .icon-circle 上的 `animation:shake` 被当作"新样式"重新计算，
  // shake 就会从头播放 → 这就是"鼠标停住图标一直抖"的根因。
  // 这里先做一次值比较，只有真的变化时才写 state，彻底砍掉无效重渲染。
  const lastSetStateRef = useRef<{ iconId: string | null; position: DragPosition | null }>({
    iconId: null,
    position: null,
  });

  /** 安全写 dragOver state：仅当 {iconId, position} 真的变化时才写入，
   *  避免高频重算导致的无效重渲染 / CSS 动画重触发。 */
  const commitDragOverState = useCallback(
    (nextIconId: string | null, nextPosition: DragPosition | null) => {
      const prev = lastSetStateRef.current;
      if (prev.iconId === nextIconId && prev.position === nextPosition) {
        return;
      }
      lastSetStateRef.current = { iconId: nextIconId, position: nextPosition };
      setDragOverIcon(nextIconId);
      setDragOverPosition(nextPosition);
    },
    [],
  );

  // 组件卸载时清理防抖定时器，避免泄露
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  /** 高亮状态的统一延迟提交：30ms 用于「落到某个图标上」，50ms 用于「离开目标」。
   *  两者共用一个定时器槽位，所以来回切换时后一次一定会取消前一次。 */
  const scheduleCommit = useCallback(
    (iconId: string | null, position: DragPosition | null, delay: number) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        commitDragOverState(iconId, position);
        debounceTimerRef.current = null;
      }, delay);
    },
    [commitDragOverState],
  );

  /** 判断「中心投放」语义是否合法：
   *  ✅ website  → folder           : 合法，塞进文件夹（center 绿框）
   *  ✅ website  → website + 允许建文件夹 : 合法，新建文件夹（center 绿框）
   *  ❌ folder   → folder           : 不支持嵌套文件夹（invalid 红框）
   *  ❌ folder   → website          : 不支持把文件夹塞进站点/新建文件夹（invalid 红框）
   *  ❌ website  → website + 禁止建文件夹 : 中心操作不成立（invalid 红框） */
  const resolvePosition = useCallback(
    (targetIcon: Website, dragged: Website, rect: DOMRect, clientX: number): DragPosition => {
      const isTargetFolder = targetIcon.isFolder || false;
      const isDraggedFolder = dragged.isFolder || false;
      const canCenterDrop =
        (isTargetFolder && !isDraggedFolder) ||
        (!isTargetFolder && allowFolderCreationRef.current && !isDraggedFolder);

      const zone = computeGridDropZone(rect, clientX);
      if (zone === 'center') return canCenterDrop ? 'center' : 'invalid';
      return zone;
    },
    [],
  );

  const handleDragMove = useCallback(
    (hit: DragHit | null, point: DragPoint) => {
      onDragMovePointRef.current?.(point);

      const dragged = activeIconRef.current;
      if (!dragged) return;

      // 指针下方没有目标（网格空隙 / 容器外），或正悬在自己身上 → 清掉高亮
      if (!hit || hit.key === dragged.id) {
        scheduleCommit(null, null, 50);
        return;
      }

      const targetIcon = iconsRef.current.find((icon) => icon.id === hit.key);
      if (!targetIcon) {
        scheduleCommit(null, null, 50);
        return;
      }

      const position = resolvePosition(
        targetIcon,
        dragged,
        hit.el.getBoundingClientRect(),
        point.x,
      );

      // 立即写入 ref，确保松手时可读到最新落点
      lastPositionRef.current = { iconId: hit.key, position };
      scheduleCommit(hit.key, position, 30);
    },
    [resolvePosition, scheduleCommit],
  );

  const handleDropOnHit = useCallback(
    (hit: DragHit | null, point: DragPoint) => {
      const dragged = activeIconRef.current;

      // 关键：松手瞬间必须先清掉待执行的防抖回调。
      // 否则，松手前那一刻刚排进队列的 30ms 定时器，会在清空高亮之后重新写入
      // dragOverIcon/dragOverPosition，导致目标文件夹的绿色指示框"偶发"残留。
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      commitDragOverState(null, null);

      /** 收尾：清空会话图标 + 通知宿主（拖出语义等） */
      const settle = (hitResult: DragHit | null) => {
        activeIconRef.current = null;
        lastPositionRef.current = null;
        if (dragged) onDragEndPointRef.current?.(dragged, point, hitResult);
      };

      if (!dragged) {
        lastPositionRef.current = null;
        return;
      }

      // 指针下方没有目标，或落在自己身上 → 不排序，直接结束
      if (!hit || hit.key === dragged.id) {
        setDraggedIcon(null);
        settle(null);
        return;
      }

      const draggedIconObj = iconsRef.current.find((icon) => icon.id === dragged.id);
      const targetIconObj = iconsRef.current.find((icon) => icon.id === hit.key);

      if (!draggedIconObj || !targetIconObj) {
        setDraggedIcon(null);
        settle(null);
        return;
      }

      // 优先使用 ref 中同步记录的最新落点（与拖动中的分区结果严格一致）
      let calculatedPosition: DragPosition | null = null;
      if (lastPositionRef.current && lastPositionRef.current.iconId === hit.key) {
        calculatedPosition = lastPositionRef.current.position;
      }

      // 如果 ref 中没有（指针未移动过就松手），按同样的分区规则现算一次
      if (!calculatedPosition) {
        calculatedPosition = resolvePosition(
          targetIconObj,
          draggedIconObj,
          hit.el.getBoundingClientRect(),
          point.x,
        );
      }

      // invalid 中心投放：不交给外部处理器，也不做排序；直接结束拖拽。
      if (calculatedPosition === 'invalid') {
        setDraggedIcon(null);
        settle(hit);
        return;
      }

      // 首先尝试交给外部处理器（放入文件夹 / 创建文件夹），仅 center 能被外部处理。
      if (onHandleDropRef.current) {
        const handled = onHandleDropRef.current(
          hit.key,
          draggedIconObj,
          targetIconObj,
          calculatedPosition,
        );
        if (handled) {
          setDraggedIcon(null);
          settle(hit);
          return;
        }
      }

      // 未被外部处理，则执行排序逻辑
      const draggedIndex = iconsRef.current.findIndex((icon) => icon.id === dragged.id);
      const targetIndex = iconsRef.current.findIndex((icon) => icon.id === hit.key);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedIcon(null);
        settle(null);
        return;
      }

      const newIcons = [...iconsRef.current];
      newIcons.splice(draggedIndex, 1);
      let insertIndex: number;
      if (calculatedPosition === 'before') {
        insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      } else {
        insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
      }
      newIcons.splice(insertIndex, 0, draggedIconObj);

      onIconsChangeRef.current(newIcons);
      setDraggedIcon(null);
      settle(hit);
    },
    [commitDragOverState, resolvePosition, setDraggedIcon],
  );

  /** 异常中断（Esc / pointercancel / 窗口失焦）：只回滚视觉状态，不做任何落库 */
  const handleDragCancel = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    activeIconRef.current = null;
    lastPositionRef.current = null;
    setDraggedIcon(null);
    commitDragOverState(null, null);
    onDragCancelRef.current?.();
  }, [commitDragOverState, setDraggedIcon]);

  const clearLongPress = useCallback(() => {
    setLongPressInfo(null);
  }, []);

  const { getDragHandleProps } = usePointerDrag({
    // 沿用既有 DOM 属性，避免为了迁移动引擎而新增 data-* 标记
    hitAttribute: 'data-icon-id',
    // 图标与图标之间的空隙也归属于相邻图标：补回迁移前
    // .icon-drop-zone-left/right 提供、迁移时丢掉的排序操作空间
    hitAreaSelector: '.icon-grid',
    onDragStart: (key) => {
      const icon = iconsRef.current.find((item) => item.id === key) ?? null;
      if (!icon) return;
      activeIconRef.current = icon;
      lastPositionRef.current = null;
      setDraggedIcon(icon);
    },
    onDragMove: handleDragMove,
    onDragEnd: handleDropOnHit,
    // 触屏长按起拖后未移动即松手：弹该图标的上下文菜单（原来那套 500ms 长按 hook 已拆除）。
    // 这条路径上引擎会先回调 onDragCancel 复位拖拽状态，这里只负责弹菜单
    onLongPressTap: (key, point) => {
      setLongPressInfo({ iconId: key, x: point.x, y: point.y });
    },
    onDragCancel: handleDragCancel,
    ...(canStart ? { canStart } : {}),
    ...(disabled === undefined ? {} : { disabled }),
  });

  const isDragging = useCallback(
    (iconId: string) => {
      return draggedIcon?.id === iconId;
    },
    [draggedIcon],
  );

  const isDragOverIcon = useCallback(
    (iconId: string) => {
      return dragOverIcon === iconId;
    },
    [dragOverIcon],
  );

  return {
    draggedIcon,
    dragOverIcon,
    dragOverPosition,
    longPressInfo,
    clearLongPress,
    getDragHandleProps,
    isDragging,
    isDragOverIcon,
    setDraggedIcon,
  };
};
