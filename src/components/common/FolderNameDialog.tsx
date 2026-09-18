import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './FolderNameDialog.css';

/**
 * 通用命名弹窗（全站统一 Aurora Dark Glass 风格）
 * 缺省文案为「创建新文件夹」；传入 title / defaultValue / placeholder 等即可复用于其它命名场景
 * （如保存／重命名配色方案）。需要每次打开都重读 defaultValue 时，由调用方用 key 触发重挂载。
 */
interface FolderNameDialogProps {
  isOpen: boolean;
  onClose: (name?: string) => void;
  /** 弹窗标题（缺省：创建新文件夹） */
  title?: string;
  /** 输入框初值（缺省：文件夹默认名），仅挂载时读取一次 */
  defaultValue?: string;
  /** 输入框占位文案（缺省：请输入文件夹名称） */
  placeholder?: string;
  /** 输入长度上限（缺省 20） */
  maxLength?: number;
  /** 确认按钮文字（缺省：确定） */
  confirmText?: string;
  /** 取消按钮文字（缺省：取消） */
  cancelText?: string;
}

const FolderNameDialog: React.FC<FolderNameDialogProps> = ({
  isOpen,
  onClose,
  title,
  defaultValue,
  placeholder,
  maxLength = 20,
  confirmText,
  cancelText,
}) => {
  const { t } = useTranslation('folder');
  const [name, setName] = useState(() => defaultValue ?? t('defaultName'));
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
    if (name.trim()) {
      onClose(name.trim());
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
        <h3>{title ?? t('dialogs.create.title')}</h3>
        <input
          ref={inputRef}
          type="text"
          id="folder-name"
          className="folder-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder ?? t('dialogs.create.placeholder')}
          maxLength={maxLength}
        />
        <div className="folder-name-buttons">
          <button type="button" className="folder-name-button folder-name-button-primary" onClick={handleSubmit}>
            {confirmText ?? t('dialogs.create.confirm')}
          </button>
          <button type="button" className="folder-name-button folder-name-button-secondary" onClick={handleCancel}>
            {cancelText ?? t('dialogs.create.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderNameDialog;