/**
 * 全局调色板（16 槽）核心定义与解析
 * ---------------------------------------------------------------
 * 语义：
 * - 系统固定 16 个调色板槽，槽 id 为位置标识（palette-1 … palette-16，顺序沿用出厂
 *   16 色排列），**不含颜色语义**：颜色始终由「槽当前色」决定，用户可任意修改某槽颜色，
 *   id 不会随之失真（旧版曾以预设色名做 id，改色后语义错位，现已改为位置 id，
 *   并保留旧预设名的兼容读取）。
 * - 出厂默认 16 色 = DEFAULT_PALETTE_HEXES（palette-N → hex，取值来自 4×8 取色矩阵），
 *   是「恢复默认」与槽位缺省显示的基准。
 * - 元素（文件夹/站点图标/便签）取色时：选某个槽 → 写入 colorSlot=槽id + color=当前色快照；
 *   该元素实时跟随槽位当前色。选自定义 → 仅写 color=#rrggbb（无 colorSlot，静态）。
 * - 旧数据（无 colorSlot）一律视为静态自定义色：预设名按 noteColors 旧出厂色解析（不随
 *   新槽默认色变化，保证老数据不跳色）、hex 原样，不参与槽位联动。
 * ---------------------------------------------------------------
 */
import type { PaletteHexMap, PaletteAliasMap } from '../types';
import { hexToHslCssVars } from './colorUtils';
import { isHexColor, NOTE_COLOR_PRESETS, resolveNoteColor } from './noteColors';

/**
 * 出厂 16 槽默认色 = 预设矩阵「第 1 行（淡彩糖果色）+ 第 3 行（宝石深色）」共 16 色，
 * 按列序拼接（白 → … → 淡紫，深灰 → … → 深紫）。取值均为 QUICK_PRESET_COLORS 成员，
 * 保证「恢复默认」的基准色必然是取色器中的一个预设，可精确命中并显示中文色名。
 */
const FACTORY_PALETTE_HEXES: readonly string[] = [
  // 第 1 行（淡彩糖果色）
  '#ffffff', // 白色
  '#ff8a8a', // 粉红（糖果粉）
  '#ffb366', // 淡橙（蜜桃）
  '#ffe566', // 淡黄（香槟黄）
  '#8cd98c', // 淡绿（嫩草绿）
  '#7ad9d9', // 淡青（冰晶青）
  '#7ab8ff', // 淡蓝（天蓝）
  '#c28cff', // 淡紫（丁香紫）
  // 第 3 行（宝石深色）
  '#7a7a7a', // 深灰（金属灰）
  '#d90000', // 深赤（宝石红）
  '#d97000', // 深橙（柿子橙）
  '#d9a800', // 深黄（金盏黄）
  '#00a34a', // 深绿（翡翠绿）
  '#0099a8', // 深青（深海青）
  '#0055d9', // 深蓝（皇家蓝）
  '#8a2be2', // 深紫（帝王紫）
];

/** 16 槽稳定 id：palette-1 … palette-16（位置标识，不含颜色语义） */
export const PALETTE_SLOT_IDS: readonly string[] = Array.from(
  { length: FACTORY_PALETTE_HEXES.length },
  (_, i) => `palette-${i + 1}`,
);

/**
 * 显示层全局明暗度偏移范围：-50..50，0 = 原色。
 * 语义：不修改任何已存 hex，只在元素真实使用颜色（图标材质/文件夹窗口/便签表面）时
 * 叠加到 HSL 亮度通道，实现整站颜色统一调亮（正值）/调暗（负值）。
 */
export const LIGHTNESS_MIN = -50;
export const LIGHTNESS_MAX = 50;

/** 规范化明暗度：非法/NaN → 0（原色）；越界收敛到 [LIGHTNESS_MIN, LIGHTNESS_MAX]；取整。 */
export function normalizeLightness(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(Math.min(LIGHTNESS_MAX, Math.max(LIGHTNESS_MIN, value)));
}

/** 出厂默认 16 色：槽 id（palette-N）→ 出厂 hex（不可变基准，均取自 32 色预设矩阵） */
export const DEFAULT_PALETTE_HEXES: Readonly<Record<string, string>> = Object.fromEntries(
  PALETTE_SLOT_IDS.map((id, i) => [id, FACTORY_PALETTE_HEXES[i]]),
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
 * 颜色提示文本（兜底）：32 色预设与出厂槽色的中文名统一走 describeQuickColor；
 * 本函数仅把两者都未命中的自定义色以 hex 文本形式返回（不暴露语义）。
 */
export function describeColor(hex?: string): string {
  return normalizeHex(hex);
}

/** 归一化 hex：#RRGGBB / #rrggbb → 小写 */
export function normalizeHex(hex?: string): string {
  return isHexColor(hex || '') ? (hex as string).toLowerCase() : '';
}

/**
 * 取色器「预设颜色」快速候选色板：8 列 × 4 行色阶矩阵，主打「通透」高饱和风格。
 * - 第 1 列为中性灰阶：白 → 银灰 → 金属灰 → 纯黑（固定四档，不随彩色列调整）。
 * - 2~8 列为色系：红粉 / 橙 / 黄 / 绿 / 青 / 蓝 / 紫；行 = 明度档，自上而下：
 *   淡彩糖果 → 高饱和亮色（iOS 系统色） → 浓郁宝石深色 → 带色相的通透极深暗调
 *   （深档均保留饱和度、不发灰发闷）。
 * 列表按「行序（明度档）」排列、由 8 列网格逐行填充后，同列自动对齐同一色系。
 * 出厂 16 槽默认色取自本矩阵（FACTORY_PALETTE_HEXES），保证默认色与候选精确命中；
 * 本组仅作取色快捷候选，**不参与**全局调色板槽位。
 */
export interface QuickPresetColor {
  hex: string;
  label: string;
}

export const QUICK_PRESET_COLORS: readonly QuickPresetColor[] = [
  // ── 第 1 行（淡彩糖果色，通透不寡淡）──
  { hex: '#ffffff', label: '白色' },
  { hex: '#ff8a8a', label: '粉红' },
  { hex: '#ffb366', label: '淡橙' },
  { hex: '#ffe566', label: '淡黄' },
  { hex: '#8cd98c', label: '淡绿' },
  { hex: '#7ad9d9', label: '淡青' },
  { hex: '#7ab8ff', label: '淡蓝' },
  { hex: '#c28cff', label: '淡紫' },
  // ── 第 2 行（高饱和亮色）──
  { hex: '#d9d9d9', label: '银灰' },
  { hex: '#ff3b30', label: '亮赤' },
  { hex: '#ff9500', label: '亮橙' },
  { hex: '#ffcc00', label: '亮黄' },
  { hex: '#34c759', label: '亮绿' },
  { hex: '#5ac8fa', label: '亮青' },
  { hex: '#007aff', label: '亮蓝' },
  { hex: '#af52de', label: '亮紫' },
  // ── 第 3 行（浓郁宝石深色）──
  { hex: '#7a7a7a', label: '深灰' },
  { hex: '#d90000', label: '深赤' },
  { hex: '#d97000', label: '深橙' },
  { hex: '#d9a800', label: '深黄' },
  { hex: '#00a34a', label: '深绿' },
  { hex: '#0099a8', label: '深青' },
  { hex: '#0055d9', label: '深蓝' },
  { hex: '#8a2be2', label: '深紫' },
  // ── 第 4 行（极深但保留色相的通透暗调）──
  { hex: '#1a1a1a', label: '黑色' },
  { hex: '#b30000', label: '极深赤' },
  { hex: '#b35c00', label: '极深橙' },
  { hex: '#8a7300', label: '极深黄' },
  { hex: '#006b3d', label: '极深绿' },
  { hex: '#006b6b', label: '极深青' },
  { hex: '#0033b3', label: '极深蓝' },
  { hex: '#5b1a8b', label: '极深紫' },
];

/** 取色器预设描述：命中 32 色候选 → 中文色名；否则返回 hex（出厂 16 色均在候选内，无需单独兜底） */
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
  // 颜色名：命中 32 色预设（含出厂 16 槽默认色）→ 中文色名；否则 hex 兜底
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
 * @param lightness 显示层亮度叠加偏移（0 = 原色，来自全局明暗度设置），仅作用于 --c-lit
 */
export function resolveIconHslVars(
  icon: { iconColor?: string; colorSlot?: string },
  slots?: PaletteHexMap,
  lightness = 0,
): Record<string, string> | undefined {
  const hex =
    resolveColorHex(buildSelection(icon.iconColor, icon.colorSlot), slots) || defaultMaterialHex(slots);
  return hexToHslCssVars(hex, lightness);
}
