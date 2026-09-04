import React, { useMemo, memo, useState, useRef, useCallback } from 'react';
import './FolderItem.css';
import { IconType } from '../../services/IconManager';
import type { Website } from '../../types';
import { handleIconLoadError } from '../../services/iconUtils';
import { getServices } from '../../services/serviceContainer';
import DraggableIconWrapper from './DraggableIconWrapper';
import CrystalShell from './CrystalShell';
import { isTouchDevice } from '../../utils/deviceUtils';
import { useLongPress } from '../../hooks/useLongPress';
import { useClickOutside } from '../../hooks/useClickOutside';
import { usePaletteStore } from '../../store/usePaletteStore';
import { resolveIconHslVars } from '../../utils/paletteColors';

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
  onMoveToPage?: ((icon: Website) => void) | undefined;
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
  onMoveToPage,
}) => {
  const { iconManager } = getServices();
  const slots = usePaletteStore((s) => s.slots);

  // 水晶材质主色：绑定槽→槽当前色；旧 hex→静态；未设置→CSS 缺省晶蓝
  const crystalStyle = useMemo(
    () => resolveIconHslVars(icon, slots) as React.CSSProperties | undefined,
    [icon, slots],
  );

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pressPositionRef = useRef({ x: 0, y: 0 });

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

  const handleLongPress = useCallback(() => {
    showMenuAtPosition(pressPositionRef.current.x, pressPositionRef.current.y);
  }, [showMenuAtPosition]);

  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useLongPress(
    handleLongPress,
    { delay: 500, checkEmptyArea: false, moveThreshold: 10 },
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    pressPositionRef.current = { x: touch.clientX, y: touch.clientY };
    handleTouchStart(e);
  }, [handleTouchStart]);

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
      onTouchStart={onTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
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
                        /* 与 IconItem 里的 icon-image 同样修复：
                           <img> 原生 draggable=true 会抢占外层 FolderItem wrapper 的 draggable，
                           导致文件夹整体拖不动。draggable={false} 强制用 wrapper 作为 drag source。 */
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
          aria-label="操作菜单"
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
              移动到页面…
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default memo(FolderItem);