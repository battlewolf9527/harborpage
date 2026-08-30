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
  label?: React.ReactNode;
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
  label,
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

  // drop zone 的 onDrop 必须阻止冒泡，否则事件会向上冒泡到父级 .icon-wrapper 的 onDrop，
  // 导致同一次 drop 触发两次 handleDropOnIcon，潜在的状态竞争/级联崩溃风险
  const handleDropOnZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop?.(e);
  };

  return (
    <div className={`icon-item ${isDragging ? 'dragging' : ''}`}>
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
        {/* 左侧外部拖放区域：放在 wrapper 内部，确保始终紧贴 wrapper 左侧 */}
        <div
          className="icon-drop-zone icon-drop-zone-left"
          data-icon-id={icon.id}
          onDragOver={handleDragOverOutside('before')}
          onDragLeave={onDragLeave}
          onDrop={handleDropOnZone}
        />
        {children}
        {/* 右侧外部拖放区域：放在 wrapper 内部，确保始终紧贴 wrapper 右侧 */}
        <div
          className="icon-drop-zone icon-drop-zone-right"
          data-icon-id={icon.id}
          onDragOver={handleDragOverOutside('after')}
          onDragLeave={onDragLeave}
          onDrop={handleDropOnZone}
        />
      </div>

      {/* label 放在 icon-wrapper 外部，宽度不再受 wrapper 限制，可达到 grid 单元格宽度 */}
      {label}
    </div>
  );
};

export default React.memo(DraggableIconWrapper);