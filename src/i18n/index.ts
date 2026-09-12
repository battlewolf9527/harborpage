import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import zhCNCommon from './locales/zh-CN/common.json';
import zhCNSettings from './locales/zh-CN/settings.json';
import zhCNAuth from './locales/zh-CN/auth.json';
import zhCNAbout from './locales/zh-CN/about.json';
import zhCNWeather from './locales/zh-CN/weather.json';
import zhCNTodos from './locales/zh-CN/todos.json';
import zhCNNotes from './locales/zh-CN/notes.json';
import zhCNSearch from './locales/zh-CN/search.json';
import zhCNPages from './locales/zh-CN/pages.json';
import zhCNFolder from './locales/zh-CN/folder.json';
import zhCNWallpaper from './locales/zh-CN/wallpaper.json';
import zhCNSites from './locales/zh-CN/sites.json';
import zhCNIcons from './locales/zh-CN/icons.json';
import zhCNImportExport from './locales/zh-CN/importExport.json';
import zhCNDock from './locales/zh-CN/dock.json';
import zhCNSystem from './locales/zh-CN/system.json';
import enUSCommon from './locales/en-US/common.json';
import enUSSettings from './locales/en-US/settings.json';
import enUSAuth from './locales/en-US/auth.json';
import enUSAbout from './locales/en-US/about.json';
import enUSWeather from './locales/en-US/weather.json';
import enUSTodos from './locales/en-US/todos.json';
import enUSNotes from './locales/en-US/notes.json';
import enUSSearch from './locales/en-US/search.json';
import enUSPages from './locales/en-US/pages.json';
import enUSFolder from './locales/en-US/folder.json';
import enUSWallpaper from './locales/en-US/wallpaper.json';
import enUSSites from './locales/en-US/sites.json';
import enUSIcons from './locales/en-US/icons.json';
import enUSImportExport from './locales/en-US/importExport.json';
import enUSDock from './locales/en-US/dock.json';
import enUSSystem from './locales/en-US/system.json';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

/** 语言切换选项：以各语言母语展示，不随当前界面语言变化 */
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: SupportedLanguage; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];

/** 语言偏好的本地兜底存储键（未登录时也能记住选择） */
const LANGUAGE_STORAGE_KEY = 'harborpage_language';

export const resources = {
  'zh-CN': {
    common: zhCNCommon,
    settings: zhCNSettings,
    auth: zhCNAuth,
    about: zhCNAbout,
    weather: zhCNWeather,
    todos: zhCNTodos,
    notes: zhCNNotes,
    search: zhCNSearch,
    pages: zhCNPages,
    folder: zhCNFolder,
    wallpaper: zhCNWallpaper,
    sites: zhCNSites,
    icons: zhCNIcons,
    importExport: zhCNImportExport,
    dock: zhCNDock,
    system: zhCNSystem,
  },
  'en-US': {
    common: enUSCommon,
    settings: enUSSettings,
    auth: enUSAuth,
    about: enUSAbout,
    weather: enUSWeather,
    todos: enUSTodos,
    notes: enUSNotes,
    search: enUSSearch,
    pages: enUSPages,
    folder: enUSFolder,
    wallpaper: enUSWallpaper,
    sites: enUSSites,
    icons: enUSIcons,
    importExport: enUSImportExport,
    dock: enUSDock,
    system: enUSSystem,
  },
};

export const isSupportedLanguage = (value: unknown): value is SupportedLanguage =>
  typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);

/** 解析语言：本地存储 > 浏览器语言 > 默认 */
export function detectLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(saved)) return saved;
  } catch {
    // localStorage 不可用时忽略，继续按浏览器语言判断
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
  if (nav.startsWith('zh')) return 'zh-CN';
  if (nav.startsWith('en')) return 'en-US';
  return DEFAULT_LANGUAGE;
}

/** 同步 <html lang>，便于无障碍与浏览器排版 */
function applyDocumentLanguage(language: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

/** 切换语言：写本地兜底 + 更新 i18next（触发使用 useTranslation 的组件重渲染） */
export function changeAppLanguage(language: SupportedLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // 忽略写入失败
  }
  void i18n.changeLanguage(language);
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  ns: [
    'common',
    'settings',
    'auth',
    'about',
    'weather',
    'todos',
    'notes',
    'search',
    'pages',
    'folder',
    'wallpaper',
    'sites',
    'icons',
    'importExport',
    'dock',
    'system',
  ],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on('languageChanged', applyDocumentLanguage);
applyDocumentLanguage(i18n.language);

export default i18n;
