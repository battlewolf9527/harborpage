import React, { memo } from 'react';
import type { Website } from '../../types';
import { handleIconLoadError } from '../../services/iconUtils';
import { IconType } from '../../services/IconManager';
import { getServices } from '../../services/serviceContainer';
import { usePaletteStore } from '../../store/usePaletteStore';
import { resolveIconHslVars } from '../../utils/paletteColors';
import DraggableIconWrapper from './DraggableIconWrapper';
import CrystalShell from './CrystalShell';
import type { DragHandleProps } from '../../hooks/usePointerDrag';
import './IconItem.css';

interface IconItemProps {
  icon: Website;
  dragHandleProps?: DragHandleProps | undefined;
  isDragging?: boolean | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: ('before' | 'after' | 'center' | 'invalid' | null) | undefined;
  onClick?: (() => void) | undefined;
  onContextMenu?: ((e: React.MouseEvent) => void) | undefined;
}

const IconItem: React.FC<IconItemProps> = ({
  icon,
  dragHandleProps,
  isDragging,
  isDragOverIcon,
  dragOverPosition,
  onClick,
  onContextMenu,
}) => {
  const { iconManager } = getServices();
  const slots = usePaletteStore((s) => s.slots);
  const lightness = usePaletteStore((s) => s.lightness);
  const iconContent = iconManager.getIconUrlSync(IconType.SITE, icon);

  const isUrl = iconContent && (iconContent.startsWith('http://') || iconContent.startsWith('https://') || iconContent.startsWith('/api/') || iconContent.startsWith('data:'));
  // 水晶材质主色：绑定槽→槽当前色；旧 hex→静态；未设置→缺省材质色（调色板 1 号槽）；
  // lightness = 全局明暗度（不改存储色，仅渲染时叠加到材质亮度通道）
  const crystalStyle = resolveIconHslVars(icon, slots, lightness) as React.CSSProperties | undefined;

  return (
    <DraggableIconWrapper
      icon={icon}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
      isDragOverIcon={isDragOverIcon}
      dragOverPosition={dragOverPosition}
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
                 默认情况下 <img> 是浏览器原生的 drag source，按下图片即触发原生 HTML5 拖拽，
                 内核会随即派发 pointercancel，把我们的 Pointer Events 拖拽链路直接掐断。
                 draggable={false} 关掉原生拖拽，手势完全交给我们自己的拖拽引擎。 */
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
