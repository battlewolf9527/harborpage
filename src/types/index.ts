// 页面类型
export interface Page {
  id: string;
  name: string;
  websites: Website[];
  createdAt: number;
}

// 网站类型
export interface Website {
  id: string;
  name: string;
  url: string;
  icon?: string;
  /** 图标底色（CSS 颜色值，如 '#2563EB' 或 'transparent'），默认透明 */
  iconColor?: string;
  /**
   * 绑定的全局调色板槽 id（palette-1 … palette-16，仅表位置、不含颜色语义；
   * 兼容旧预设名，如 'blue'，见 paletteColors.ts）。
   * 设置后该元素颜色实时跟随槽位当前色（iconColor 作为快照/回退保留）；
   * 旧数据无此字段，一律按自定义静态色处理，不参与槽位联动。
   */
  colorSlot?: string;
  isFolder?: boolean;
  children?: Website[];
}

// 预设导入用类型（包含 parentFolder，主流程不使用）
export interface ImportableWebsite extends Website {
  parentFolder?: string;
}

// 搜索引擎类型
export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
}

// 待办事项类型
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

// 便签颜色（与多彩便签球/卡片视觉对应；白色居首，其余按色相渐变排列，保证相邻两篇不撞色）
// 历史/预设值使用下列 16 色名字面量；自定义色另存任意 #rrggbb（见 Note.color 注释）
// 注意：'coral' 曾作为预设，现因与 orange 过近退役，仅保留读取兼容（见 noteColors.ts RETIRED_PRESET_HEX）
export type NoteColor =
  | 'white'
  | 'yellow' | 'amber' | 'orange'
  | 'pink' | 'rose'
  | 'red'
  | 'green' | 'lime' | 'emerald' | 'teal' | 'cyan'
  | 'blue' | 'sky'
  | 'purple' | 'indigo';

// 笔记类型
export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  // ===== 新增（均为可选，旧数据零侵入）=====
  updatedAt?: string;   // 最后更新时间（用于列表默认排序）
  /** @deprecated 已移除置顶 UI 入口，字段保留仅用于读取历史数据，新建/修改不会再写 */
  pinned?: boolean;
  /** 便签球/卡片颜色：16 色预设名（如 'white'，旧数据静态色）或自定义 #rrggbb；新绑定槽位的便签此字段存当前色快照 */
  color?: string;
  /** 绑定的全局调色板槽 id（palette-N 位置 id，兼容旧预设名；无此字段 = 静态自定义色） */
  colorSlot?: string;
}

// 文件夹状态类型（运行时状态，持久化中不存储此结构）
export interface OpenFolder {
  id: string;
  name: string;
  /** 当前打开文件夹的子项列表，对应 Website.children 的快照 */
  websites: Website[];
}

// 视觉效果设置（共享类型，避免重复定义）
export interface VisualSettings {
  blurLevel?: number;
  overlayLevel?: number;
}

// 壁纸类型字面量联合类型
export type WallpaperType = 'gradient' | 'image' | 'solid' | 'bing' | 'randomBing' | 'local' | 'custom';

// 壁纸数据类型（保持向后兼容）
export interface WallpaperData extends VisualSettings {
  url: string | null;
  type: WallpaperType;
  solidColor?: string; // 纯色背景颜色
  /** 自动更换壁纸开关（持久化） */
  autoChangeEnabled?: boolean;
  /** 自动更换间隔（小时） */
  autoChangeIntervalHours?: number;
  /** 最近一次壁纸切换时间戳，作为自动更换计时的锚点 */
  lastAutoChangeAt?: number;
}

// Favicon源配置（可自定义的favicon下载源）
export interface FaviconSource {
  id: string;
  name: string;
  /** URL模板，使用 {domain} 作为占位符 */
  urlTemplate: string;
  enabled: boolean;
}

// 设置类型
export interface Settings extends VisualSettings {
  siteTitle?: string;
  iconColumns?: number;
  autoSaveEnabled?: boolean;
  autoSaveDuration?: number;
  defaultSearchEngineId?: string;
  faviconSources?: FaviconSource[];
  /** 主界面功能开关（默认全部开启）：天气组件入口 */
  weatherEnabled?: boolean;
  /** 主界面功能开关（默认全部开启）：搜索框入口 */
  searchEnabled?: boolean;
  /** 主界面功能开关（默认全部开启）：笔记入口 */
  notesEnabled?: boolean;
  /** 主界面功能开关（默认全部开启）：待办事项入口 */
  todosEnabled?: boolean;
  /** 主界面功能开关（默认全部开启）：多页面入口 */
  pagesEnabled?: boolean;
}

// 全局调色板：槽 id（palette-N）→ 当前 hex（id 见 paletteColors.PALETTE_SLOT_IDS，缺省按默认 16 色补齐）
export type PaletteHexMap = Record<string, string>;

// 调色板槽别名：槽 id（palette-N）→ 用户自定义名称（可选；仅存设置了别名的槽）
export type PaletteAliasMap = Record<string, string>;

// 用户数据类型
export interface UserData {
  settings?: Settings;
  websites?: Website[]; // 向后兼容：旧数据使用根级 websites 字段
  pages?: Page[];
  currentPageId?: string | undefined;
  searchEngines?: SearchEngine[];
  todos?: Todo[];
  todoList?: Todo[]; // 向后兼容：旧数据使用 todoList 字段
  notes?: Note[];
  wallpaper?: WallpaperData;
  /** 全局调色板（16 槽当前色）；未设置 = 全部使用默认 16 色 */
  palette?: PaletteHexMap;
  /** 调色板槽别名（palette-N → 用户自定义名称）；未设置 = 无别名，按「调色板 N」展示 */
  paletteAliases?: PaletteAliasMap;
  /**
   * 全局显示明暗度偏移（-50..50，0 = 原色）：不改动任何已存 hex，
   * 仅在元素真实使用颜色（图标材质/文件夹窗口/便签表面）时叠加到 HSL 亮度通道，
   * 实现整站颜色统一调亮/调暗；未设置 = 不调整。
   */
  paletteLightness?: number;
}
