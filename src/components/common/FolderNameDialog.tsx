import React, { useState, useEffect, useRef } from 'react';
import './FolderNameDialog.css';

interface FolderNameDialogProps {
  isOpen: boolean;
  onClose: (name?: string) => void;
}

const FolderNameDialog: React.FC<FolderNameDialogProps> = ({ isOpen, onClose }) => {
  const [folderName, setFolderName] = useState('新文件夹');
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      focusTimerRef.current = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [isOpen]);

  // 监听ESC键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onClose(folderName.trim());
    }
  };

  const handleCancel = () => {
    onClose();
  };

  // 点击遮罩层关闭对话框
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="folder-name-dialog-overlay" onClick={handleOverlayClick}>
      <div className="folder-name-dialog">
        <h3>创建新文件夹</h3>
        <input
          ref={inputRef}
          type="text"
          id="folder-name"
          className="folder-name-input"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="请输入文件夹名称"
          maxLength={20}
        />
        <div className="folder-name-buttons">
          <button type="button" className="folder-name-button folder-name-button-primary" onClick={handleSubmit}>
            确定
          </button>
          <button type="button" className="folder-name-button folder-name-button-secondary" onClick={handleCancel}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderNameDialog;
