import React, { useState, forwardRef, useImperativeHandle, useEffect, useCallback, useRef } from 'react';
import './SettingsWindow.css';

interface SettingsWindowProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isClosing?: boolean;
  onClosingComplete?: () => void;
}

interface SettingsWindowRef {
  handleClose: () => void;
}

const SettingsWindow = forwardRef<SettingsWindowRef, SettingsWindowProps>(({ 
  title, 
  onClose, 
  children, 
  isClosing = false,
  onClosingComplete 
}, ref) => {
  const [localIsClosing, setLocalIsClosing] = useState(isClosing);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (closeTimerRef.current) return;
    setLocalIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
      if (onClosingComplete) {
        onClosingComplete();
      }
    }, 400);
  }, [onClose, onClosingComplete]);

  // 监听ESC键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  useImperativeHandle(ref, () => ({
    handleClose
  }));

  return (
    <>
      <div className="settings-overlay" onClick={handleClose} />
      <div className={`settings-panel ${localIsClosing ? 'closing' : ''}`}>
        <div className="panel-header">
          <h2>{title}</h2>
          <button 
            className="back-button"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </>
  );
});

SettingsWindow.displayName = 'SettingsWindow';

export default SettingsWindow;