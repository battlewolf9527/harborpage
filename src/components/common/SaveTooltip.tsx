import React from 'react';
import { useTranslation } from 'react-i18next';

interface SaveTooltipProps {
  saveError: string | null;
  isSaving: boolean;
  saveProgress: { current: number; total: number };
  autoSaveEnabled: boolean;
  countdown: number;
  onManualSave: () => void;
  onToggleAutoSave: (enabled: boolean) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const SaveTooltip: React.FC<SaveTooltipProps> = React.memo(({
  saveError,
  isSaving,
  saveProgress,
  autoSaveEnabled,
  countdown,
  onManualSave,
  onToggleAutoSave,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { t } = useTranslation('dock');
  return (
    <div
      className="save-tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`tooltip-content ${saveError ? 'error' : ''}`}>
        {saveError ? (
          <>
            <h3>{t('saveTooltip.saveFailed')}</h3>
            <p>{saveError}</p>
            <button className="save-button" onClick={onManualSave} disabled={isSaving}>
              {isSaving ? t('saveTooltip.saving') : t('saveTooltip.retrySave')}
            </button>
          </>
        ) : (
          <>
            <h3>{t('saveTooltip.unsavedChanges')}</h3>
            <p>{t('saveTooltip.unsavedChangesHint')}</p>
            <button className="save-button" onClick={onManualSave} disabled={isSaving}>
              {isSaving
                ? saveProgress.total > 0
                  ? t('saveTooltip.savingWithProgress', {
                      current: saveProgress.current,
                      total: saveProgress.total,
                    })
                  : t('saveTooltip.saving')
                : autoSaveEnabled
                ? t('saveTooltip.saveNowWithCountdown', { seconds: countdown })
                : t('saveTooltip.saveNow')}
            </button>
            {isSaving && saveProgress.total > 0 && (
              <div className="save-progress">
                <div
                  className="save-progress-bar"
                  style={{
                    width: `${(saveProgress.current / saveProgress.total) * 100}%`,
                  }}
                ></div>
              </div>
            )}
            <div className="auto-save-control">
              <span>{t('saveTooltip.autoSave')}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => {
                    onToggleAutoSave(e.target.checked);
                  }}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default SaveTooltip;