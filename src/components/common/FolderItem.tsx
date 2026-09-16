import React, { useMemo, memo, useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './FolderItem.css';
import { IconType } from '../../services/IconManager';
import type { Website } from '../../types';
import { handleIconLoadError } from '../../services/iconUtils';
import { getServices } from '../../services/serviceContainer';
import DraggableIconWrapper from './DraggableIconWrapper';
import CrystalShell from './CrystalShell';
import { isTouchDevice } from '../../utils/deviceUtils';
import type { DragHandleProps } from '../../hooks/usePointerDrag';
import { useClickOutside } from '../../hooks/useClickOutside';
import { usePaletteStore } from '../../store/usePaletteStore';
import { resolveIconHslVars } from '../../utils/paletteColors';

interface FolderItemProps {
  icon: Website;
  onClick?: (() => void) | undefined;
  dragHandleProps?: DragHandleProps | undefined;
  isDragging?: boolean | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: ('before' | 'after' | 'center' | 'invalid' | null) | undefined;
  /** 触屏长按起拖后未移动即松手：需要在本条目处弹出上下文菜单（视口坐标） */
  menuAnchor?: { x: number; y: number } | null | undefined;
  /** 菜单已弹出，通知上层清空这次长按请求 */
  onMenuAnchorConsumed?: (() => void) | undefined;
  onMoveToPage?: ((icon: Website) => void) | undefined;
}

const FolderItem: React.FC<FolderItemProps> = ({
  icon,
  onClick,
  dragHandleProps,
  isDragging,
  isDragOverIcon,
  dragOverPosition,
  menuAnchor,
  onMenuAnchorConsumed,
  onMoveToPage,
}) => {
  const { t } = useTranslation('folder');
  const { iconManager } = getServices();
  const slots = usePaletteStore((s) => s.slots);
  const lightness = usePaletteStore((s) => s.lightness);

  // 水晶材质主色：绑定槽→槽当前色；旧 hex→静态；未设置→缺省材质色（调色板 1 号槽）；
  // lightness = 全局明暗度（不改存储色，仅渲染时叠加到材质亮度通道）
  const crystalStyle = useMemo(
    () => resolveIconHslVars(icon, slots, lightness) as React.CSSProperties | undefined,
    [icon, slots, lightness],
  );

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const showMenuAtPosition = useCallback((clientX: number, clientY: number) => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setMenuPosition({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    } else {
      setMenuPosition({ x: clientX, y: clientY });
    }
    setShowContextMenu(true);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice()) return;
    e.preventDefault();
    e.stopPropagation();
    showMenuAtPosition(e.clientX, e.clientY);
  }, [showMenuAtPosition]);

  // 触屏长按菜单由拖拽引擎产出（长按起拖后未移动即松手），这里只负责把它落到本条目上。
  // 桌面端右键走 handleContextMenu，两条路径共用同一个菜单。
  useEffect(() => {
    if (!menuAnchor) return;
    showMenuAtPosition(menuAnchor.x, menuAnchor.y);
    onMenuAnchorConsumed?.();
  }, [menuAnchor, showMenuAtPosition, onMenuAnchorConsumed]);

  const handleMoveToPage = useCallback(() => {
    onMoveToPage?.(icon);
    setShowContextMenu(false);
  }, [onMoveToPage, icon]);

  const handleClickOutside = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  useClickOutside(menuRef, {
    handler: handleClickOutside,
    enabled: showContextMenu,
  });
  const childIcons = useMemo(() => {
    return icon.children?.slice(0, 4) || [];
  }, [icon.children]);

  return (
    <div
      className="folder-item-wrapper"
      ref={wrapperRef}
      role="listitem"
      aria-label={icon.name}
      style={{ position: 'relative' }}
      onContextMenu={handleContextMenu}
    >
      <DraggableIconWrapper
        icon={icon}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
        isDragOverIcon={isDragOverIcon}
        dragOverPosition={dragOverPosition}
        onClick={onClick}
        ariaLabel={icon.name}
        label={<div className="icon-label">{icon.name}</div>}
      >
        <div
          className="icon-circle folder-icon-grid"
          style={crystalStyle}
        >
          <CrystalShell />
          <span className="crystal-content">
            {childIcons.length > 0 ? (
              <div className="folder-preview-grid">
                {childIcons.map((child) => (
                  <div key={child.id} className="folder-preview-item">
                    <img
                      src={iconManager.getIconUrlSync(IconType.SITE, child)}
                      alt={child.name}
                      className="folder-preview-image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleIconLoadError(e, child)}
                      /* 与 IconItem 里的 icon-image 同理：<img> 默认是浏览器原生的 drag source，
                         按下图片会触发原生 HTML5 拖拽并派发 pointercancel，掐断我们的拖拽引擎。 */
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <span className="folder-empty-icon">📁</span>
            )}
          </span>
        </div>
      </DraggableIconWrapper>

      {showContextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          role="menu"
          aria-label={t('contextMenu.aria')}
          style={{
            top: `${menuPosition.y}px`,
            left: `${menuPosition.x}px`,
          }}
        >
          <ul>
            <li
              className="context-menu-item"
              role="menuitem"
              tabIndex={0}
              onClick={handleMoveToPage}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMoveToPage();
                }
              }}
            >
              {t('contextMenu.moveToPage')}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default memo(FolderItem);