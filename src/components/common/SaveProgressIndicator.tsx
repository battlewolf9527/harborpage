import React from 'react';

interface SaveProgressIndicatorProps {
  saveProgress: { current: number; total: number };
}

const SaveProgressIndicator: React.FC<SaveProgressIndicatorProps> = React.memo(({
  saveProgress,
}) => {
  return (
    <div className="save-progress-indicator">
      <span className="progress-text">正在清理图标缓存...</span>
      <div className="progress-bar-container">
        <div
          className="progress-bar"
          style={{
            width: `${saveProgress.total > 0 ? (saveProgress.current / saveProgress.total) * 100 : 0}%`,
          }}
        ></div>
      </div>
    </div>
  );
});

export default SaveProgressIndicator;