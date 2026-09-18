/**
 * 全局调色板（16 槽）核心定义与解析
 * ---------------------------------------------------------------
 * 语义：
 * - 系统固定 16 个调色板槽，槽 id 为位置标识（palette-1 … palette-16），**不含颜色语义**：
 *   颜色始终由「槽当前色」决定，用户可任意修改某槽颜色，id 不会随之失真（旧版曾以预设色名
 *   做 id，改色后语义错位，现已改为位置 id，并保留旧预设名的兼容读取）。
 * - 出厂默认 16 色 = DEFAULT_PALETTE_HEXES（palette-N → hex），取值来自「配色方案」中的
 *   默认方案（极光，见 paletteSchemePresets.BUILTIN_PALETTE_SCHEMES），是「恢复默认」与
 *   槽位缺省显示的基准。
 * - 配色方案（PaletteScheme）是只读模板：内置 7 套由代码常量提供，自建方案由用户
 *   「保存为方案」从当前调色板快照生成；应用方案 = 直接改写调色板（slots + aliases），
 *   之后用户改调色板不回写方案。
 * - 元素（文件夹/站点图标/便签）取色时：选某个槽 → 写入 colorSlot=槽id + color=当前色快照；
 *   该元素实时跟随槽位当前色。选自定义 → 仅写 color=#rrggbb（无 colorSlot，静态）。
 * - 旧数据（无 colorSlot）一律视为静态自定义色：预设名按 noteColors 旧出厂色解析（不随
 *   新槽默认色变化，保证老数据不跳色）、hex 原样，不参与槽位联动。
 * ---------------------------------------------------------------
 */
import type { PaletteHexMap, PaletteAliasMap, PaletteScheme } from '../types';
import i18n from '../i18n';
import type sitesResources from '../i18n/locales/zh-CN/sites.json';
import { hexToHslCssVars } from './colorUtils';
import { generateId } from './idUtils';
import { isHexColor, NOTE_COLOR_PRESETS, resolveNoteColor } from './noteColors';
import { BUILTIN_PALETTE_SCHEMES, DEFAULT_SCHEME_HEXES } from './paletteSchemePresets';

/** 快捷预设色的展示名 key（sites:colorNames.*），由语言包结构推导，保证字面量类型合法 */
type QuickColorKey = `colorNames.${keyof typeof sitesResources.colorNames}`;

/**
 * 出厂 16 槽默认色 = 默认配色方案「极光」的 16 色（见 paletteSchemePresets）。
 * 1 号槽为该方案主色（未设色图标/文件夹的缺省材质色取 1 号槽，不再是纯白）。
 */
const FACTORY_PALETTE_HEXES: readonly string[] = DEFAULT_SCHEME_HEXES;

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

/** 出厂默认 16 色：槽 id（palette-N）→ 出厂 hex（不可变基准，取自默认配色方案「极光」） */
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
 * 颜色提示文本（兜底）：32 色预设与命中预设的槽色走 describeQuickColor 的中文色名；
 * 本函数把未命中的自定义色 / 配色方案色以 hex 文本形式返回（不暴露语义）。
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
 * 本组仅作取色快捷候选（含中文色名），**不参与**全局调色板槽位；配色方案色若未命中本矩阵，
 * 槽位提示文本按 hex 展示。
 */
export interface QuickPresetColor {
  hex: string;
  /** 展示名 i18n key（sites:colorNames.*）；颜色名仅用于展示，不作为任何数据/持久化标识 */
  colorKey: QuickColorKey;
}

export const QUICK_PRESET_COLORS: readonly QuickPresetColor[] = [
  // ── 第 1 行（淡彩糖果色，通透不寡淡）──
  { hex: '#ffffff', colorKey: 'colorNames.white' },
  { hex: '#ff8a8a', colorKey: 'colorNames.pink' },
  { hex: '#ffb366', colorKey: 'colorNames.lightOrange' },
  { hex: '#ffe566', colorKey: 'colorNames.lightYellow' },
  { hex: '#8cd98c', colorKey: 'colorNames.lightGreen' },
  { hex: '#7ad9d9', colorKey: 'colorNames.lightCyan' },
  { hex: '#7ab8ff', colorKey: 'colorNames.lightBlue' },
  { hex: '#c28cff', colorKey: 'colorNames.lightPurple' },
  // ── 第 2 行（高饱和亮色）──
  { hex: '#d9d9d9', colorKey: 'colorNames.silver' },
  { hex: '#ff3b30', colorKey: 'colorNames.brightRed' },
  { hex: '#ff9500', colorKey: 'colorNames.brightOrange' },
  { hex: '#ffcc00', colorKey: 'colorNames.brightYellow' },
  { hex: '#34c759', colorKey: 'colorNames.brightGreen' },
  { hex: '#5ac8fa', colorKey: 'colorNames.brightCyan' },
  { hex: '#007aff', colorKey: 'colorNames.brightBlue' },
  { hex: '#af52de', colorKey: 'colorNames.brightPurple' },
  // ── 第 3 行（浓郁宝石深色）──
  { hex: '#7a7a7a', colorKey: 'colorNames.darkGray' },
  { hex: '#d90000', colorKey: 'colorNames.darkRed' },
  { hex: '#d97000', colorKey: 'colorNames.darkOrange' },
  { hex: '#d9a800', colorKey: 'colorNames.darkYellow' },
  { hex: '#00a34a', colorKey: 'colorNames.darkGreen' },
  { hex: '#0099a8', colorKey: 'colorNames.darkCyan' },
  { hex: '#0055d9', colorKey: 'colorNames.darkBlue' },
  { hex: '#8a2be2', colorKey: 'colorNames.darkPurple' },
  // ── 第 4 行（极深但保留色相的通透暗调）──
  { hex: '#1a1a1a', colorKey: 'colorNames.black' },
  { hex: '#b30000', colorKey: 'colorNames.extraDarkRed' },
  { hex: '#b35c00', colorKey: 'colorNames.extraDarkOrange' },
  { hex: '#8a7300', colorKey: 'colorNames.extraDarkYellow' },
  { hex: '#006b3d', colorKey: 'colorNames.extraDarkGreen' },
  { hex: '#006b6b', colorKey: 'colorNames.extraDarkCyan' },
  { hex: '#0033b3', colorKey: 'colorNames.extraDarkBlue' },
  { hex: '#5b1a8b', colorKey: 'colorNames.extraDarkPurple' },
];

/** 取色器预设描述：命中 32 色候选 → 中文色名；否则返回 hex（如配色方案中的非预设色） */
export function describeQuickColor(hex?: string): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return '';
  const hit = QUICK_PRESET_COLORS.find((c) => c.hex === normalized);
  return hit ? i18n.t(`sites:${hit.colorKey}`) : describeColor(normalized);
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
  // 别名可能是 i18n key（内置方案自带别名），展示前翻译
  const alias = displayAlias(aliases?.[id]);
  const hex = normalizeHex(slots?.[id]) || DEFAULT_PALETTE_HEXES[id] || '';
  // 颜色名：命中 32 色预设 → 中文色名；否则 hex 兜底（如配色方案中的非预设色）
  const colorText = hex ? describeQuickColor(hex) : '';
  const number = slotNumber(id);
  return alias
    ? i18n.t('sites:slotLabelWithAlias', { alias, number, color: colorText })
    : i18n.t('sites:slotLabel', { number, color: colorText });
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

/* ════════════════════════════════════════════════════════════════
   配色方案（PaletteScheme）工具
   方案是只读模板：内置 7 套来自代码常量，自建方案持久化在 UserData.paletteSchemes；
   应用方案 = 把方案的 16 色与别名写入调色板（slots + aliases），不回写方案。
   ════════════════════════════════════════════════════════════════ */

/** 自建方案 id 前缀（内置方案为 'builtin-' 前缀，二者互斥） */
export const SCHEME_CUSTOM_ID_PREFIX = 'custom-';

/** 全部可选方案：内置 7 套 + 用户自建方案 */
export function allSchemes(custom: readonly PaletteScheme[] = []): PaletteScheme[] {
  return [...BUILTIN_PALETTE_SCHEMES, ...custom];
}

/** 按 id 查找方案（内置 + 自建）；找不到返回 undefined */
export function findScheme(
  id: string,
  custom: readonly PaletteScheme[] = [],
): PaletteScheme | undefined {
  return allSchemes(custom).find((scheme) => scheme.id === id);
}

/**
 * 动态 key 翻译：i18n.t 的类型层要求字面量 key，而内置方案名（即 key）存在数据里，
 * 故在此单点降级为通用签名调用（运行期 i18next 支持任意字符串 key）。
 */
const translateDynamic = (key: string): string =>
  (i18n.t as unknown as (key: string) => string)(key);

/** 方案名展示：内置方案走 i18n（name 即语言包 key），自建方案用用户输入名 */
export function describeSchemeName(scheme: PaletteScheme): string {
  return scheme.builtin ? translateDynamic(scheme.name) : scheme.name;
}

/**
 * 别名展示：内置方案的别名存的是 i18n key（settings:palette.schemes.aliases.<方案>.<序号>），
 * 展示时翻译成当前语言；用户自己输入的自定义别名不含 ':'，原样返回。
 */
export function displayAlias(rawAlias?: string): string {
  const raw = (rawAlias ?? '').trim();
  if (!raw) return '';
  return raw.includes(':') ? translateDynamic(raw) : raw;
}

/** 由方案的 16 色数组构建槽色 map（始终含全部槽位，非法/缺失槽回退出厂默认色） */
export function schemeHexMap(scheme: PaletteScheme): PaletteHexMap {
  const map: PaletteHexMap = {};
  PALETTE_SLOT_IDS.forEach((id, i) => {
    const hex = normalizeHex(scheme.hexes[i]);
    if (hex) map[id] = hex;
  });
  return normalizePaletteMap(map);
}

/** 以当前调色板（色 + 别名）快照生成自建方案 */
export function schemeFromPalette(
  name: string,
  slots: PaletteHexMap,
  aliases: PaletteAliasMap,
): PaletteScheme {
  const normalized = normalizePaletteMap(slots);
  return {
    id: generateId(SCHEME_CUSTOM_ID_PREFIX),
    name: name.trim(),
    hexes: PALETTE_SLOT_IDS.map((id) => normalized[id] ?? DEFAULT_PALETTE_HEXES[id] ?? ''),
    aliases: normalizeAliasMap(aliases),
  };
}

/** 方案内容是否与当前调色板（16 色 + 别名）完全一致（判定「当前生效的方案」） */
export function schemeMatchesPalette(
  scheme: PaletteScheme,
  slots: PaletteHexMap,
  aliases: PaletteAliasMap,
): boolean {
  const hexMap = schemeHexMap(scheme);
  const schemeAliases = normalizeAliasMap(scheme.aliases);
  const currentAliases = normalizeAliasMap(aliases);
  // 内置方案的别名是出厂模板：调色板一个别名都没设过时（如沿用出厂默认色的用户）
  // 视为仍在使用该方案，不因「别名尚未落地」判成自定义配色
  const aliasMatched =
    (scheme.builtin === true && Object.keys(currentAliases).length === 0) ||
    PALETTE_SLOT_IDS.every(
      (id) => (schemeAliases[id] ?? '') === (currentAliases[id] ?? ''),
    );
  return (
    aliasMatched && PALETTE_SLOT_IDS.every((id) => hexMap[id] === normalizeHex(slots[id]))
  );
}

/**
 * 解析「当前生效的方案」，用于下拉框的选中项。
 * 识别以 **方案 id** 为准（`preferredId` = 用户最后一次应用的方案，见 usePaletteStore.activeSchemeId），
 * 颜色内容只作为校验与兜底，不承担识别职责：
 * 1. `preferredId` 命中的方案，且其内容（16 色 + 别名）仍与当前调色板一致 → 采用它（多套方案内容
 *    完全相同时也能各自选中，例如把内置「极光」原样另存为自建方案后，两者仍可分别选中）；
 * 2. id 缺失/方案已删除/内容已被手工改动 → 回落到内容匹配：自建方案优先（取最近保存的一套），
 *    再退到内置方案；
 * 3. 都不一致返回 null（UI 显示「自定义配色」）。
 */
export function resolveActiveScheme(
  custom: readonly PaletteScheme[],
  slots: PaletteHexMap,
  aliases: PaletteAliasMap,
  preferredId?: string | null,
): PaletteScheme | null {
  if (preferredId) {
    const preferred = allSchemes(custom).find((s) => s.id === preferredId);
    if (preferred && schemeMatchesPalette(preferred, slots, aliases)) return preferred;
  }
  for (let i = custom.length - 1; i >= 0; i -= 1) {
    const scheme = custom[i];
    if (scheme && schemeMatchesPalette(scheme, slots, aliases)) return scheme;
  }
  return BUILTIN_PALETTE_SCHEMES.find((s) => schemeMatchesPalette(s, slots, aliases)) ?? null;
}

/**
 * 规范化自建方案列表：逐项校验并清洗，丢弃非法项——
 * id 必须为 'custom-' 前缀、name 非空、hexes 恰好 16 个合法 hex；id 去重（保留首个）。
 */
export function normalizeSchemeList(raw?: readonly PaletteScheme[]): PaletteScheme[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: PaletteScheme[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    if (!id.startsWith(SCHEME_CUSTOM_ID_PREFIX) || !name || seen.has(id)) continue;
    const hexes: readonly string[] = Array.isArray(item.hexes) ? item.hexes : [];
    if (hexes.length !== PALETTE_SLOT_IDS.length) continue;
    const normalizedHexes = hexes.map((hex) => normalizeHex(hex));
    if (normalizedHexes.some((hex) => !hex)) continue;
    seen.add(id);
    result.push({ id, name, hexes: normalizedHexes, aliases: normalizeAliasMap(item.aliases) });
  }
  return result;
}
