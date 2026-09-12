import React from 'react';
import { useTranslation } from 'react-i18next';

interface IconSettingsProps {
  iconColumns: number;
  onIconColumnsChange: (columns: number) => void;
  onCleanupIcons: () => void;
  isCleaningUp: boolean;
}

const IconSettings: React.FC<IconSettingsProps> = ({ 
  iconColumns, 
  onIconColumnsChange,
  onCleanupIcons,
  isCleaningUp,
}) => {
  const { t } = useTranslation('icons');

  return (
    <div className="settings-section">
      <h3>{t('iconSettings.title')}</h3>
      <div className="option-item">
        <label>
          {t('iconSettings.maxColumns', { count: iconColumns })}
          <input 
            type="range" 
            min="3" 
            max="8" 
            value={iconColumns} 
            onChange={(e) => onIconColumnsChange(Number(e.target.value))} 
          />
        </label>
      </div>
      <div className="option-item">
        <button 
          className="cleanup-button"
          onClick={onCleanupIcons}
          disabled={isCleaningUp}
        >
          {isCleaningUp ? t('iconSettings.cleaning') : t('iconSettings.cleanup')}
        </button>
      </div>
    </div>
  );
};

export default IconSettings;
