import React from 'react';
import { useTranslation } from 'react-i18next';

interface SaveProgressIndicatorProps {
  saveProgress: { current: number; total: number };
}

const SaveProgressIndicator: React.FC<SaveProgressIndicatorProps> = React.memo(({
  saveProgress,
}) => {
  const { t } = useTranslation('dock');
  return (
    <div className="save-progress-indicator">
      <span className="progress-text">{t('saveProgress.cleaningIconCache')}</span>
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