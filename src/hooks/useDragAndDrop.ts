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

  // 组件卸载时清理所有防抖定时器，避免泄露
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
    };
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, icon: Website) => {
    setDraggedIcon(icon);
    lastPositionRef.current = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', icon.id);
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
    setDragOverIcon(null);
    setDragOverPosition(null);
  }, [setDraggedIcon]);

  const handleDragOverIcon = useCallback((e: React.DragEvent, iconId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedIcon || draggedIcon.id === iconId) {
      return;
    }

    const targetIcon = icons.find(icon => icon.id === iconId);
    const isTargetFolder = targetIcon?.isFolder || false;

    let position: DragPosition;
    if ((isTargetFolder && !draggedIcon.isFolder) ||
        (!isTargetFolder && allowFolderCreation && !draggedIcon.isFolder)) {
      position = 'center';
    } else {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const centerX = rect.width * 0.5;
      position = x < centerX ? 'before' : 'after';
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
      setDragOverIcon(iconId);
      setDragOverPosition(position);
      debounceTimerRef.current = null;
    }, 30);
  }, [draggedIcon, icons, allowFolderCreation]);

  const handleDragLeaveIcon = useCallback(() => {
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
      setDragOverIcon(null);
      setDragOverPosition(null);
      debounceTimerRef.current = null;
    }, 50);
  }, []);

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
      setDragOverIcon(iconId);
      setDragOverPosition(position);
      outsideDebounceTimerRef.current = null;
    }, 30);
  }, [draggedIcon]);

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

    setDragOverIcon(null);
    setDragOverPosition(null);

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

    // 如果 ref 中没有，则根据当前事件位置计算
    if (!calculatedPosition) {
      const isTargetFolder = targetIconObj.isFolder || false;
      if ((isTargetFolder && !draggedIconObj.isFolder) ||
          (!isTargetFolder && allowFolderCreation && !draggedIconObj.isFolder)) {
        calculatedPosition = 'center';
      } else {
        const target = e.currentTarget as HTMLElement;
        const wrapper = target.closest('.icon-wrapper, .icon-item');
        const rect = (wrapper ?? target).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const centerX = rect.width * 0.5;
        calculatedPosition = x < centerX ? 'before' : 'after';
      }
    }

    // 首先尝试交给外部处理器（放入文件夹 / 创建文件夹）
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