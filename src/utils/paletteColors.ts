/**
 * 全局调色板（16 槽）核心定义与解析
 * ---------------------------------------------------------------
 * 语义：
 * - 系统固定 16 个调色板槽，槽 id 为位置标识（palette-1 … palette-16，顺序沿用出厂
 *   16 色排列），**不含颜色语义**：颜色始终由「槽当前色」决定，用户可任意修改某槽颜色，
 *   id 不会随之失真（旧版曾以预设色名做 id，改色后语义错位，现已改为位置 id，
 *   并保留旧预设名的兼容读取）。
 * - 出厂默认 16 色 = DEFAULT_PALETTE_HEXES（palette-N → hex），是「恢复默认」的基准，
 *   也是旧数据的静态解析基准。
 * - 元素（文件夹/站点图标/便签）取色时：选某个槽 → 写入 colorSlot=槽id + color=当前色快照；
 *   该元素实时跟随槽位当前色。选自定义 → 仅写 color=#rrggbb（无 colorSlot，静态）。
 * - 旧数据（无 colorSlot）一律视为静态自定义色：预设名按出厂默认色解析、hex 原样，
 *   不参与槽位联动。
 * ---------------------------------------------------------------
 */
import type { PaletteHexMap, PaletteAliasMap } from '../types';
import { hexToHslCssVars } from './colorUtils';
import { isHexColor, NOTE_COLOR_PRESETS, resolveNoteColor } from './noteColors';

/** 出厂 16 色 hex（按 NOTE_COLOR_PRESETS 顺序：white…indigo） */
const PRESET_PALETTE_HEXES: readonly string[] = NOTE_COLOR_PRESETS.map((p) => p.hex);

/** 出厂 16 色的可描述中文名（与 PRESET_PALETTE_HEXES 顺序一一对应） */
const PRESET_PALETTE_NAMES: readonly string[] = [
  '白色', '黄色', '琥珀色', '橙色',
  '粉色', '玫红色', '红色',
  '绿色', '黄绿色', '翠绿色', '青色', '青蓝色',
  '蓝色', '天蓝色', '紫色', '靛蓝色',
];

/** 16 槽稳定 id：palette-1 … palette-16（位置标识，不含颜色语义） */
export const PALETTE_SLOT_IDS: readonly string[] = Array.from(
  { length: NOTE_COLOR_PRESETS.length },
  (_, i) => `palette-${i + 1}`,
);

/** 出厂默认 16 色：槽 id（palette-N）→ 出厂 hex（不可变基准） */
export const DEFAULT_PALETTE_HEXES: Readonly<Record<string, string>> = Object.fromEntries(
  PALETTE_SLOT_IDS.map((id, i) => [id, PRESET_PALETTE_HEXES[i]]),
) as Readonly<Record<string, string>>;

/** 旧版槽 id（出厂预设名：white…indigo）→ 位置序号；仅供历史数据兼容读取 */
const LEGACY_SLOT_ID_TO_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  NOTE_COLOR_PRESETS.map((p, i) => [p.name, i]),
) as Readonly<Record<string, number>>;

/**
 * 槽位规范 id：新 id（palette-N）原样返回；旧预设名映射到对应位置；
 * 非法值返回空串。所有读取槽色/校验槽位处都应先经此归一化，保证旧数据兼容。
 */
export function canonicalSlotId(slotId?: string | null): string {
  if (!slotId) return '';
  if (PALETTE_SLOT_IDS.includes(slotId)) return slotId;
  const i = LEGACY_SLOT_ID_TO_INDEX[slotId];
  return i !== undefined ? PALETTE_SLOT_IDS[i] : '';
}

/** 是否为合法槽位引用（新 id palette-N 或旧预设名均视为合法） */
export function isPaletteSlotId(id?: string | null): id is string {
  return !!canonicalSlotId(id);
}

/** 槽位序号（1-based，仅对 palette-N 有效；非法返回 0） */
export function slotNumber(slotId: string): number {
  const i = PALETTE_SLOT_IDS.indexOf(slotId);
  return i >= 0 ? i + 1 : 0;
}

/**
 * 颜色提示文本：
 * - 命中出厂 16 预设色 → 返回中文色名（如「蓝色」），不暴露 RGB；
 * - 非预设（自定义色）→ 返回 hex 文本。
 */
export function describeColor(hex?: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return '';
  const i = PRESET_PALETTE_HEXES.indexOf(normalized);
  return i >= 0 ? PRESET_PALETTE_NAMES[i] ?? normalized : normalized;
}

/** 归一化 hex：#RRGGBB / #rrggbb → 小写 */
export function normalizeHex(hex?: string): string {
  return isHexColor(hex || '') ? (hex as string).toLowerCase() : '';
}

/**
 * 取色器「预设颜色」快速候选色板：32 色，按色系分区排列（白 → 红 → 橙 → 黄 →
 * 黄绿/绿 → 翡翠/青 → 蓝 → 靛/紫 → 品红/粉），同色系内由浅到深，尽量拉开辨识度。
 * 覆盖出厂 16 色并扩充 16 个同色系深浅变体；仅作取色快捷候选，**不参与**全局调色板槽位。
 */
export interface QuickPresetColor {
  hex: string;
  label: string;
}

export const QUICK_PRESET_COLORS: readonly QuickPresetColor[] = [
  // 中性
  { hex: '#ffffff', label: '白色' },
  // 红
  { hex: '#fca5a5', label: '浅红' },
  { hex: '#f87171', label: '红色' },
  { hex: '#ef4444', label: '深红' },
  // 橙
  { hex: '#fdba74', label: '浅橙' },
  { hex: '#fb923c', label: '橙色' },
  { hex: '#ea580c', label: '深橙' },
  // 黄 / 琥珀
  { hex: '#fde047', label: '浅黄' },
  { hex: '#facc15', label: '黄色' },
  { hex: '#f59e0b', label: '琥珀色' },
  // 黄绿 / 绿
  { hex: '#bef264', label: '浅黄绿' },
  { hex: '#a3e635', label: '黄绿色' },
  { hex: '#4ade80', label: '绿色' },
  { hex: '#22c55e', label: '深绿' },
  // 翡翠 / 青 / 青色
  { hex: '#34d399', label: '翡翠色' },
  { hex: '#2dd4bf', label: '青色' },
  { hex: '#a5f3fc', label: '浅青' },
  { hex: '#22d3ee', label: '青蓝色' },
  // 蓝 / 天蓝
  { hex: '#93c5fd', label: '浅蓝' },
  { hex: '#38bdf8', label: '天蓝色' },
  { hex: '#60a5fa', label: '蓝色' },
  { hex: '#3b82f6', label: '宝蓝色' },
  // 靛 / 紫
  { hex: '#818cf8', label: '靛蓝色' },
  { hex: '#6366f1', label: '深靛' },
  { hex: '#d8b4fe', label: '淡紫色' },
  { hex: '#c084fc', label: '紫色' },
  { hex: '#a78bfa', label: '蓝紫色' },
  // 品红 / 粉
  { hex: '#f9a8d4', label: '浅粉' },
  { hex: '#f472b6', label: '粉色' },
  { hex: '#f0abfc', label: '浅品红' },
  { hex: '#e879f9', label: '品红色' },
  { hex: '#ec4899', label: '深粉' },
];

/** 取色器预设描述：命中 32 色候选 → 中文色名；否则走出厂 16 色名 / hex 兜底 */
export function describeQuickColor(hex?: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return '';
  const hit = QUICK_PRESET_COLORS.find((c) => c.hex === normalized);
  return hit ? hit.label : describeColor(normalized);
}

/**
 * 规范化调色板 map：
 * - key 统一为 palette-N（兼容旧预设名 key 的读取）
 * - 过滤非法槽位/非法 hex，缺省槽用出厂色补齐（返回始终含全部 16 槽）
 */
export function normalizePaletteMap(palette?: PaletteHexMap): PaletteHexMap {
  const result: PaletteHexMap = { ...DEFAULT_PALETTE_HEXES };
  if (!palette) return result;
  for (const [rawId, hex] of Object.entries(palette)) {
    const id = canonicalSlotId(rawId);
    const normalized = normalizeHex(hex);
    if (id && normalized) result[id] = normalized;
  }
  return result;
}

/**
 * 规范化调色板槽别名 map：
 * - key 归一化为 palette-N（兼容旧预设名 key）
 * - 别名去除首尾空白；空别名视为未设置，不保留（返回的 map 只含真正设置了别名的槽）
 */
export function normalizeAliasMap(aliases?: PaletteAliasMap): PaletteAliasMap {
  const result: PaletteAliasMap = {};
  if (!aliases) return result;
  for (const [rawId, rawAlias] of Object.entries(aliases)) {
    const id = canonicalSlotId(rawId);
    const alias = typeof rawAlias === 'string' ? rawAlias.trim() : '';
    if (id && alias) result[id] = alias;
  }
  return result;
}

/**
 * 槽位的完整展示文案（title/aria 等）：
 * - 设置了别名 → `别名（调色板 N）：颜色`
 * - 未设置别名 → `调色板 N：颜色`
 */
export function describeSlotLabel(
  slotId: string,
  slots?: PaletteHexMap,
  aliases?: PaletteAliasMap,
): string {
  const id = canonicalSlotId(slotId) || slotId;
  const alias = (aliases?.[id] ?? '').trim();
  const hex = normalizeHex(slots?.[id]) || DEFAULT_PALETTE_HEXES[id] || '';
  // 颜色名：优先 32 色预设中文名 → 出厂 16 色中文名 → hex 兜底
  const colorText = hex ? describeQuickColor(hex) : '';
  return alias ? `${alias}（调色板 ${slotNumber(id)}）：${colorText}` : `调色板 ${slotNumber(id)}：${colorText}`;
}

/**
 * 取元素颜色最终 hex（小写）。
 * 优先级：colorSlot 绑定（自动兼容旧预设名 id）→ 槽位当前色；
 * 否则按静态解析（旧预设名→出厂默认色 / hex 原样）。
 * @param slots 全局调色板当前槽位色（无绑定或为空时忽略）
 */
export function resolveColorHex(
  selection: { color?: string; colorSlot?: string },
  slots?: PaletteHexMap,
): string {
  const { color, colorSlot } = selection ?? {};
  const slotId = canonicalSlotId(colorSlot);
  if (slotId && slots) {
    const slotHex = normalizeHex(slots[slotId]);
    if (slotHex) return slotHex;
  }
  return resolveNoteColor(color).toLowerCase();
}

/**
 * 元素颜色选择值：color = 静态 hex / 旧预设名；colorSlot = 绑定槽 id（palette-N）。
 * colorSlot 为空/undefined = 静态自定义色。
 */
export interface ColorSelection {
  color?: string;
  colorSlot?: string;
}

/** 将「选中的槽位」转换成 ColorSelection：color 记当前色快照，colorSlot 记槽 id（palette-N） */
export function slotSelection(slotId: string, slots?: PaletteHexMap): ColorSelection {
  const id = canonicalSlotId(slotId) || slotId;
  const hex = slots && slots[id] ? normalizeHex(slots[id]) : DEFAULT_PALETTE_HEXES[id] || '';
  return { color: hex, colorSlot: id };
}

/** 将「自定义色」转换成 ColorSelection（清空绑定） */
export function customSelection(hex: string): ColorSelection {
  const color = normalizeHex(hex);
  return { color };
}

/** 将存储对象（Website.iconColor/colorSlot 或 Note.color/colorSlot）还原成颜色选择 */
export function selectionFromStored(stored?: { color?: string; colorSlot?: string } | null): ColorSelection {
  const sel: ColorSelection = {};
  if (!stored) return sel;
  if (stored.colorSlot) sel.colorSlot = stored.colorSlot;
  if (stored.color) sel.color = stored.color;
  return sel;
}

/** 由「可能为空的字段」构建颜色选择（规避 exactOptionalPropertyTypes：不给可选属性赋 undefined） */
export function buildSelection(color?: string, colorSlot?: string): ColorSelection {
  const sel: ColorSelection = {};
  if (color) sel.color = color;
  if (colorSlot) sel.colorSlot = colorSlot;
  return sel;
}

/** 随机选中一个槽位（新建元素默认色）：color 记槽当前色快照，colorSlot 记槽 id */
export function randomSlotSelection(slots?: PaletteHexMap): ColorSelection {
  const id = PALETTE_SLOT_IDS[Math.floor(Math.random() * PALETTE_SLOT_IDS.length)];
  return slotSelection(id, slots);
}

/**
 * 未手动设色的站点/文件夹缺省材质色：跟随调色板 1 号槽当前色
 * （替代原 CSS 晶蓝兜底；槽位异常时回退出厂默认色，保证始终返回合法 hex）。
 */
export function defaultMaterialHex(slots?: PaletteHexMap): string {
  const id = PALETTE_SLOT_IDS[0]; // 调色板 1 号槽
  return normalizeHex(slots?.[id]) || DEFAULT_PALETTE_HEXES[id] || '';
}

/**
 * 把「图标/文件夹的颜色选择」（iconColor + colorSlot）解析成注入 .icon-circle 的 HSL CSS 变量；
 * 绑定槽→槽当前色；旧 hex→静态解析；未设置→缺省材质色（调色板 1 号槽，见 defaultMaterialHex）。
 */
export function resolveIconHslVars(
  icon: { iconColor?: string; colorSlot?: string },
  slots?: PaletteHexMap,
): Record<string, string> | undefined {
  const hex =
    resolveColorHex(buildSelection(icon.iconColor, icon.colorSlot), slots) || defaultMaterialHex(slots);
  return hexToHslCssVars(hex);
}
