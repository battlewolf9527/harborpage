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

// 便签颜色（与多彩便签球/卡片视觉对应；按色相渐变排列，保证相邻两篇不撞色）
export type NoteColor =
  | 'yellow' | 'amber' | 'orange' | 'coral'
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
  color?: NoteColor;    // 便签球/卡片颜色
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
export type WallpaperType = 'gradient' | 'image' | 'solid' | 'bing' | 'randomBing' | 'local';

// 壁纸数据类型（保持向后兼容）
export interface WallpaperData extends VisualSettings {
  url: string | null;
  type: WallpaperType;
  solidColor?: string; // 纯色背景颜色
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
}

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
}
