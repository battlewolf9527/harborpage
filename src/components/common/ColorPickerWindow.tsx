import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './ColorPickerWindow.css';
import {
  QUICK_PRESET_COLORS,
  describeQuickColor,
  normalizeHex,
} from '../../utils/paletteColors';

/* ════════════════════════════════════════════════════════════════
   取色器窗口（模态居中弹窗）
   输出单一颜色数据：用户可在「预设颜色 8 列 × 4 行色阶矩阵」中直接选择
   （2~8 列按行 淡彩→高饱和亮→宝石深→极深通透 逐档加深，第 1 列为白灰黑中性灰阶；
   出厂 16 槽默认色均为矩阵成员，可精确命中），
   也可点「自定义颜色」打开原生取色器自由调色；确定后输出所选 hex。
   - 默认展示 32 个预设候选（中文色名提示，不暴露 RGB）
   - 传入 defaultHex 时显示「恢复默认」快捷按钮（用于重设全局调色板槽）
   - 传入 alias + onAliasCommit 时（修改调色板槽场景）在顶部提供别名输入框：
     用户可在改色的同时为该调色板命名/清除别名，随「确定」一并提交
   ════════════════════════════════════════════════════════════════ */

interface ColorPickerWindowProps {
  open: boolean;
  /** 窗口标题：如「自定义颜色」「修改调色板 · 蓝色」 */
  title: string;
  /** 初始/当前颜色（决定哪个候选高亮与自定义预览色） */
  initialHex?: string;
  /** 槽位出厂默认色：提供时显示「恢复默认」 */
  defaultHex?: string;
  /** 槽位当前别名（仅修改调色板槽场景传入；决定是否显示别名输入框） */
  alias?: string;
  /** 确定时提交别名（已去首尾空白；空串 = 清除别名） */
  onAliasCommit?: (alias: string) => void;
  /** 确定：输出用户最终选择的颜色 hex（#rrggbb） */
  onConfirm: (hex: string) => void;
  /** 取消/关闭（不输出数据） */
  onClose: () => void;
}

const ColorPickerWindow: React.FC<ColorPickerWindowProps> = ({
  open,
  title,
  initialHex,
  defaultHex,
  alias,
  onAliasCommit,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation('sites');
  const [draft, setDraft] = useState(() => (open ? normalizeHex(initialHex) || '' : ''));
  const [aliasDraft, setAliasDraft] = useState(() => (open ? (alias ?? '').trim() : ''));
  const [prevOpen, setPrevOpen] = useState(open);
  const customInputRef = useRef<HTMLInputElement>(null);

  // 每次打开时以当前值重置草稿：prop 变化时调整 state 的渲染期模式（避免在 effect 中 setState 引发级联渲染）
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(normalizeHex(initialHex) || '');
      setAliasDraft((alias ?? '').trim());
    }
  }

  // ESC 关闭（capture 阶段拦截：弹窗内按键不再冒泡给其下业务层级的 ESC 逻辑）
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  if (!open) return null;

  const customHex = normalizeHex(draft);
  // 修改调色板槽场景才显示别名输入框
  const showAlias = typeof onAliasCommit === 'function';

  const handleConfirm = () => {
    if (!customHex) return;
    onConfirm(customHex);
    if (onAliasCommit) {
      onAliasCommit(aliasDraft.trim());
    }
  };

  return createPortal(
    <div
      className="color-picker-overlay"
      onMouseDown={(e) => {
        // 隔离事件：不冒泡到父级弹层的"点击外部"逻辑；
        // 点遮罩 = 取消（草稿未提交，无数据丢失）
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="color-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="color-picker-head">
          <span className="color-picker-title">{title}</span>
          <button
            type="button"
            className="color-picker-close"
            aria-label={t('picker.close')}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="color-picker-body">
          {showAlias && (
            <div className="color-picker-alias">
              <label className="color-picker-alias-label" htmlFor="color-picker-alias-input">
                {t('picker.aliasLabel')}
              </label>
              <input
                id="color-picker-alias-input"
                type="text"
                className="color-picker-alias-input"
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                placeholder={t('picker.aliasPlaceholder')}
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}

          <p className="color-picker-caption">{t('picker.presetColors')}</p>
          <div className="color-picker-presets" role="radiogroup" aria-label={t('picker.presetColors')}>
            {QUICK_PRESET_COLORS.map((preset) => {
              const hex = preset.hex;
              const name = describeQuickColor(hex);
              const active = customHex === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={name}
                  title={name}
                  className={`color-picker-preset ${active ? 'active' : ''}`}
                  style={{ background: hex }}
                  onClick={() => setDraft(hex)}
                >
                  {active && <span className="color-picker-preset-check" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="color-picker-custom">
            <button
              type="button"
              className="color-picker-custom-btn"
              onClick={() => customInputRef.current?.click()}
            >
              <span
                className={`color-picker-custom-swatch ${customHex && !QUICK_PRESET_COLORS.some((p) => p.hex === customHex) ? 'active' : ''}`}
                style={customHex ? { background: customHex } : undefined}
                aria-hidden="true"
              />
              <span className="color-picker-custom-label">{t('picker.customColor')}</span>
            </button>
            <input
              ref={customInputRef}
              type="color"
              tabIndex={-1}
              aria-hidden="true"
              className="color-picker-hidden-input"
              value={customHex || '#facc15'}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>

          <p className="color-picker-current">
            {customHex ? (
              <>
                {t('picker.currentColor')}
                <b className="color-picker-current-name" style={{ color: customHex }}>
                  {describeQuickColor(customHex)}
                </b>
              </>
            ) : (
              t('picker.selectColorPrompt')
            )}
          </p>
        </div>

        <div className="color-picker-foot">
          {defaultHex && (
            <button
              type="button"
              className="color-picker-btn ghost"
              onClick={() => setDraft(defaultHex)}
            >
              {t('picker.restoreDefault')}
            </button>
          )}
          <button
            type="button"
            className="color-picker-btn primary"
            disabled={!customHex}
            onClick={handleConfirm}
          >
            {t('actions.confirm')}
          </button>
          <button
            type="button"
            className="color-picker-btn secondary"
            onClick={onClose}
          >
            {t('actions.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ColorPickerWindow;
