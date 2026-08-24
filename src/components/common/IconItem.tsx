import React, { memo } from 'react';
import type { Website } from '../../types';
import { handleIconLoadError } from '../../services/iconUtils';
import { IconType, isUrlLike } from '../../services/IconManager';
import { getServices } from '../../services/serviceContainer';
import DraggableIconWrapper from './DraggableIconWrapper';
import './IconItem.css';

interface IconItemProps {
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
  onContextMenu?: ((e: React.MouseEvent) => void) | undefined;
  onDragOverOutside?: ((position: 'before' | 'after') => void) | undefined;
}

const IconItem: React.FC<IconItemProps> = ({
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
  onContextMenu,
  onDragOverOutside,
}) => {
  const { iconManager } = getServices();
  const iconContent = iconManager.getIconUrlSync(IconType.SITE, icon);

  const isUrl = iconContent && (iconContent.startsWith('http://') || iconContent.startsWith('https://') || iconContent.startsWith('/api/') || iconContent.startsWith('data:'));
  // 判断是否为纯文本图标（用户输入的文字，由 generateColoredTextSvg 生成 SVG）
  // 此时 iconColor 已作为文字颜色使用，不再作为 img 背景色
  const isTextIcon = !!icon.icon && !isUrlLike(icon.icon) && !icon.icon.startsWith('data:');
  // 图标底色：仅对非文字图标应用为 img 背景色
  const imgStyle = icon.iconColor && !isTextIcon ? { background: icon.iconColor } : undefined;

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
      onContextMenu={onContextMenu}
      label={<div className="icon-label">{icon.name}</div>}
    >
      <div className="icon-circle">
        {isUrl ? (
          <img
            src={iconContent}
            alt={icon.name}
            className="icon-image"
            loading="lazy"
            referrerPolicy="no-referrer"
            style={imgStyle}
            onError={(e) => handleIconLoadError(e, icon)}
          />
        ) : (
          iconContent || '🌐'
        )}
      </div>
    </DraggableIconWrapper>
  );
};

export default memo(IconItem);