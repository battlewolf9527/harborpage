import React, { useMemo, memo } from 'react';
import './FolderItem.css';
import { IconType, isUrlLike } from '../../services/IconManager';
import type { Website } from '../../types';
import { handleIconLoadError } from '../../services/iconUtils';
import { getServices } from '../../services/serviceContainer';
import DraggableIconWrapper from './DraggableIconWrapper';

interface FolderItemProps {
  icon: Website;
  onClick?: (() => void) | undefined;
  onDragStart?: ((e: React.DragEvent, icon: Website) => void) | undefined;
  onDragEnd?: (() => void) | undefined;
  isDragging?: boolean | undefined;
  draggable?: boolean | undefined;
  onDragOver?: ((e: React.DragEvent) => void) | undefined;
  onDragLeave?: ((e: React.DragEvent) => void) | undefined;
  onDrop?: ((e: React.DragEvent) => void) | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: ('before' | 'after' | 'center' | 'invalid' | null) | undefined;
  onDragOverOutside?: ((position: 'before' | 'after') => void) | undefined;
}

const FolderItem: React.FC<FolderItemProps> = ({
  icon,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  draggable = false,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOverIcon,
  dragOverPosition,
  onDragOverOutside,
}) => {
  const { iconManager } = getServices();
  const childIcons = useMemo(() => {
    return icon.children?.slice(0, 4) || [];
  }, [icon.children]);

  return (
    <DraggableIconWrapper
      icon={icon}
      isDragging={isDragging}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      isDragOverIcon={isDragOverIcon}
      dragOverPosition={dragOverPosition}
      onDragOverOutside={onDragOverOutside}
      onClick={onClick}
      role="listitem"
      ariaLabel={icon.name}
    >
      <div className="icon-circle folder-icon-grid">
        {childIcons.length > 0 ? (
          <div className="folder-preview-grid">
            {childIcons.map((child) => {
              // 文字图标的 iconColor 已作为文字颜色使用，不再作为背景
              const isTextIcon = !!child.icon && !isUrlLike(child.icon) && !child.icon.startsWith('data:');
              const imgStyle = child.iconColor && !isTextIcon ? { background: child.iconColor } : undefined;
              return (
                <div key={child.id} className="folder-preview-item">
                  <img
                    src={iconManager.getIconUrlSync(IconType.SITE, child)}
                    alt={child.name}
                    className="folder-preview-image"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    style={imgStyle}
                    onError={(e) => handleIconLoadError(e, child)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <span className="folder-empty-icon">📁</span>
        )}
      </div>
      <div className="icon-label">{icon.name}</div>
    </DraggableIconWrapper>
  );
};

export default memo(FolderItem);