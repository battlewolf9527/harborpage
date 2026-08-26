import type { Website, ImportableWebsite, SearchEngine, Todo, Note, Settings, UserData, Page } from '../types';
import { EXPORT_FILE_PREFIX } from '../constants';
import ConfigService from '../services/ConfigService';
import { generateId } from './idUtils';

// 导出数据格式
export interface ExportData {
  version: string;
  exportDate: string;
  websites: Website[];
}

// 从 ConfigService 获取 R2 域名
const getR2Domain = (): string => {
  const r2Url = ConfigService.getR2Url();
  if (!r2Url) return '';
  try {
    return new URL(r2Url).hostname;
  } catch {
    return '';
  }
};

// 清理单个图标 URL：若指向 R2 域则置空
const cleanIconUrl = (icon: string | undefined, r2Domain: string): string | undefined => {
  if (r2Domain && icon && icon.includes(r2Domain)) return '';
  return icon;
};

// 清理单个网站的 R2 图标 URL（递归处理文件夹）
const cleanWebsiteR2Urls = (website: Website, r2Domain: string): Website => {
  const cleanedIcon = cleanIconUrl(website.icon, r2Domain);
  const cleaned: Website = cleanedIcon === undefined
    ? { ...website }
    : { ...website, icon: cleanedIcon };
  if (cleaned.isFolder && cleaned.children) {
    cleaned.children = cleaned.children.map(child => cleanWebsiteR2Urls(child, r2Domain));
  }
  return cleaned;
};

// 清理网站数组的R2图标URL
export const cleanR2Urls = (websites: Website[]): Website[] => {
  const r2Domain = getR2Domain();
  return websites.map(website => cleanWebsiteR2Urls(website, r2Domain));
};

// 清理完整UserData的R2图标URL
export const cleanUserDataR2Urls = (data: UserData): UserData => {
  const r2Domain = getR2Domain();
  const cleaned: UserData = { ...data };

  if (cleaned.websites) {
    cleaned.websites = cleaned.websites.map(website => cleanWebsiteR2Urls(website, r2Domain));
  }

  if (cleaned.pages) {
    cleaned.pages = cleaned.pages.map((page: Page) => ({
      ...page,
      websites: page.websites.map(website => cleanWebsiteR2Urls(website, r2Domain)),
    }));
  }

  if (cleaned.searchEngines) {
    cleaned.searchEngines = cleaned.searchEngines.map((engine: SearchEngine) => ({
      ...engine,
      icon: cleanIconUrl(engine.icon, r2Domain) ?? '',
    }));
  }

  return cleaned;
};

// 导出站点数据为JSON
export const exportWebsites = (websites: Website[]): ExportData => {
  const cleanedWebsites = cleanR2Urls(websites);
  
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    websites: cleanedWebsites,
  };
};

// 下载导出文件
export const downloadExportFile = (data: ExportData): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${EXPORT_FILE_PREFIX}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 验证单个网站对象
const validateWebsite = (item: unknown): item is Website => {
  if (typeof item !== 'object' || item === null) return false;

  const website = item as Website;
  if (!website.id || typeof website.id !== 'string') return false;
  if (!website.name || typeof website.name !== 'string') return false;

  // 有 children 即为文件夹，递归验证子项（文件夹不需要 url）
  if (website.children !== undefined) {
    if (!Array.isArray(website.children)) return false;
    return website.children.every(validateWebsite);
  }

  // 网站项必须有非空 url
  if (!website.url || typeof website.url !== 'string') return false;
  return true;
};

// 验证导入数据
export const validateImportData = (data: unknown): data is ExportData => {
  if (typeof data !== 'object' || data === null) return false;
  
  const exportData = data as ExportData;

  // 验证网站数组
  if (!exportData.websites || !Array.isArray(exportData.websites)) return false;
  return exportData.websites.every(validateWebsite);
};

// 验证原始网站数组（向后兼容旧格式）
export const validateWebsiteArray = (data: unknown): data is Website[] => {
  if (!Array.isArray(data)) return false;
  return data.every(validateWebsite);
};

// 为导入的网站生成新ID，避免冲突
export const regenerateIds = (websites: Website[]): Website[] => {
  return websites.map(website => {
    const newId = generateId(website.isFolder ? 'folder' : 'site');
    const updated: Website = { ...website, id: newId };
    
    // 递归更新子项ID
    if (updated.isFolder && updated.children) {
      updated.children = regenerateIds(updated.children);
    }
    
    return updated;
  });
};

// 从文件读取导入数据
export const readImportFile = async (file: File): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

// 收集选中的项目（递归）
// - 选中的文件夹：根据 preserveStructure 决定是否传递文件夹名
// - 未选中的文件夹：继续递归查找内部选中项
export const collectSelectedItems = (
  items: Website[],
  selectedIds: Set<string>,
  preserveStructure: boolean,
  parentFolder?: string
): ImportableWebsite[] => {
  const sites: ImportableWebsite[] = [];

  items.forEach(item => {
    const isSelected = selectedIds.has(item.id);

    if (isSelected && !item.isFolder) {
      sites.push(parentFolder ? { ...item, parentFolder } : item);
      return;
    }

    if (item.isFolder && item.children) {
      const nextParent = isSelected && preserveStructure ? item.name : parentFolder;
      sites.push(...collectSelectedItems(item.children, selectedIds, preserveStructure, nextParent));
    }
  });

  return sites;
};

// ===== 全量数据导入/导出 =====
// 包含：搜索引擎、站点及文件夹分组、待办列表、笔记、各设置项
// 不包含：壁纸、图标文件（R2 图标 URL 会被清理为空）

export const FULL_EXPORT_VERSION = '1.0';

export interface FullExportData {
  version: string;
  exportDate: string;
  settings?: Settings;
  websites?: Website[];
  pages?: Page[];
  currentPageId?: string;
  searchEngines?: SearchEngine[];
  todos?: Todo[];
  notes?: Note[];
}

// 导出/导入数据勾选项
export interface DataSelection {
  searchEngines: boolean;
  websites: boolean;
  pages: boolean;
  todos: boolean;
  notes: boolean;
  settings: boolean;
}

// 导出时清理网站：剥离冗余的 isFolder（文件夹与否由 children 决定），
// 文件夹不输出 url，省略空的 icon 字段，使导出格式一致
const cleanWebsitesForExport = (websites: Website[]): Website[] => {
  return websites.map(website => {
    const { isFolder: _omitIsFolder, icon, ...rest } = website;
    const cleaned: Website = rest;
    // 仅当 icon 有实际值时保留，空字符串视为无图标
    if (icon) {
      cleaned.icon = icon;
    }
    if (cleaned.children) {
      // 文件夹不需要 url
      delete (cleaned as { url?: string }).url;
      cleaned.children = cleanWebsitesForExport(cleaned.children);
    }
    return cleaned;
  });
};

// 导入时还原 isFolder：有 children 即为文件夹，url 统一置空（忽略文件中可能存在的 url）
export const restoreIsFolder = (websites: Website[]): Website[] => {
  return websites.map(website => {
    if (Array.isArray(website.children)) {
      return {
        ...website,
        isFolder: true,
        url: '',
        children: restoreIsFolder(website.children),
      };
    }
    return website;
  });
};

// 按 ID 合并两个数组：同 ID 项用导入项替换，新项追加到末尾
export const mergeById = <T extends { id: string }>(
  current: T[] | undefined,
  imported: T[],
): T[] => {
  const map = new Map<string, T>();
  (current ?? []).forEach(item => map.set(item.id, item));
  imported.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
};

// 构建全量导出数据：从 UserData 中提取需要导出的字段，清理 R2 图标 URL，排除壁纸，剥离冗余字段
// 根据 selection 决定哪些分类需要导出，未勾选的分类不会出现在导出文件中
export const buildFullExportData = (data: UserData, selection: DataSelection): FullExportData => {
  const cleaned = cleanUserDataR2Urls(data);
  const result: FullExportData = {
    version: FULL_EXPORT_VERSION,
    exportDate: new Date().toISOString(),
  };
  if (selection.pages && cleaned.pages) {
    result.pages = cleaned.pages.map((page: Page) => ({
      ...page,
      websites: cleanWebsitesForExport(page.websites),
    }));
    if (cleaned.currentPageId) {
      result.currentPageId = cleaned.currentPageId;
    }
  }
  if (selection.websites) {
    // 若导出了 pages 就不再重复导出根级 websites（向后兼容用）
    if (!selection.pages) {
      result.websites = cleanWebsitesForExport(cleaned.websites ?? []);
    }
  }
  if (selection.searchEngines) {
    result.searchEngines = cleaned.searchEngines ?? [];
  }
  if (selection.todos) {
    result.todos = cleaned.todos ?? cleaned.todoList ?? [];
  }
  if (selection.notes) {
    result.notes = cleaned.notes ?? [];
  }
  if (selection.settings && cleaned.settings) {
    result.settings = cleaned.settings;
  }
  return result;
};

// 下载全量导出文件（支持自定义文件名）
export const downloadFullExportFile = (data: FullExportData, filename: string): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 校验搜索引擎对象
const validateSearchEngine = (item: unknown): item is SearchEngine => {
  if (typeof item !== 'object' || item === null) return false;
  const engine = item as SearchEngine;
  return (
    typeof engine.id === 'string' &&
    typeof engine.name === 'string' &&
    typeof engine.url === 'string'
  );
};

// 校验待办对象
const validateTodo = (item: unknown): item is Todo => {
  if (typeof item !== 'object' || item === null) return false;
  const todo = item as Todo;
  return (
    typeof todo.id === 'string' &&
    typeof todo.text === 'string' &&
    typeof todo.completed === 'boolean'
  );
};

// 校验笔记对象
const validateNote = (item: unknown): item is Note => {
  if (typeof item !== 'object' || item === null) return false;
  const note = item as Note;
  return (
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.content === 'string'
  );
};

// 校验 Page 对象
const validatePage = (item: unknown): item is Page => {
  if (typeof item !== 'object' || item === null) return false;
  const page = item as Page;
  return (
    typeof page.id === 'string' &&
    typeof page.name === 'string' &&
    Array.isArray(page.websites) &&
    page.websites.every(validateWebsite)
  );
};

// 校验全量导入数据（字段可选，至少存在一个数据字段）
export const validateFullImportData = (data: unknown): data is FullExportData => {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as FullExportData;

  if (d.websites !== undefined && (!Array.isArray(d.websites) || !d.websites.every(validateWebsite))) return false;
  if (d.pages !== undefined && (!Array.isArray(d.pages) || !d.pages.every(validatePage))) return false;
  if (d.currentPageId !== undefined && typeof d.currentPageId !== 'string') return false;
  if (d.searchEngines !== undefined && (!Array.isArray(d.searchEngines) || !d.searchEngines.every(validateSearchEngine))) return false;
  if (d.todos !== undefined && (!Array.isArray(d.todos) || !d.todos.every(validateTodo))) return false;
  if (d.notes !== undefined && (!Array.isArray(d.notes) || !d.notes.every(validateNote))) return false;
  if (d.settings !== undefined && (typeof d.settings !== 'object' || d.settings === null)) return false;

  // 至少要有一个数据字段
  const hasAnyData = d.websites !== undefined || d.pages !== undefined || d.searchEngines !== undefined ||
    d.todos !== undefined || d.notes !== undefined || d.settings !== undefined;
  if (!hasAnyData) return false;

  return true;
};