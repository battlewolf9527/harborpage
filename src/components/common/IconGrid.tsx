import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import WebsiteItem from '../common/WebsiteItem';
import FolderItem from '../common/FolderItem';
import type { Website } from '../../types';
import type { DragPosition } from '../../hooks/useDragAndDrop';
import './IconGrid.css';

interface IconGridProps {
  icons: Website[];
  iconColumns: number;
  onOpenFolder?: ((id: string, name: string, websites: Website[]) => void) | undefined;
  onEditIcon: ((icon: Website) => void) | undefined;
  onDeleteIcon: ((iconId: string) => void) | undefined;
  onMoveToPage?: ((icon: Website) => void) | undefined;
  onDragStart: (e: React.DragEvent, icon: Website) => void;
  onDragEnd: () => void;
  onDragOverIcon: (e: React.DragEvent, iconId: string) => void;
  onDragLeaveIcon: (e: React.DragEvent) => void;
  onDropOnIcon: (e: React.DragEvent, iconId: string) => void;
  onDragOverOutside: (iconId: string, position: 'before' | 'after') => void;
  isDragging: (iconId: string) => boolean;
  isDragOverIcon: (iconId: string) => boolean;
  dragOverPosition: DragPosition | null;
  allowFolders: boolean;
  onBeforeDrop?: (() => void) | undefined;
}

/**
 * 计算容器宽度下最多能容纳多少列图标，确保每个图标单元不被挤压裁剪。
 *
 * 保守估算策略（宁可少一列也绝不溢出裁剪）：
 *   - minColWidth = 120px：比 IconItem.css 里 icon-wrapper 的最小宽度 72px 大很多，
 *     预留 label 的宽度空间；同时比 IconsContainer.css 的基础 minmax(128px,1fr) 略小，
 *     小屏断点下 minmax 降为 120/110/90px 时，120px 作为保守值仍安全。
 *   - gap = 24px：比基础 gap 28px 略小，计算出来的 colCount 只会偏小不会偏大。
 *
 * 公式：W = cols * M + (cols-1) * G  →  cols = floor((W + G) / (M + G))
 */
function calcSafeColumnCount(containerWidth: number): number {
  const MIN_COL_WIDTH = 120;
  const GAP = 24;
  if (containerWidth <= 0) return 3;
  const raw = Math.floor((containerWidth + GAP) / (MIN_COL_WIDTH + GAP));
  return Math.max(3, raw);
}

const IconGrid: React.FC<IconGridProps> = ({
  icons,
  iconColumns,
  onOpenFolder,
  onEditIcon,
  onDeleteIcon,
  onMoveToPage,
  onDragStart,
  onDragEnd,
  onDragOverIcon,
  onDragLeaveIcon,
  onDropOnIcon,
  onDragOverOutside,
  isDragging,
  isDragOverIcon,
  dragOverPosition,
  allowFolders,
  onBeforeDrop,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  // 测量得到的容器实际内容宽度（px），用于计算 safeCols
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // 初始测量 + 监听 resize（防抖 100ms，避免拖动调整时频繁重排）
  useLayoutEffect(() => {
    if (!gridRef.current) return;
    const el = gridRef.current;
    // 先立即读一次，避免 SSR / 首次渲染闪一下再跳
    setContainerWidth(el.clientWidth);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const newWidth = entry.contentRect.width;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setContainerWidth((prev) => (Math.abs(prev - newWidth) < 1 ? prev : newWidth));
      }, 100);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // 最终生效的列数：取【用户设置上限】与【容器物理安全上限】两者中较小的那个
  const safeCols = containerWidth > 0 ? calcSafeColumnCount(containerWidth) : iconColumns;
  const actualCols = Math.max(3, Math.min(iconColumns, safeCols));

  // 稳定的回调工厂：通过 data-icon-id 属性传递 id，避免内联函数
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const iconId = (e.currentTarget as HTMLElement).dataset.iconId;
    if (iconId) onDragOverIcon(e, iconId);
  }, [onDragOverIcon]);

  const handleFolderDrop = useCallback((e: React.DragEvent) => {
    const iconId = (e.currentTarget as HTMLElement).dataset.iconId;
    if (iconId) onDropOnIcon(e, iconId);
  }, [onDropOnIcon]);

  const handleWebsiteDrop = useCallback((e: React.DragEvent) => {
    onBeforeDrop?.();
    const iconId = (e.currentTarget as HTMLElement).dataset.iconId;
    if (iconId) onDropOnIcon(e, iconId);
  }, [onBeforeDrop, onDropOnIcon]);

  const handleFolderClick = useCallback((icon: Website) => {
    onOpenFolder?.(icon.id, icon.name, icon.children || []);
  }, [onOpenFolder]);

  return (
    <div
      ref={gridRef}
      className="icon-grid"
      data-click-area="grid"
      role="list"
      aria-label="网站图标列表"
      style={{
        /* actualCols = min(用户设置7, 物理上限)。竖屏/窄屏下自动降到能容纳的列数，
           保证每列实际宽度 ≥ ~120px，图标圆圈和标签绝不被挤压/裁剪。
           minmax(0, 1fr) 让 1fr 从 0 开始分配（而不是 auto 内容宽度），
           与 calcSafeColumnCount 的下限配合，能稳定实现 N 列平均分布。 */
        gridTemplateColumns: `repeat(${actualCols}, minmax(0, 1fr))`,
      }}
    >
      {icons.map((icon) => {
        const isFolder = icon.isFolder && allowFolders;
        const dragging = isDragging(icon.id);
        const dragOver = isDragOverIcon(icon.id);
        const overPosition = dragOver ? dragOverPosition : null;

        const sharedProps = {
          key: icon.id,
          icon,
          onDragStart,
          onDragEnd,
          isDragging: dragging,
          draggable: true,
          onDragOver: handleDragOver,
          onDragLeave: onDragLeaveIcon,
          isDragOverIcon: dragOver,
          dragOverPosition: overPosition,
          onDragOverOutside: (position: 'before' | 'after') => onDragOverOutside(icon.id, position),
          'data-icon-id': icon.id,
        };

        if (isFolder) {
          return (
            <FolderItem
              {...sharedProps}
              onClick={() => handleFolderClick(icon)}
              onDrop={handleFolderDrop}
              onMoveToPage={onMoveToPage}
            />
          );
        }

        return (
          <WebsiteItem
            {...sharedProps}
            onDropOnIcon={handleWebsiteDrop}
            onEdit={onEditIcon}
            onDelete={onDeleteIcon}
            onMoveToPage={onMoveToPage}
          />
        );
      })}
    </div>
  );
};

export default React.memo(IconGrid);