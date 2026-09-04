import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ColorPickerWindow.css';
import {
  DEFAULT_PALETTE_HEXES,
  PALETTE_SLOT_IDS,
  describeColor,
  normalizeHex,
} from '../../utils/paletteColors';

/* ════════════════════════════════════════════════════════════════
   取色器窗口（模态居中弹窗）
   输出单一颜色数据：用户可在「系统预设 16 色」中直接选择，
   也可点「自定义颜色」打开原生取色器自由调色；确定后输出所选 hex。
   - 默认展示 16 个预设候选（中文色名提示，不暴露 RGB）
   - 传入 defaultHex 时显示「恢复默认」快捷按钮（用于重设全局调色板槽）
   ════════════════════════════════════════════════════════════════ */

interface ColorPickerWindowProps {
  open: boolean;
  /** 窗口标题：如「自定义颜色」「修改调色板 · 蓝色」 */
  title: string;
  /** 初始/当前颜色（决定哪个候选高亮与自定义预览色） */
  initialHex?: string;
  /** 槽位出厂默认色：提供时显示「恢复默认」 */
  defaultHex?: string;
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
  onConfirm,
  onClose,
}) => {
  const [draft, setDraft] = useState(() => (open ? normalizeHex(initialHex) || '' : ''));
  const [prevOpen, setPrevOpen] = useState(open);
  const customInputRef = useRef<HTMLInputElement>(null);

  // 每次打开时以当前值重置草稿：prop 变化时调整 state 的渲染期模式（避免在 effect 中 setState 引发级联渲染）
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(normalizeHex(initialHex) || '');
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

  const handleConfirm = () => {
    if (customHex) onConfirm(customHex);
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
            aria-label="关闭"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="color-picker-body">
          <p className="color-picker-caption">预设颜色</p>
          <div className="color-picker-presets" role="radiogroup" aria-label="预设颜色">
            {PALETTE_SLOT_IDS.map((id) => {
              const hex = DEFAULT_PALETTE_HEXES[id];
              const name = describeColor(hex);
              const active = customHex === hex;
              return (
                <button
                  key={id}
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
                className={`color-picker-custom-swatch ${customHex && !PALETTE_SLOT_IDS.some((id) => DEFAULT_PALETTE_HEXES[id] === customHex) ? 'active' : ''}`}
                style={customHex ? { background: customHex } : undefined}
                aria-hidden="true"
              />
              <span className="color-picker-custom-label">自定义颜色</span>
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
                当前颜色：
                <b className="color-picker-current-name" style={{ color: customHex }}>
                  {describeColor(customHex)}
                </b>
              </>
            ) : (
              '请选择颜色'
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
              恢复默认
            </button>
          )}
          <button
            type="button"
            className="color-picker-btn primary"
            disabled={!customHex}
            onClick={handleConfirm}
          >
            确定
          </button>
          <button
            type="button"
            className="color-picker-btn secondary"
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ColorPickerWindow;
