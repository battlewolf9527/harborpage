import React, { useCallback } from 'react';
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
  onDragLeaveIcon: () => void;
  onDropOnIcon: (e: React.DragEvent, iconId: string) => void;
  onDragOverOutside: (iconId: string, position: 'before' | 'after') => void;
  isDragging: (iconId: string) => boolean;
  isDragOverIcon: (iconId: string) => boolean;
  dragOverPosition: DragPosition | null;
  allowFolders: boolean;
  onBeforeDrop?: (() => void) | undefined;
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
      className="icon-grid"
      data-click-area="grid"
      role="list"
      aria-label="网站图标列表"
      style={{
        gridTemplateColumns: `repeat(${iconColumns}, 1fr)`,
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