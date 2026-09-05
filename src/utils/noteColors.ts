import type { CSSProperties } from 'react';
import { hexToRgba } from './colorUtils';

/**
 * 16 色预设 —— 英文名仅作为「历史存储标识」与旧数据兼容基准（老数据可能按名存色）。
 * 注意：调色板 16 槽的出厂默认色已改由 paletteColors.FACTORY_PALETTE_HEXES 提供
 * （取值来自新 4×8 取色矩阵）；本文件的 hex 保持旧出厂色不变，使「旧预设名 → 旧颜色」
 * 的历史数据不因换色而跳色。新建/改色一律以 hex 快照流转，不再写入预设名。
 */
export interface NoteColorPreset {
  name: string;
  hex: string;
}

export const NOTE_COLOR_PRESETS: readonly NoteColorPreset[] = [
  { name: 'white', hex: '#ffffff' },
  { name: 'yellow', hex: '#facc15' },
  { name: 'amber', hex: '#f59e0b' },
  { name: 'orange', hex: '#fb923c' },
  { name: 'pink', hex: '#f472b6' },
  { name: 'rose', hex: '#e879f9' },
  { name: 'red', hex: '#f87171' },
  { name: 'green', hex: '#4ade80' },
  { name: 'lime', hex: '#a3e635' },
  { name: 'emerald', hex: '#34d399' },
  { name: 'teal', hex: '#2dd4bf' },
  { name: 'cyan', hex: '#22d3ee' },
  { name: 'blue', hex: '#60a5fa' },
  { name: 'sky', hex: '#38bdf8' },
  { name: 'purple', hex: '#c084fc' },
  { name: 'indigo', hex: '#818cf8' },
];

/** 退役预设：与现役颜色过于接近而从色盘移除；仍保留识别与渲染兼容（老数据不跳色） */
const RETIRED_PRESET_HEX: Record<string, string> = {
  coral: '#f97316', // 与 orange #fb923c 同族过近，移除换为白色
};

/** 预设 hex 列表（站点/文件夹颜色盘直接复用） */
export const NOTE_PRESET_HEXES: readonly string[] = NOTE_COLOR_PRESETS.map((p) => p.hex);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/** 是否为 6 位十六进制颜色 */
export const isHexColor = (value: string): boolean => HEX_RE.test(value);

/** 是否为预设名（现役 16 色 + 已退役但保留兼容的旧名，如 'coral'） */
export function isNoteColorPresetName(color?: string): boolean {
  if (!color) return false;
  return NOTE_COLOR_PRESETS.some((p) => p.name === color) || color in RETIRED_PRESET_HEX;
}

/** 统一解析为 #rrggbb：预设名/退役名→hex；自定义 hex 原样小写化；无效返回空串 */
export function resolveNoteColor(color?: string): string {
  if (!color) return '';
  const preset = NOTE_COLOR_PRESETS.find((p) => p.name === color);
  if (preset) return preset.hex;
  const retired = RETIRED_PRESET_HEX[color];
  if (retired) return retired;
  return isHexColor(color) ? color.toLowerCase() : '';
}

/**
 * 为自定义 #hex 色生成笔记 CSS 变量（--note-accent/--note-soft/--tint）。
 * 预设名已由既有 .color-* 类提供变量，返回 undefined；非 hex 无效值同样返回 undefined。
 * @param softAlpha --note-soft 透明度，不同表面 (.10/.14) 由调用方按需传入
 */
export function noteColorStyleVars(color?: string, softAlpha = 0.14): CSSProperties | undefined {
  if (!color || isNoteColorPresetName(color)) return undefined;
  const hex = resolveNoteColor(color);
  if (!hex) return undefined;
  return noteHexStyleVars(hex, softAlpha);
}

/**
 * 直接由最终 hex 生成便签 CSS 变量（绑定调色板槽/旧预设名/自定义色在解析成 hex 后统一走这里，
 * 不再依赖静态 .color-* 类，使槽位改色能即时生效）。
 */
export function noteHexStyleVars(hex: string, softAlpha = 0.14): CSSProperties {
  const normalized = isHexColor(hex) ? hex.toLowerCase() : '#facc15';
  return {
    '--note-accent': normalized,
    '--note-soft': hexToRgba(normalized, softAlpha),
    '--tint': normalized,
  } as CSSProperties;
}
