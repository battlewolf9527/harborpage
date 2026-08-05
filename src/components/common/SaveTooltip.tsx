import React from 'react';

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
  return (
    <div
      className="save-tooltip"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={`tooltip-content ${saveError ? 'error' : ''}`}>
        {saveError ? (
          <>
            <h3>保存失败</h3>
            <p>{saveError}</p>
            <button className="save-button" onClick={onManualSave} disabled={isSaving}>
              {isSaving ? '保存中...' : '重试保存'}
            </button>
          </>
        ) : (
          <>
            <h3>有未保存的更改</h3>
            <p>您的更改尚未保存到云端，请及时保存避免数据丢失。</p>
            <button className="save-button" onClick={onManualSave} disabled={isSaving}>
              {isSaving
                ? saveProgress.total > 0
                  ? `保存中... ${saveProgress.current}/${saveProgress.total}`
                  : '保存中...'
                : autoSaveEnabled
                ? `立即保存 (${countdown}s)`
                : '立即保存'}
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
              <span>自动保存</span>
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