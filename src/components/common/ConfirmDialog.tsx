import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  /** 确认按钮类型：default=极光渐变 / danger=语义红渐变 */
  confirmType?: 'default' | 'danger';
  /** 确认按钮文字（默认"确认"） */
  confirmText?: string;
  /** 取消按钮文字（默认"取消"） */
  cancelText?: string;
  /** 点击确认/取消按钮的额外 className（通常不用传） */
  confirmClassName?: string;
  cancelClassName?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  container = 'window',
  isLoading = false,
  loadingText = '处理中...',
  confirmType = 'default',
  confirmText = '确认',
  cancelText = '取消',
  confirmClassName = '',
  cancelClassName = '',
}) => {
  // 监听 ESC 键：阻断冒泡到父 Dialog 的 ESC 关闭逻辑
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    // useCapture 确保比 Dialog 基类监听器先拿到事件
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isParentContainer = container === 'parent';

  const dialogNode = (
    <div
      className={`global-confirm-dialog ${isParentContainer ? 'parent-container' : ''}`}
      onClick={(e) => {
        // 遮罩层点击 = 取消；阻止冒泡到上层 Dialog 的 overlay.onClick
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="confirm-dialog-content"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
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
              {/* 按用户习惯：
                    · 会关闭窗口的按钮统一放在右区域；取消按钮是「关闭/撤销语义」= 最右侧；
                    · 确认按钮虽然也会关窗，但属于「功能性确认（提交）」，放在取消按钮的左侧。
                  外层 flex justify:flex-end，所以 DOM 顺序 [确认] → [取消] 对应视觉：
                    左（确认，功能）  右（取消，最右 = 关窗位置）。符合约定。 */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onConfirm();
                }}
                className={`confirm-dialog-btn confirm-dialog-btn-primary confirm-type-${confirmType} ${confirmClassName}`.trim()}
              >
                {confirmText}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel();
                }}
                className={`confirm-dialog-btn confirm-dialog-btn-secondary ${cancelClassName}`.trim()}
              >
                {cancelText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // parent-container 时直接内联渲染（通常是某个绝对定位容器内确认）
  // window 模式统一 Portal 到 body，保证叠在任何 Dialog 之上
  if (isParentContainer) return dialogNode;
  if (typeof document === 'undefined') return dialogNode;
  return createPortal(dialogNode, document.body);
};

export default ConfirmDialog;
