import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import IconItem from './IconItem';
import type { Website } from '../../types';
import type { DragHandleProps } from '../../hooks/usePointerDrag';
import { isTouchDevice } from '../../utils/deviceUtils';
import { useClickOutside } from '../../hooks/useClickOutside';
import './WebsiteItem.css';

interface WebsiteItemProps {
  icon: Website;
  dragHandleProps?: DragHandleProps | undefined;
  isDragging?: boolean | undefined;
  isDragOverIcon?: boolean | undefined;
  dragOverPosition?: ('before' | 'after' | 'center' | 'invalid' | null) | undefined;
  /** 触屏长按起拖后未移动即松手：需要在本条目处弹出上下文菜单（视口坐标） */
  menuAnchor?: { x: number; y: number } | null | undefined;
  /** 菜单已弹出，通知上层清空这次长按请求 */
  onMenuAnchorConsumed?: (() => void) | undefined;
  onEdit?: ((icon: Website) => void) | undefined;
  onDelete?: ((iconId: string) => void) | undefined;
  onMoveToPage?: ((icon: Website) => void) | undefined;
}

const WebsiteItem: React.FC<WebsiteItemProps> = ({
  icon,
  dragHandleProps,
  isDragging,
  isDragOverIcon,
  dragOverPosition,
  menuAnchor,
  onMenuAnchorConsumed,
  onEdit,
  onDelete,
  onMoveToPage,
}) => {
  const { t } = useTranslation('sites');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

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

  // 触屏长按菜单由拖拽引擎产出（长按起拖后未移动即松手），这里只负责把它落到本条目上。
  // 桌面端右键走 handleContextMenu，两条路径共用同一个菜单。
  useEffect(() => {
    if (!menuAnchor) return;
    showMenuAtPosition(menuAnchor.x, menuAnchor.y);
    onMenuAnchorConsumed?.();
  }, [menuAnchor, showMenuAtPosition, onMenuAnchorConsumed]);

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
    >
      <IconItem
        icon={icon}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
        isDragOverIcon={isDragOverIcon}
        dragOverPosition={dragOverPosition}
        onClick={handleItemClick}
        onContextMenu={handleContextMenu}
      />
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
              onClick={handleEdit}
              onKeyDown={(e) => handleMenuKeyDown(e, 'edit')}
            >
              {t('contextMenu.edit')}
            </li>
            <li
              className="context-menu-item"
              role="menuitem"
              tabIndex={0}
              onClick={handleMoveToPage}
              onKeyDown={(e) => handleMenuKeyDown(e, 'move')}
            >
              {t('contextMenu.moveToPage')}
            </li>
            <li
              className="context-menu-item context-menu-item-danger"
              role="menuitem"
              tabIndex={0}
              onClick={handleDelete}
              onKeyDown={(e) => handleMenuKeyDown(e, 'delete')}
            >
              {t('contextMenu.delete')}
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default memo(WebsiteItem);
