import React, { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import './FolderWindow.css';
import IconGrid from '../common/IconGrid';
import type { Website } from '../../types';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useClickOutside } from '../../hooks/useClickOutside';

interface FolderWindowProps {
  folderName: string;
  icons: Website[];
  isOpen: boolean;
  onClose: () => void;
  iconColumns: number;
  onIconDragOut: (icon: Website) => void;
  onIconsChange: (icons: Website[]) => void;
  onFolderNameChange: (newName: string) => void;
  onEditIcon?: (icon: Website) => void;
  onDeleteIcon?: (iconId: string) => void;
  onDisbandFolder?: () => void;
  onDeleteFolder?: () => void;
  disableClickOutside?: boolean;
}

interface FolderHeaderProps {
  folderName: string;
  showEditButton: boolean;
  onEditStart: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}

const FolderHeader: React.FC<FolderHeaderProps> = memo(({
  folderName,
  showEditButton,
  onEditStart,
  onMouseEnter,
  onMouseLeave,
  onClose,
}) => (
  <div className="folder-header">
    <div className="folder-name-container">
      <div
        className="folder-name-display"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <h3 className="folder-title">{folderName}</h3>
        {showEditButton && (
          <button
            className="folder-edit-btn"
            onClick={onEditStart}
            aria-label="编辑文件夹名称"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
    <button className="folder-close-btn" onClick={onClose}>
      ✕
    </button>
  </div>
));

FolderHeader.displayName = 'FolderHeader';

interface FolderActionsProps {
  iconsCount: number;
  onDisband: () => void;
  onDelete: () => void;
}

const FolderActions: React.FC<FolderActionsProps> = memo(({
  iconsCount,
  onDisband,
  onDelete,
}) => (
  <div className="folder-actions">
    {iconsCount > 0 && (
      <button
        className="folder-action-btn disband-btn"
        onClick={onDisband}
        title="解散文件夹（释放所有图标）"
      >
        📂 解散
      </button>
    )}
    <button
      className="folder-action-btn delete-btn"
      onClick={onDelete}
      title="删除文件夹（包括所有图标）"
    >
      🗑️ 删除
    </button>
  </div>
));

FolderActions.displayName = 'FolderActions';

interface FolderConfirmDialogProps {
  confirmAction: 'disband' | 'delete' | null;
  iconsCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  onOverlayClick: (e: React.MouseEvent) => void;
}

const FolderConfirmDialog = memo(React.forwardRef<HTMLDivElement, FolderConfirmDialogProps>(({
  confirmAction,
  iconsCount,
  onConfirm,
  onCancel,
  onOverlayClick,
}, ref) => (
  <div
    ref={ref}
    className="confirm-dialog-overlay"
    onClick={onOverlayClick}
  >
    <div className="confirm-dialog">
      <h4>
        {confirmAction === 'disband' ? '确认解散文件夹？' : '确认删除文件夹？'}
      </h4>
      <p>
        {confirmAction === 'disband'
          ? `解散后，文件夹中的 ${iconsCount} 个图标将被释放到主界面。`
          : `删除后，文件夹及其中的 ${iconsCount} 个图标将被永久删除，无法恢复。`}
      </p>
      <div className="confirm-dialog-buttons">
        <button
          className={`confirm-btn ${confirmAction === 'delete' ? 'danger' : ''}`}
          onClick={onConfirm}
        >
          确认
        </button>
        <button
          className="cancel-btn"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </div>
  </div>
)));
FolderConfirmDialog.displayName = 'FolderConfirmDialog';

interface FolderRenameDialogProps {
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
  onOverlayClick: (e: React.MouseEvent) => void;
}

const FolderRenameDialog = memo(React.forwardRef<HTMLDivElement, FolderRenameDialogProps>(({
  editingName,
  onEditingNameChange,
  onKeyDown,
  onSave,
  onCancel,
  onOverlayClick,
}, ref) => (
  <div
    ref={ref}
    className="confirm-dialog-overlay"
    onClick={onOverlayClick}
  >
    <div className="confirm-dialog">
      <h4>重命名文件夹</h4>
      <div className="rename-input-container">
        <input
          type="text"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          maxLength={20}
          className="rename-input"
          placeholder="输入新的文件夹名称"
        />
      </div>
      <div className="confirm-dialog-buttons">
        <button
          className="confirm-btn"
          onClick={onSave}
        >
          保存
        </button>
        <button
          className="cancel-btn"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </div>
  </div>
)));
FolderRenameDialog.displayName = 'FolderRenameDialog';

const FolderWindow: React.FC<FolderWindowProps> = memo(({
  folderName,
  icons,
  isOpen,
  onClose,
  iconColumns,
  onIconDragOut,
  onIconsChange,
  onFolderNameChange,
  onEditIcon,
  onDeleteIcon,
  onDisbandFolder,
  onDeleteFolder,
  disableClickOutside = false,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const renameDialogRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDraggingOut, setIsDraggingOut] = useState(false);
  const [showEditButton, setShowEditButton] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [editingName, setEditingName] = useState(folderName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'disband' | 'delete' | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setEditingName(folderName);
  }, [folderName]);

  const effectiveFolderName = useMemo(() => {
    if (isEditingName) return editingName;
    return folderName;
  }, [folderName, editingName, isEditingName]);

  const {
    draggedIcon,
    dragOverIcon,
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
    icons,
    onIconsChange,
    allowFolderCreation: false,
  });

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setShowRenameDialog(false);
    setIsEditingName(false);
    setShowConfirmDialog(false);
    setConfirmAction(null);
    closeTimerRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 300);
  }, [isClosing, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.confirm-dialog-overlay') || target.closest('.confirm-dialog')) {
      return;
    }
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  useClickOutside(overlayRef, {
    handler: (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.confirm-dialog-overlay') || target.closest('.confirm-dialog')) return;
      handleClose();
    },
    enabled: isOpen && !disableClickOutside,
  });

  useEffect(() => {
    const stopPropagation = (e: MouseEvent) => {
      e.stopPropagation();
    };

    const renameEl = renameDialogRef.current;
    const confirmEl = confirmDialogRef.current;

    if (showRenameDialog && renameEl) {
      renameEl.addEventListener('mousedown', stopPropagation);
    }
    if (showConfirmDialog && confirmEl) {
      confirmEl.addEventListener('mousedown', stopPropagation);
    }

    return () => {
      if (renameEl) renameEl.removeEventListener('mousedown', stopPropagation);
      if (confirmEl) confirmEl.removeEventListener('mousedown', stopPropagation);
    };
  }, [showRenameDialog, showConfirmDialog]);

  const handleDragEndWithOut = useCallback(() => {
    if (draggedIcon && isDraggingOut && onIconDragOut && !dragOverIcon) {
      onIconDragOut(draggedIcon);
    }
    handleDragEnd();
    setIsDraggingOut(false);
  }, [draggedIcon, isDraggingOut, onIconDragOut, dragOverIcon, handleDragEnd]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIcon) {
      const windowRect = windowRef.current?.getBoundingClientRect();
      if (windowRect) {
        const isInside =
          e.clientX >= windowRect.left &&
          e.clientX <= windowRect.right &&
          e.clientY >= windowRect.top &&
          e.clientY <= windowRect.bottom;
        setIsDraggingOut(!isInside);
      }
    }
  }, [draggedIcon]);

  const handleDragLeave = useCallback(() => {
    if (draggedIcon) setIsDraggingOut(true);
  }, [draggedIcon]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIcon) setIsDraggingOut(false);
  }, [draggedIcon]);

  const handleEditFolderName = useCallback(() => {
    setEditingName(folderName);
    setIsEditingName(true);
    setShowRenameDialog(true);
  }, [folderName]);

  const handleSaveFolderName = useCallback(() => {
    if (editingName.trim() && onFolderNameChange) {
      onFolderNameChange(editingName.trim());
    }
    setIsEditingName(false);
    setShowRenameDialog(false);
  }, [editingName, onFolderNameChange]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingName(false);
    setShowRenameDialog(false);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveFolderName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveFolderName, handleCancelEdit]);

  const handleDisbandClick = useCallback(() => {
    setConfirmAction('disband');
    setShowConfirmDialog(true);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setConfirmAction('delete');
    setShowConfirmDialog(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'delete' && onDeleteFolder) {
      onDeleteFolder();
    } else if (confirmAction === 'disband' && onDisbandFolder) {
      onDisbandFolder();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, [confirmAction, onDeleteFolder, onDisbandFolder]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, []);

  const handleConfirmOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  }, []);

  const handleRenameOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setShowRenameDialog(false);
    }
  }, []);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`folder-overlay ${isClosing ? 'closing' : ''}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnter={handleDragEnter}
    >
      <div className="folder-window" ref={windowRef}>
        <FolderHeader
          folderName={effectiveFolderName}
          showEditButton={showEditButton}
          onEditStart={handleEditFolderName}
          onMouseEnter={() => setShowEditButton(true)}
          onMouseLeave={() => setShowEditButton(false)}
          onClose={handleClose}
        />
        <div className="folder-content">
          <div
            className={`folder-icons-grid ${isDraggingOut ? 'dragging-out' : ''}`}
          >
            <IconGrid
              icons={icons}
              iconColumns={iconColumns}
              onEditIcon={onEditIcon}
              onDeleteIcon={onDeleteIcon}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEndWithOut}
              onDragOverIcon={handleDragOverIcon}
              onDragLeaveIcon={handleDragLeaveIcon}
              onDropOnIcon={handleDropOnIcon}
              onDragOverOutside={handleDragOverOutside}
              isDragging={isDragging}
              isDragOverIcon={isDragOverIcon}
              dragOverPosition={dragOverPosition}
              allowFolders={false}
              onBeforeDrop={() => setIsDraggingOut(false)}
            />
          </div>
        </div>
        <FolderActions
          iconsCount={icons.length}
          onDisband={handleDisbandClick}
          onDelete={handleDeleteClick}
        />
      </div>

      {showConfirmDialog && (
        <FolderConfirmDialog
          ref={confirmDialogRef}
          confirmAction={confirmAction}
          iconsCount={icons.length}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
          onOverlayClick={handleConfirmOverlayClick}
        />
      )}

      {showRenameDialog && (
        <FolderRenameDialog
          ref={renameDialogRef}
          editingName={editingName}
          onEditingNameChange={setEditingName}
          onKeyDown={handleKeyPress}
          onSave={handleSaveFolderName}
          onCancel={handleCancelEdit}
          onOverlayClick={handleRenameOverlayClick}
        />
      )}
    </div>
  );
});

FolderWindow.displayName = 'FolderWindow';

export default FolderWindow;
