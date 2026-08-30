import { useState, useRef, useCallback, useEffect } from 'react';
import type { Website } from '../types';

export type DragPosition = 'before' | 'after' | 'center' | 'invalid';

interface UseDragAndDropOptions {
  icons: Website[];
  onIconsChange: (icons: Website[]) => void;
  allowFolderCreation?: boolean;
  onHandleDrop?: (
    e: React.DragEvent,
    targetIconId: string,
    draggedIcon: Website,
    targetIcon: Website,
    dragOverPosition: DragPosition
  ) => boolean;
  draggedIcon?: Website | null;
  setDraggedIcon?: (icon: Website | null) => void;
}

export const useDragAndDrop = ({
  icons,
  onIconsChange,
  allowFolderCreation = true,
  onHandleDrop,
  draggedIcon: externalDraggedIcon,
  setDraggedIcon: externalSetDraggedIcon,
}: UseDragAndDropOptions) => {
  const [internalDraggedIcon, setInternalDraggedIcon] = useState<Website | null>(null);
  const [dragOverIcon, setDragOverIcon] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<DragPosition | null>(null);

  const draggedIcon = externalDraggedIcon ?? internalDraggedIcon;
  const setDraggedIcon = externalSetDraggedIcon ?? setInternalDraggedIcon;

  const debounceTimerRef = useRef<number | null>(null);
  const outsideDebounceTimerRef = useRef<number | null>(null);
  // 存储最后一次实际拖放位置（不受异步 state 影响，确保 drop 时能读到正确值）
  const lastPositionRef = useRef<{ iconId: string; position: DragPosition } | null>(null);
  // 记录最后一次 setState 的 {iconId, position}。
  // 浏览器的 dragover 事件哪怕鼠标没动，也会每隔 50~350ms 自动重抛一次；
  // 之前我们每 30ms 都无脑 setState 一次，导致组件重渲染 → React 把 className 重新写入，
  // .icon-circle 上的 `animation:shake` 被当作"新样式"重新计算，
  // shake 就会从头播放 → 这就是"鼠标停住图标一直抖"的根因。
  // 这里先做一次值比较，只有真的变化时才写 state，彻底砍掉无效重渲染。
  const lastSetStateRef = useRef<{ iconId: string | null; position: DragPosition | null }>({
    iconId: null,
    position: null,
  });

  /** 安全写 dragOver state：仅当 {iconId, position} 真的变化时才写入，
   *  避免 dragover 高频重抛导致的无效重渲染 / CSS 动画重触发。 */
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

  // 组件卸载时清理所有防抖定时器，避免泄露；并确保 body class 被移除
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (outsideDebounceTimerRef.current) {
        clearTimeout(outsideDebounceTimerRef.current);
        outsideDebounceTimerRef.current = null;
      }
      if (typeof document !== 'undefined' && document.body.classList.contains('is-dragging-active')) {
        document.body.classList.remove('is-dragging-active');
      }
    };
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, icon: Website) => {
    setDraggedIcon(icon);
    lastPositionRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', icon.id);
    // 标记 body 进入全局拖拽状态：用于 CSS 降低所有 backdrop-filter 强度
    // 并关闭图标 hover 放大/闪烁动画，避免大量合成层叠加导致的 GPU OOM
    if (typeof document !== 'undefined') {
      document.body.classList.add('is-dragging-active');
    }
  }, [setDraggedIcon]);

  const handleDragEnd = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (outsideDebounceTimerRef.current) {
      clearTimeout(outsideDebounceTimerRef.current);
      outsideDebounceTimerRef.current = null;
    }
    lastPositionRef.current = null;
    setDraggedIcon(null);
    commitDragOverState(null, null);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('is-dragging-active');
    }
  }, [setDraggedIcon, commitDragOverState]);

  const handleDragOverIcon = useCallback((e: React.DragEvent, iconId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedIcon || draggedIcon.id === iconId) {
      return;
    }

    const targetIcon = icons.find(icon => icon.id === iconId);
    const isTargetFolder = targetIcon?.isFolder || false;
    const isDraggedFolder = draggedIcon.isFolder || false;

    // 判断"中心投放"语义是否合法：
    //  ✅ website  → folder           : 合法，塞进文件夹（center 绿框）
    //  ✅ website  → website + 允许建文件夹 : 合法，新建文件夹（center 绿框）
    //  ❌ folder   → folder           : 不支持嵌套文件夹（invalid 红框）
    //  ❌ folder   → website          : 不支持把文件夹塞进站点/新建文件夹（invalid 红框）
    //  ❌ website  → website + 禁止建文件夹 : 中心操作不成立（invalid 红框）
    const canCenterDrop =
      (isTargetFolder && !isDraggedFolder) ||
      (!isTargetFolder && allowFolderCreation && !isDraggedFolder);

    // 用左右各 25%、中间 50% 作为 before / after / center(或 invalid) 的分界。
    // 保留两侧排序区，只有落在中间 50% 时才区分 center / invalid，操作手感更直观。
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const leftThreshold = rect.width * 0.25;
    const rightThreshold = rect.width * 0.75;

    let position: DragPosition;
    if (x < leftThreshold) {
      position = 'before';
    } else if (x >= rightThreshold) {
      position = 'after';
    } else if (canCenterDrop) {
      position = 'center';
    } else {
      position = 'invalid';
    }

    // 立即写入 ref，确保 drop 时可读到最新位置
    lastPositionRef.current = { iconId, position };

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    // 进入中心区域之前，先取消外部区域可能存在的高亮定时器，
    // 避免 outside 的 30ms 回调在中心高亮之后执行、让位置状态被错位覆盖。
    if (outsideDebounceTimerRef.current) {
      clearTimeout(outsideDebounceTimerRef.current);
      outsideDebounceTimerRef.current = null;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      commitDragOverState(iconId, position);
      debounceTimerRef.current = null;
    }, 30);
  }, [draggedIcon, icons, allowFolderCreation, commitDragOverState]);

  const handleDragLeaveIcon = useCallback((e: React.DragEvent) => {
    // 关键：dragleave 会在"离开到外层"以及"在内部子节点之间穿越"两种情况下都触发。
    // FolderItem 的 icon-circle 内部有 4 张 folder-preview-image，
    // 鼠标静止在上面时，浏览器每 ~50ms 的 dragover 重抛会伴随
    // 多次"穿越某张预览图边界"造成的 leave 假事件；如果我们都当真去
    // commit(null,null)，下一次 30ms over 又把 position 设回 invalid，
    // 就会形成 "null ↔ invalid" 的类切换，让 shake 动画每秒重播多次。
    // 这里用 relatedTarget 判断：如果下一个即将被悬停的节点仍然在
    // 本次 leave 目标（wrapper）的 DOM 内部，就忽略这次 leave。
    const wrapper = e.currentTarget as HTMLElement | null;
    const next = e.relatedTarget as Node | null;
    if (wrapper && next && wrapper.contains(next)) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    // 对称地清理外部区域定时器，避免中心离开后 outside 残留状态被恢复。
    if (outsideDebounceTimerRef.current) {
      clearTimeout(outsideDebounceTimerRef.current);
      outsideDebounceTimerRef.current = null;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      commitDragOverState(null, null);
      debounceTimerRef.current = null;
    }, 50);
  }, [commitDragOverState]);

  const handleDragOverOutside = useCallback((iconId: string, position: 'before' | 'after') => {
    if (!draggedIcon || draggedIcon.id === iconId) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (outsideDebounceTimerRef.current) {
      clearTimeout(outsideDebounceTimerRef.current);
    }

    // 立即写入 ref
    lastPositionRef.current = { iconId, position };

    outsideDebounceTimerRef.current = window.setTimeout(() => {
      commitDragOverState(iconId, position);
      outsideDebounceTimerRef.current = null;
    }, 30);
  }, [draggedIcon, commitDragOverState]);

  const handleDropOnIcon = useCallback((e: React.DragEvent, targetIconId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // 关键：drop 瞬间必须先清掉所有待执行的防抖回调。
    // 否则，drop 发生前那一刻刚排进队列的 dragover 30ms 定时器，
    // 会在 setDragOverIcon(null) 之后重新写入 dragOverIcon/dragOverPosition，
    // 导致目标文件夹的绿色指示框"偶发"残留。
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (outsideDebounceTimerRef.current) {
      clearTimeout(outsideDebounceTimerRef.current);
      outsideDebounceTimerRef.current = null;
    }

    commitDragOverState(null, null);

    if (!draggedIcon || draggedIcon.id === targetIconId) {
      lastPositionRef.current = null;
      return;
    }

    const draggedIconObj = icons.find(icon => icon.id === draggedIcon.id);
    const targetIconObj = icons.find(icon => icon.id === targetIconId);

    if (!draggedIconObj || !targetIconObj) {
      lastPositionRef.current = null;
      return;
    }

    // 优先使用 ref 中同步记录的最新位置（覆盖左右外部拖放区域的情况）
    let calculatedPosition: DragPosition | null = null;
    if (lastPositionRef.current && lastPositionRef.current.iconId === targetIconId) {
      calculatedPosition = lastPositionRef.current.position;
    }
    lastPositionRef.current = null;

    // 如果 ref 中没有，则根据当前事件位置重新计算（与 handleDragOverIcon 保持一致的分区规则）
    if (!calculatedPosition) {
      const isTargetFolder = targetIconObj.isFolder || false;
      const isDraggedFolder = draggedIconObj.isFolder || false;
      const canCenterDrop =
        (isTargetFolder && !isDraggedFolder) ||
        (!isTargetFolder && allowFolderCreation && !isDraggedFolder);

      const target = e.currentTarget as HTMLElement;
      const wrapper = target.closest('.icon-wrapper, .icon-item');
      const rect = (wrapper ?? target).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const leftThreshold = rect.width * 0.25;
      const rightThreshold = rect.width * 0.75;

      if (x < leftThreshold) {
        calculatedPosition = 'before';
      } else if (x >= rightThreshold) {
        calculatedPosition = 'after';
      } else if (canCenterDrop) {
        calculatedPosition = 'center';
      } else {
        calculatedPosition = 'invalid';
      }
    }

    // invalid 中心投放：不交给外部处理器，也不做排序；直接结束拖拽。
    if (calculatedPosition === 'invalid') {
      setDraggedIcon(null);
      return;
    }

    // 首先尝试交给外部处理器（放入文件夹 / 创建文件夹），仅 center 能被外部处理。
    if (onHandleDrop) {
      const handled = onHandleDrop(e, targetIconId, draggedIconObj, targetIconObj, calculatedPosition);
      if (handled) {
        setDraggedIcon(null);
        return;
      }
    }

    // 未被外部处理，则执行排序逻辑
    if (calculatedPosition === 'before' || calculatedPosition === 'after') {
      const draggedIndex = icons.findIndex(icon => icon.id === draggedIcon.id);
      const targetIndex = icons.findIndex(icon => icon.id === targetIconId);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedIcon(null);
        return;
      }

      const newIcons = [...icons];
      newIcons.splice(draggedIndex, 1);
      let insertIndex: number;
      if (calculatedPosition === 'before') {
        insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      } else {
        insertIndex = draggedIndex < targetIndex ? targetIndex : targetIndex + 1;
      }
      newIcons.splice(insertIndex, 0, draggedIconObj);

      onIconsChange(newIcons);
      setDraggedIcon(null);
    }
  }, [draggedIcon, icons, allowFolderCreation, onHandleDrop, onIconsChange, setDraggedIcon]);

  const isDragging = useCallback((iconId: string) => {
    return draggedIcon?.id === iconId;
  }, [draggedIcon]);

  const isDragOverIcon = useCallback((iconId: string) => {
    return dragOverIcon === iconId;
  }, [dragOverIcon]);

  return {
    draggedIcon,
    dragOverIcon,
    dragOverPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOverIcon,
    handleDragOverOutside,
    handleDragLeaveIcon,
    handleDropOnIcon,
    isDragging,
    isDragOverIcon,
    setDraggedIcon,
    setDragOverPosition,
  };
};