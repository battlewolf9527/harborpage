import React from 'react';
import { useTranslation } from 'react-i18next';

interface SaveTooltipProps {
  saveError: string | null;
  /** 断网导致保存未能提交：改动仍在待保存队列，联网后自动补交 */
  isOfflinePending: boolean;
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
  isOfflinePending,
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

  const autoSaveControl = (
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
  );

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
        ) : isOfflinePending ? (
          /* 离线：改动仍在待保存队列，联网后自动补交，因此不给无效的「立即保存」按钮 */
          <>
            <h3>{t('saveTooltip.pendingOffline')}</h3>
            <p>{t('saveTooltip.pendingOfflineHint')}</p>
            {autoSaveControl}
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
            {autoSaveControl}
          </>
        )}
      </div>
    </div>
  );
});

export default SaveTooltip;