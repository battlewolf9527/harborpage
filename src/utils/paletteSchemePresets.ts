/**
 * 内置配色方案（只读模板）数据
 * ---------------------------------------------------------------
 * 纯数据模块，零运行时依赖（避免与 paletteColors.ts 形成循环引用）。
 * - 每套方案 16 色，顺序对应槽 id palette-1 … palette-16。
 * - 1 号槽 = 该方案主色：未设色的图标/文件夹缺省材质色取调色板 1 号槽
 *   （见 paletteColors.defaultMaterialHex），因此不再使用「纯白」占位。
 * - 每套保留 2~4 个中性色，色相有取舍、明度有节奏（不再是等亮等饱和的彩虹）。
 * - name 为 i18n key（settings:palette.schemes.builtin.*），展示时由 describeSchemeName 翻译。
 * - 每套方案自带 16 个别名（体现配色的取色思路，如「极光靛」「霓虹粉」）；别名值同样是 i18n key
 *   （settings:palette.schemes.aliases.<方案>.<序号>），展示时由 paletteColors.displayAlias 翻译，
 *   因此切换语言后槽位别名会跟着变，没有中文写死。
 * ---------------------------------------------------------------
 */
import type { PaletteAliasMap, PaletteScheme } from '../types';

/** 内置方案的 16 个槽 id（palette-1 … palette-16）。本模块要求零依赖，故不复用 paletteColors 的常量 */
const SLOT_IDS: readonly string[] = Array.from({ length: 16 }, (_, i) => `palette-${i + 1}`);

/** 生成某套内置方案的别名集合（值为 i18n key，见文件头说明） */
const schemeAliases = (key: string): PaletteAliasMap =>
  Object.fromEntries(
    SLOT_IDS.map((slotId, i) => [slotId, `settings:palette.schemes.aliases.${key}.${i + 1}`]),
  );

/** 默认方案（新装/缺省补齐的基准色）：极光 */
const DEFAULT_SCHEME_ID = 'builtin-aurora';

/** 原出厂 16 色方案 id（保留兼容，让老用户能找到熟悉配色） */
const CLASSIC_SCHEME_ID = 'builtin-classic';

/** 原出厂 16 色：经典彩虹（历史版本 FACTORY_PALETTE_HEXES，保持完全一致） */
const CLASSIC_PALETTE_HEXES: readonly string[] = [
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

/**
 * 内置 7 套配色方案。顺序即设置界面的展示顺序，第 1 套为默认方案。
 */
export const BUILTIN_PALETTE_SCHEMES: readonly PaletteScheme[] = [
  {
    id: DEFAULT_SCHEME_ID,
    name: 'settings:palette.schemes.builtin.aurora',
    builtin: true,
    aliases: schemeAliases('aurora'),
    // 极光：冷调靛紫主色 + 青绿冷色系，收尾三档中性
    hexes: [
      '#6366f1', // 极光靛（主色）
      '#8b5cf6', // 电紫
      '#a855f7', // 紫罗兰
      '#d946ef', // 品红
      '#ec4899', // 玫红
      '#f43f5e', // 玫瑰红
      '#fb923c', // 琥珀橙
      '#fbbf24', // 金黄
      '#34d399', // 薄荷
      '#10b981', // 翡翠
      '#14b8a6', // 青碧
      '#22d3ee', // 极光青
      '#38bdf8', // 天蓝
      '#94a3b8', // 雾灰
      '#475569', // 石板
      '#1e1b4b', // 午夜靛
    ],
  },
  {
    id: 'builtin-sunset',
    name: 'settings:palette.schemes.builtin.sunset',
    builtin: true,
    aliases: schemeAliases('sunset'),
    // 琥珀日落：暖调赤陶/琥珀/酒红，收尾暖中性
    hexes: [
      '#e86a33', // 赤陶（主色）
      '#f97316', // 橙
      '#fb923c', // 琥珀
      '#fbbf24', // 金
      '#facc15', // 向日葵
      '#ef4444', // 朱红
      '#dc2626', // 正红
      '#b91c1c', // 酒红
      '#e11d48', // 莓红
      '#be185d', // 绛紫
      '#a855f7', // 紫
      '#84cc16', // 青柠
      '#65a30d', // 橄榄
      '#a8a29e', // 暖灰
      '#78716c', // 石褐
      '#44403c', // 石墨
    ],
  },
  {
    id: 'builtin-forest',
    name: 'settings:palette.schemes.builtin.forest',
    builtin: true,
    aliases: schemeAliases('forest'),
    // 松林：绿/青自然系 + 赭棕，收尾冷中性
    hexes: [
      '#16a34a', // 松绿（主色）
      '#22c55e', // 草绿
      '#4ade80', // 嫩绿
      '#84cc16', // 黄绿
      '#a3e635', // 青柠
      '#65a30d', // 橄榄
      '#0d9488', // 松青
      '#14b8a6', // 碧绿
      '#2dd4bf', // 薄荷青
      '#0ea5e9', // 湖蓝
      '#ca8a04', // 苔黄
      '#b45309', // 栗棕
      '#78350f', // 深棕
      '#d6d3d1', // 米灰
      '#78716c', // 石褐
      '#292524', // 墨黑
    ],
  },
  {
    id: 'builtin-morandi',
    name: 'settings:palette.schemes.builtin.morandi',
    builtin: true,
    aliases: schemeAliases('morandi'),
    // 莫兰迪：全低饱和，温柔灰调
    hexes: [
      '#6b8299', // 雾蓝（主色）
      '#8fa5b3', // 灰蓝
      '#9b8fa5', // 灰紫
      '#c9a9a6', // 藕粉
      '#c98d84', // 陶土
      '#b5656e', // 豆沙红
      '#a8766b', // 赭石
      '#b9a394', // 奶咖
      '#d5c8b5', // 暖沙
      '#ece7df', // 米白
      '#b8b48d', // 橄榄灰
      '#9caf88', // 鼠尾草
      '#7b8f76', // 苔绿
      '#4f5d55', // 墨绿灰
      '#46505e', // 藏青灰
      '#5c5a5a', // 深灰
    ],
  },
  {
    id: 'builtin-cyber',
    name: 'settings:palette.schemes.builtin.cyber',
    builtin: true,
    aliases: schemeAliases('cyber'),
    // 霓虹赛博：12 色高饱和霓虹 + 4 档墨底
    hexes: [
      '#ff2e88', // 霓虹粉（主色）
      '#ff4d6d', // 珊瑚红
      '#ff8a00', // 霓虹橙
      '#ffd60a', // 电黄
      '#a3ff12', // 酸橙
      '#00ffa3', // 霓虹绿
      '#00e5ff', // 霓虹青
      '#00b3ff', // 电蓝
      '#3d5afe', // 电靛
      '#7b2ff7', // 电紫
      '#b026ff', // 紫品红
      '#ff00c8', // 品红
      '#c9c9d9', // 银白
      '#5b5b7a', // 灰紫
      '#2a2a3c', // 深墨
      '#14141f', // 纯墨
    ],
  },
  {
    id: 'builtin-ink',
    name: 'settings:palette.schemes.builtin.ink',
    builtin: true,
    aliases: schemeAliases('ink'),
    // 水墨：朱砂/花青/赭石点缀 + 大量墨阶与宣纸
    hexes: [
      '#b03a2e', // 朱砂（主色）
      '#d16a5a', // 赭红
      '#c08457', // 赭石
      '#a68a4c', // 秋香
      '#3f5c6b', // 花青
      '#5a7d8c', // 远山蓝
      '#66795f', // 松烟绿
      '#8a8f8a', // 苔灰
      '#b8b5ad', // 宣纸灰
      '#ddd9d0', // 宣纸
      '#f4f1ea', // 生宣
      '#9a9a97', // 中墨灰
      '#6e6e6b', // 淡墨
      '#4a4a48', // 中墨
      '#2b2b29', // 浓墨
      '#141413', // 焦墨
    ],
  },
  {
    id: 'builtin-candy',
    name: 'settings:palette.schemes.builtin.candy',
    builtin: true,
    aliases: schemeAliases('candy'),
    // 糖果：全高亮高饱和的甜系色，粉→橘→黄→绿→青→蓝→紫一路铺开，收尾奶油白与巧克力棕
    hexes: [
      '#ff4d94', // 草莓粉（主色）
      '#ff6b81', // 西瓜红
      '#ff9f45', // 蜜橘橙
      '#ffd93d', // 柠檬黄
      '#b8e335', // 青柠绿
      '#4ade80', // 薄荷绿
      '#2dd4bf', // 汽水青
      '#38bdf8', // 棉花糖蓝
      '#5b8cff', // 蓝莓蓝
      '#a78bfa', // 葡萄紫
      '#e879f9', // 泡泡糖紫
      '#ff7ac6', // 樱花粉
      '#f472b6', // 桃红
      '#fca5a5', // 蜜桃粉
      '#fff1f2', // 奶油白
      '#7c5c4a', // 巧克力棕
    ],
  },
  {
    id: CLASSIC_SCHEME_ID,
    name: 'settings:palette.schemes.builtin.classic',
    builtin: true,
    aliases: schemeAliases('classic'),
    // 经典彩虹：原出厂 16 色，保持完全一致
    hexes: [...CLASSIC_PALETTE_HEXES],
  },
];

/** 默认方案的 16 色（= 出厂默认色基准，paletteColors.DEFAULT_PALETTE_HEXES 取此值） */
export const DEFAULT_SCHEME_HEXES: readonly string[] = BUILTIN_PALETTE_SCHEMES[0].hexes;