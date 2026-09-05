export { TRACKED_KEYS, isTrackedKey } from '../shared/constants';

// 本地存储键名常量
export const STORAGE_PREFIX = 'harborpage_';

export const STORAGE_KEYS = {
  DATA: `${STORAGE_PREFIX}data`,
  TOKEN: `${STORAGE_PREFIX}token`,
  CONFIG: `${STORAGE_PREFIX}config`,
  UNSAVED_CHANGES: `${STORAGE_PREFIX}unsaved_changes`,
  DEFAULT_SEARCH_ENGINE_ID: `${STORAGE_PREFIX}defaultSearchEngineId`,
  AUTO_SAVE_DURATION: `${STORAGE_PREFIX}autoSaveDuration`,
  AUTO_SAVE_ENABLED: `${STORAGE_PREFIX}autoSaveEnabled`,
  LIGHTNESS_PREVIEW_ENABLED: `${STORAGE_PREFIX}lightnessPreviewEnabled`,
};

// 导出文件名前缀
export const EXPORT_FILE_PREFIX = 'harborpage_export';
