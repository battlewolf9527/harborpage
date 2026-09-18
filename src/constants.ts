export {
  TRACKED_KEYS,
  isTrackedKey,
  NOTES_INDEX_KEY,
  NOTE_KEY_PREFIX,
  noteContentKey,
  NOTE_ID_RE,
  NOTE_PREVIEW_LIMIT,
  buildNotePreview,
} from '../shared/constants';
export { API_ERROR_CODES, isApiErrorCode, ICON_SOURCE_CODES, isIconSourceCode } from '../shared/apiErrors';
export type { ApiErrorCode, IconSourceCode } from '../shared/apiErrors';

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
  /** 本浏览器最后一次应用的配色方案 id（本机 UI 偏好，不入云；用于下拉框的选中项识别） */
  ACTIVE_SCHEME_ID: `${STORAGE_PREFIX}activeSchemeId`,
  /** 本浏览器是否已确认笔记分片存储格式（确认后才允许从本地镜像剥离正文） */
  NOTES_SHARDED: `${STORAGE_PREFIX}notesSharded`,
  /** 本浏览器确认已存在于云端索引的笔记 id（启动对账用，避免误删从未上云的本地新笔记） */
  NOTES_SYNCED: `${STORAGE_PREFIX}notesSynced`,
};

// 导出文件名前缀
export const EXPORT_FILE_PREFIX = 'harborpage_export';
