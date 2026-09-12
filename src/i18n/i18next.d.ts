/** i18next 类型增强：声明全部命名空间，供 useTranslation 的 t() 做键名类型检查 */
import 'i18next';
import type common from './locales/zh-CN/common.json';
import type settings from './locales/zh-CN/settings.json';
import type auth from './locales/zh-CN/auth.json';
import type about from './locales/zh-CN/about.json';
import type weather from './locales/zh-CN/weather.json';
import type todos from './locales/zh-CN/todos.json';
import type notes from './locales/zh-CN/notes.json';
import type search from './locales/zh-CN/search.json';
import type pages from './locales/zh-CN/pages.json';
import type folder from './locales/zh-CN/folder.json';
import type wallpaper from './locales/zh-CN/wallpaper.json';
import type sites from './locales/zh-CN/sites.json';
import type icons from './locales/zh-CN/icons.json';
import type importExport from './locales/zh-CN/importExport.json';
import type dock from './locales/zh-CN/dock.json';
import type system from './locales/zh-CN/system.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      settings: typeof settings;
      auth: typeof auth;
      about: typeof about;
      weather: typeof weather;
      todos: typeof todos;
      notes: typeof notes;
      search: typeof search;
      pages: typeof pages;
      folder: typeof folder;
      wallpaper: typeof wallpaper;
      sites: typeof sites;
      icons: typeof icons;
      importExport: typeof importExport;
      dock: typeof dock;
      system: typeof system;
    };
  }
}
