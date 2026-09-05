import React, { useState } from 'react';
import './PalettePicker.css';
import ColorPickerWindow from './ColorPickerWindow';
import { usePaletteStore } from '../../store/usePaletteStore';
import { isHexColor } from '../../utils/noteColors';
import {
  DEFAULT_PALETTE_HEXES,
  PALETTE_SLOT_IDS,
  canonicalSlotId,
  customSelection,
  describeSlotLabel,
  normalizeHex,
  resolveColorHex,
  slotNumber,
  slotSelection,
  type ColorSelection,
} from '../../utils/paletteColors';

/* ════════════════════════════════════════════════════════════════
   调色板组件（Palette）— 全局 16 槽通用取色/管理
   16 槽 + 自定义按钮同处一个 flex-wrap 流，不刻意换行：
   按所在容器宽度自然排列（宽处同行，如笔记 1×16+自定义；窄处自动折行）。
   两种模式：
   - select（选择模式，元素设色默认）：点槽 = 选中该槽颜色；
     再点已选中槽 = 弹取色器重设该槽颜色；「自定义」按钮同样弹取色器。
   - settings（设置模式，设置侧栏用）：点任意槽 = 弹取色器重设该槽颜色。
   槽位 tooltip/aria = describeSlotLabel：有别名 → 「别名（调色板 N）：颜色」；
   无别名 → 「调色板 N：颜色」（颜色为中文色名/hex）。
   ════════════════════════════════════════════════════════════════ */

interface PaletteProps {
  /** 选择模式（元素取色） / 设置模式（管理全局槽） */
  mode?: 'select' | 'settings';
  /** 选择模式当前值（color=静态 hex/旧名快照，colorSlot=绑定槽 id） */
  value?: ColorSelection | null;
  /** 选择模式选中回调 */
  onChange?: (sel: ColorSelection) => void;
  className?: string;
}

type PickerTarget = { kind: 'slot'; slotId: string } | { kind: 'custom' };

export const Palette: React.FC<PaletteProps> = ({
  mode = 'select',
  value,
  onChange,
  className,
}) => {
  const slots = usePaletteStore((s) => s.slots);
  const aliases = usePaletteStore((s) => s.aliases);
  const setSlotColor = usePaletteStore((s) => s.setSlotColor);
  const setSlotAlias = usePaletteStore((s) => s.setSlotAlias);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const boundSlot = value?.colorSlot ? canonicalSlotId(value.colorSlot) || null : null;
  const colorHex = (value?.color ?? '').toLowerCase();
  const customActive = mode === 'select' && !boundSlot && isHexColor(colorHex);
  // 当前元素最终显示色（选择模式弹窗的初始值基准）
  const elementHex = mode === 'select' ? normalizeHex(resolveColorHex(value ?? {}, slots)) : '';

  const handleCellClick = (slotId: string) => {
    if (mode === 'settings') {
      // 设置模式：点槽 = 重设该槽
      setPickerTarget({ kind: 'slot', slotId });
      return;
    }
    if (boundSlot === slotId) {
      // 重复点击已选中的槽 = 打开取色器重设该槽
      setPickerTarget({ kind: 'slot', slotId });
      return;
    }
    onChange?.(slotSelection(slotId, slots));
  };

  const handlePickerConfirm = (hex: string) => {
    if (pickerTarget?.kind === 'slot') {
      setSlotColor(pickerTarget.slotId, hex);
    } else if (pickerTarget?.kind === 'custom') {
      onChange?.(customSelection(hex));
    }
    setPickerTarget(null);
  };

  /** 取色弹窗标题：有别名 → 「修改「别名（调色板 N）」」；无别名 → 「修改调色板 N 号」 */
  const slotEditTitle = (slotId: string): string => {
    const alias = (aliases[slotId] ?? '').trim();
    return alias
      ? `修改「${alias}（调色板 ${slotNumber(slotId)}）」`
      : `修改调色板 ${slotNumber(slotId)} 号`;
  };

  const pickerTitle =
    pickerTarget?.kind === 'slot' ? slotEditTitle(pickerTarget.slotId) : '自定义';
  const pickerInitialHex =
    pickerTarget?.kind === 'slot'
      ? slots[pickerTarget.slotId] || ''
      : pickerTarget?.kind === 'custom'
        ? customActive
          ? colorHex
          : elementHex
        : '';
  const pickerDefaultHex =
    pickerTarget?.kind === 'slot' ? DEFAULT_PALETTE_HEXES[pickerTarget.slotId] : undefined;

  return (
    <div className={`palette palette-${mode} ${className ?? ''}`}>
      <div className="palette-grid" role="group" aria-label="颜色调色板">
        {PALETTE_SLOT_IDS.map((id) => {
          const hex = normalizeHex(slots[id]) || DEFAULT_PALETTE_HEXES[id];
          const active = mode === 'select' && boundSlot === id;
          const modified = mode === 'settings' && hex !== DEFAULT_PALETTE_HEXES[id];
          // 展示文案（tooltip/aria）：有别名 → 「别名（调色板 N）：颜色」；无别名 → 「调色板 N：颜色」
          const hint = describeSlotLabel(id, slots, aliases);
          return (
            <button
              key={id}
              type="button"
              className={`palette-cell ${active ? 'active' : ''} ${modified ? 'modified' : ''}`}
              style={{ background: hex }}
              title={hint}
              aria-label={modified ? `${hint}（非默认色）` : hint}
              aria-pressed={active}
              onClick={() => handleCellClick(id)}
            >
              {active && <span className="palette-cell-check" aria-hidden="true" />}
            </button>
          );
        })}
        {/* 自定义颜色：与 16 槽同一 flex 流，宽度足够就同排，否则自然换行 */}
        {mode === 'select' && (
          <button
            type="button"
            className={`palette-custom-btn ${customActive ? 'active' : ''}`}
            aria-pressed={customActive}
            onClick={() => setPickerTarget({ kind: 'custom' })}
          >
            <span
              className="palette-custom-swatch"
              style={customActive && isHexColor(colorHex) ? { background: colorHex } : undefined}
              aria-hidden="true"
            />
            自定义
          </button>
        )}
      </div>

      <ColorPickerWindow
        open={!!pickerTarget}
        title={pickerTitle}
        {...(pickerInitialHex ? { initialHex: pickerInitialHex } : {})}
        {...(pickerDefaultHex ? { defaultHex: pickerDefaultHex } : {})}
        {...(pickerTarget?.kind === 'slot'
          ? {
              alias: aliases[pickerTarget.slotId] ?? '',
              onAliasCommit: (alias) => setSlotAlias(pickerTarget.slotId, alias),
            }
          : {})}
        onConfirm={handlePickerConfirm}
        onClose={() => setPickerTarget(null)}
      />
    </div>
  );
};
