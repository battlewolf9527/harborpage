import React from 'react';
import type { Website } from '../../types';

type DragOverPosition = 'before' | 'after' | 'center' | 'invalid' | null;

interface DraggableIconWrapperProps {
  icon: Website;
  isDragging?: boolean | undefined;
  draggable?: boolean | undefined;
  onDragStart?: ((e: React.DragEvent, icon: Website) => void) | undefined;
  onDragEnd?: (() => void) | undefined;
  onDragOver?: ((e: React.DragEvent) => void) | undefined;
  onDragLeave?: ((e: React.DragEvent) => void) | undefined;
  onDrop?: ((e: React.DragEvent) => void) | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: DragOverPosition | undefined;
  onDragOverOutside?: ((position: 'before' | 'after') => void) | undefined;
  onClick?: (() => void) | undefined;
  onContextMenu?: ((e: React.MouseEvent) => void) | undefined;
  role?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}

const DraggableIconWrapper: React.FC<DraggableIconWrapperProps> = ({
  icon,
  isDragging,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOverIcon,
  dragOverPosition,
  onDragOverOutside,
  onClick,
  onContextMenu,
  role,
  ariaLabel,
  children,
}) => {
  const wrapperClassName = `icon-wrapper ${isDragOverIcon ? 'drag-over' : ''} ${
    dragOverPosition === 'before' ? 'drag-over-before' : ''
  } ${dragOverPosition === 'after' ? 'drag-over-after' : ''} ${
    dragOverPosition === 'center' ? 'drag-over-center' : ''
  } ${dragOverPosition === 'invalid' ? 'drag-over-invalid' : ''}`;

  const handleDragOverOutside = (position: 'before' | 'after') => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOverOutside?.(position);
  };

  return (
    <div className={`icon-item ${isDragging ? 'dragging' : ''}`}>
      {/* 左侧外部拖放区域 */}
      <div
        className="icon-drop-zone icon-drop-zone-left"
        data-icon-id={icon.id}
        onDragOver={handleDragOverOutside('before')}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />

      <div
        draggable={draggable}
        data-icon-id={icon.id}
        onDragStart={onDragStart ? (e) => onDragStart(e, icon) : undefined}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={wrapperClassName}
        role={role}
        aria-label={ariaLabel}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onMouseDown={(e) => {
          if (!draggable) {
            e.preventDefault();
          }
        }}
      >
        {children}
      </div>

      {/* 右侧外部拖放区域 */}
      <div
        className="icon-drop-zone icon-drop-zone-right"
        data-icon-id={icon.id}
        onDragOver={handleDragOverOutside('after')}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />
    </div>
  );
};

export default React.memo(DraggableIconWrapper);