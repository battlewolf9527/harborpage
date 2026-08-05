import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './IconsContainer.css';
import IconGrid from '../common/IconGrid';
import type { Website } from '../../types';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useIconDropHandler } from '../../hooks/useIconDropHandler';
import { useIconsStore } from '../../store/useIconsStore';

interface IconsContainerProps {
  websites: Website[];
  iconColumns: number;
  onIconsChange: (icons: Website[]) => void;
  onOpenFolder: (id: string, name: string, websites: Website[]) => void;
  onEditIcon?: (icon: Website) => void;
  onDeleteIcon?: (iconId: string) => void;
}

const IconsContainer: React.FC<IconsContainerProps> = memo(({
  websites,
  iconColumns,
  onIconsChange,
  onOpenFolder,
  onEditIcon,
  onDeleteIcon,
}) => {
  const [showScrollbar, setShowScrollbar] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const { draggedIcon, setDraggedIcon } = useIconsStore(
    useShallow((s) => ({ draggedIcon: s.draggedIcon, setDraggedIcon: s.setDraggedIcon })),
  );

  const handleDrop = useIconDropHandler(websites, onIconsChange);

  const {
    dragOverPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOverIcon,
    handleDragOverOutside,
    handleDragLeaveIcon,
    handleDropOnIcon,
    isDragging,
    isDragOverIcon,
  } = useDragAndDrop({
    icons: websites,
    onIconsChange,
    allowFolderCreation: true,
    draggedIcon,
    setDraggedIcon,
    onHandleDrop: handleDrop
  });

  const handleScroll = useCallback(() => {
    setShowScrollbar(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.setTimeout(() => {
      setShowScrollbar(false);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`icons-container ${showScrollbar ? 'show-scrollbar' : ''}`}
      data-click-area="empty"
      onScroll={handleScroll}
    >
      <IconGrid
        icons={websites}
        iconColumns={iconColumns}
        onOpenFolder={onOpenFolder}
        onEditIcon={onEditIcon}
        onDeleteIcon={onDeleteIcon}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOverIcon={handleDragOverIcon}
        onDragLeaveIcon={handleDragLeaveIcon}
        onDropOnIcon={handleDropOnIcon}
        onDragOverOutside={handleDragOverOutside}
        isDragging={isDragging}
        isDragOverIcon={isDragOverIcon}
        dragOverPosition={dragOverPosition}
        allowFolders={true}
      />
    </div>
  );
});

export default IconsContainer;