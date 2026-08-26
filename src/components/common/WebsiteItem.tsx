import React, { useState, useRef, useCallback, memo } from 'react';
import IconItem from './IconItem';
import type { Website } from '../../types';
import { isTouchDevice } from '../../utils/deviceUtils';
import { useLongPress } from '../../hooks/useLongPress';
import { useClickOutside } from '../../hooks/useClickOutside';
import './WebsiteItem.css';

interface WebsiteItemProps {
  icon: Website;
  onDragStart?: ((e: React.DragEvent, icon: Website) => void) | undefined;
  onDragEnd?: (() => void) | undefined;
  isDragging?: boolean | undefined;
  draggable?: boolean | undefined;
  onDragOver?: ((e: React.DragEvent) => void) | undefined;
  onDragLeave?: ((e: React.DragEvent) => void) | undefined;
  onDropOnIcon?: ((e: React.DragEvent) => void) | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: ('before' | 'after' | 'center' | 'invalid' | null) | undefined;
  onEdit?: ((icon: Website) => void) | undefined;
  onDelete?: ((iconId: string) => void) | undefined;
  onMoveToPage?: ((icon: Website) => void) | undefined;
  onDragOverOutside?: ((position: 'before' | 'after') => void) | undefined;
}

const WebsiteItem: React.FC<WebsiteItemProps> = ({
  icon,
  onDragStart,
  onDragEnd,
  isDragging,
  draggable = false,
  onDragOver,
  onDragLeave,
  onDropOnIcon,
  isDragOverIcon,
  dragOverPosition,
  onEdit,
  onDelete,
  onMoveToPage,
  onDragOverOutside,
}) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const pressPositionRef = useRef({ x: 0, y: 0 });

  const handleItemClick = useCallback(() => {
    window.open(icon.url, '_blank', 'noopener,noreferrer');
  }, [icon.url]);

  const showMenuAtPosition = useCallback((clientX: number, clientY: number) => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
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
    showMenuAtPosition(e.clientX, e.clientY);
  }, [showMenuAtPosition]);

  const handleLongPress = useCallback(() => {
    showMenuAtPosition(pressPositionRef.current.x, pressPositionRef.current.y);
  }, [showMenuAtPosition]);

  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useLongPress(
    handleLongPress,
    { delay: 500, checkEmptyArea: false, moveThreshold: 10 }
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    pressPositionRef.current = { x: touch.clientX, y: touch.clientY };
    handleTouchStart(e);
  }, [handleTouchStart]);

  const handleEdit = useCallback(() => {
    onEdit?.(icon);
    setShowContextMenu(false);
  }, [onEdit, icon]);

  const handleDelete = useCallback(() => {
    onDelete?.(icon.id);
    setShowContextMenu(false);
  }, [onDelete, icon.id]);

  const handleMoveToPage = useCallback(() => {
    onMoveToPage?.(icon);
    setShowContextMenu(false);
  }, [onMoveToPage, icon]);

  // 键盘导航支持
  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent, action: 'edit' | 'delete' | 'move') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'edit') {
        handleEdit();
      } else if (action === 'move') {
        handleMoveToPage();
      } else {
        handleDelete();
      }
    }
  }, [handleEdit, handleDelete, handleMoveToPage]);

  const handleClickOutside = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  useClickOutside(menuRef, {
    handler: handleClickOutside,
    enabled: showContextMenu,
  });

  return (
    <div
      className="website-item-wrapper"
      ref={itemRef}
      role="listitem"
      aria-label={icon.name}
      style={{ position: 'relative' }}
      onTouchStart={onTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <IconItem
        icon={icon}
        onClick={handleItemClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        isDragging={isDragging}
        draggable={draggable}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDropOnIcon}
        isDragOverIcon={isDragOverIcon}
        dragOverPosition={dragOverPosition}
        onContextMenu={handleContextMenu}
        onDragOverOutside={onDragOverOutside}
      />
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
              onClick={handleEdit}
              onKeyDown={(e) => handleMenuKeyDown(e, 'edit')}
            >
              修改
            </li>
            <li
              className="context-menu-item"
              role="menuitem"
              tabIndex={0}
              onClick={handleMoveToPage}
              onKeyDown={(e) => handleMenuKeyDown(e, 'move')}
            >
              移动到页面…
            </li>
            <li
              className="context-menu-item context-menu-item-danger"
              role="menuitem"
              tabIndex={0}
              onClick={handleDelete}
              onKeyDown={(e) => handleMenuKeyDown(e, 'delete')}
            >
              删除
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default memo(WebsiteItem);