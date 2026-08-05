import React, { useEffect } from 'react';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  container?: 'parent' | 'window';
  isLoading?: boolean;
  loadingText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  container = 'window',
  isLoading = false,
  loadingText = '处理中...'
}) => {
  // 监听ESC键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isParentContainer = container === 'parent';

  return (
    <div 
      className={`global-confirm-dialog ${isParentContainer ? 'parent-container' : ''}`}
      onClick={(e) => e.stopPropagation()} 
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="confirm-dialog-content">
        <div className="confirm-dialog-body">
          <div>
            <h3 className="confirm-dialog-title">{title}</h3>
            <p className="confirm-dialog-message">{message}</p>
          </div>
          {isLoading ? (
            <div className="confirm-dialog-loading">
              <div className="confirm-dialog-loading-spinner">
                <div className="confirm-dialog-spinner-icon" />
                <span className="confirm-dialog-loading-text">{loadingText}</span>
              </div>
              <div className="confirm-dialog-progress-bar">
                <div className="confirm-dialog-progress-fill" />
              </div>
            </div>
          ) : (
            <div className="confirm-dialog-buttons">
              <button
                onClick={onConfirm}
                className="confirm-dialog-btn confirm-dialog-btn-primary"
              >
                确认
              </button>
              <button
                onClick={onCancel}
                className="confirm-dialog-btn confirm-dialog-btn-secondary"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
