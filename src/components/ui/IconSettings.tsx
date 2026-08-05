import React from 'react';

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
  return (
    <div className="settings-section">
      <h3>图标设置</h3>
      <div className="option-item">
        <label>
          列数: {iconColumns}
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
          {isCleaningUp ? '清理中...' : '清理未使用的图标'}
        </button>
      </div>
    </div>
  );
};

export default IconSettings;
