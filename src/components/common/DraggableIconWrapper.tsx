import React from 'react';
import type { Website } from '../../types';
import type { DragHandleProps } from '../../hooks/usePointerDrag';

type DragOverPosition = 'before' | 'after' | 'center' | 'invalid' | null;

interface DraggableIconWrapperProps {
  icon: Website;
  isDragging?: boolean | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: DragOverPosition | undefined;
  /**
   * 拖拽把手 props（Pointer Events），由 IconGrid 从拖拽引擎取来下发。
   * 注意 .icon-wrapper 上的 data-icon-id 是引擎做命中测试的锚点，不可删除。
   */
  dragHandleProps?: DragHandleProps | undefined;
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
  isDragOverIcon,
  dragOverPosition,
  dragHandleProps,
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

  return (
    <div className={`icon-item ${isDragging ? 'dragging' : ''}`}>
      <div
        data-icon-id={icon.id}
        className={wrapperClassName}
        role={role}
        aria-label={ariaLabel}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={dragHandleProps?.onPointerDown}
      >
        {children}
      </div>

      {/* label 放在 icon-wrapper 外部，宽度不再受 wrapper 限制，可达到 grid 单元格宽度 */}
      {label}
    </div>
  );
};

export default React.memo(DraggableIconWrapper);
