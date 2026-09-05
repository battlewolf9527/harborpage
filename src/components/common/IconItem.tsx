import React, { memo } from 'react';
import type { Website } from '../../types';
import { handleIconLoadError } from '../../services/iconUtils';
import { IconType } from '../../services/IconManager';
import { getServices } from '../../services/serviceContainer';
import { usePaletteStore } from '../../store/usePaletteStore';
import { resolveIconHslVars } from '../../utils/paletteColors';
import DraggableIconWrapper from './DraggableIconWrapper';
import CrystalShell from './CrystalShell';
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
  const slots = usePaletteStore((s) => s.slots);
  const iconContent = iconManager.getIconUrlSync(IconType.SITE, icon);

  const isUrl = iconContent && (iconContent.startsWith('http://') || iconContent.startsWith('https://') || iconContent.startsWith('/api/') || iconContent.startsWith('data:'));
  // 水晶材质主色：绑定槽→槽当前色；旧 hex→静态；未设置→缺省材质色（调色板 1 号槽）
  const crystalStyle = resolveIconHslVars(icon, slots) as React.CSSProperties | undefined;

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
      <div className="icon-circle" style={crystalStyle}>
        <CrystalShell />
        <span className="crystal-content">
          {isUrl ? (
            <img
              src={iconContent}
              alt={icon.name}
              className="icon-image"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => handleIconLoadError(e, icon)}
              /* 关键：禁用 <img> 原生 draggable。
                 HTML5 Drag & Drop 规范规定"浏览器选择最内层的 draggable=true 元素作为 drag source"。
                 <img> 默认 draggable=true（浏览器原生允许拖图片到桌面/其他应用），
                 而且是 draggable 属性出现之前就内置的隐式行为，优先级比外层的显式 draggable 更高。
                 结果：当用户按下 icon-circle 上的图片开始拖，浏览器把 <img> 当成 drag source，
                      生成 drag image 用的是图片内容；配合 loading="lazy" + 4K 大图未解码，
                      Chromium 内核会**静默取消整个 drag 操作**（dragstart 事件还能冒泡触发我们的
                      handler 写入 draggedIcon state，但内核不再发送 dragover/drop，图标看起来完全拖不动）。
                 修复：draggable={false} 告诉浏览器"不要拿这个图片当 drag source"，
                      浏览器就会沿 DOM 往上找最近 draggable=true 的祖先 —
                      DraggableIconWrapper 的 .icon-item，完全走我们的自定义 drag & drop 链路。 */
              draggable={false}
            />
          ) : (
            iconContent || '🌐'
          )}
        </span>
      </div>
    </DraggableIconWrapper>
  );
};

export default memo(IconItem);