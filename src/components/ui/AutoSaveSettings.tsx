import React from 'react';

interface AutoSaveSettingsProps {
  /** 当前倒计时（秒） */
  duration: number;
  /** 是否启用自动保存 */
  enabled: boolean;
  /** 修改倒计时 */
  onDurationChange: (seconds: number) => void;
  /** 修改启用状态 */
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * 独立侧栏面板：自动保存设置。
 * 之前嵌在主设置中，现在抽成独立抽屉，减少主设置的视觉噪音。
 */
const AutoSaveSettings: React.FC<AutoSaveSettingsProps> = ({
  duration,
  enabled,
  onDurationChange,
  onEnabledChange,
}) => {
  return (
    <>
      <div className="settings-section">
        <h3>倒计时时长</h3>
        <div className="option-item">
          <label>
            自动保存倒计时: {duration} 秒
            <input
              type="range"
              min="10"
              max="99"
              value={duration}
              onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
            />
          </label>
          <p style={{
            marginTop: 8,
            margin: '8px 0 0',
            fontSize: 'var(--font-sm)',
            color: 'var(--text-tertiary)',
            lineHeight: 1.55,
          }}>
            离开编辑区后开始倒计时，到期自动将当前更改同步到本地。
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>功能开关</h3>
        <div className="option-item">
          <label>
            <span style={{
              fontSize: 'var(--font-md)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              marginBottom: 6,
              display: 'inline-block',
            }}>
              启用自动保存
            </span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onEnabledChange(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </label>
        </div>
      </div>
    </>
  );
};

export default AutoSaveSettings;
