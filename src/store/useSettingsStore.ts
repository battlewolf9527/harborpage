import { create } from 'zustand';
import type { Settings } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { STORAGE_KEYS } from '../constants';
import DataRepository from '../services/DataRepository';

const DEFAULT_AUTO_SAVE_DURATION = 60;
const DEFAULT_AUTO_SAVE_ENABLED = true;

interface SettingsState {
  siteTitle: string;
  iconColumns: number;
  autoSaveEnabled: boolean;
  autoSaveDuration: number;
  notesEnabled: boolean;
  todosEnabled: boolean;
  pagesEnabled: boolean;
  weatherEnabled: boolean;
  searchEnabled: boolean;
  /** 是否已完成设置初始化；防止功能入口在账号设置（异步加载）完成前按默认值挂载，
   *  避免天气关闭时仍触发定位/天气请求 */
  settingsReady: boolean;

  setSiteTitle: (title: string) => void;
  setIconColumns: (columns: number) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveDuration: (duration: number) => void;
  setNotesEnabled: (enabled: boolean) => void;
  setTodosEnabled: (enabled: boolean) => void;
  setPagesEnabled: (enabled: boolean) => void;
  setWeatherEnabled: (enabled: boolean) => void;
  setSearchEnabled: (enabled: boolean) => void;
  initialize: (settings?: Settings) => void;
}

const readAutoSaveFromStorage = (): { enabled: boolean; duration: number } => {
  try {
    const savedDuration = DataRepository.loadConfigValue(STORAGE_KEYS.AUTO_SAVE_DURATION);
    const savedEnabled = DataRepository.loadConfigValue(STORAGE_KEYS.AUTO_SAVE_ENABLED);
    return {
      duration: savedDuration !== null ? parseInt(savedDuration) : DEFAULT_AUTO_SAVE_DURATION,
      enabled: savedEnabled !== null ? JSON.parse(savedEnabled) : DEFAULT_AUTO_SAVE_ENABLED,
    };
  } catch {
    return {
      duration: DEFAULT_AUTO_SAVE_DURATION,
      enabled: DEFAULT_AUTO_SAVE_ENABLED,
    };
  }
};

const initialState: Omit<SettingsState, 'setSiteTitle' | 'setIconColumns' | 'setAutoSaveEnabled' | 'setAutoSaveDuration' | 'setNotesEnabled' | 'setTodosEnabled' | 'setPagesEnabled' | 'setWeatherEnabled' | 'setSearchEnabled' | 'initialize'> = {
  siteTitle: '我的导航',
  iconColumns: 5,
  autoSaveEnabled: DEFAULT_AUTO_SAVE_ENABLED,
  autoSaveDuration: DEFAULT_AUTO_SAVE_DURATION,
  notesEnabled: true,
  todosEnabled: true,
  pagesEnabled: true,
  weatherEnabled: true,
  searchEnabled: true,
  settingsReady: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialState,

  setSiteTitle: (siteTitle) => {
    set({ siteTitle });
  },

  setIconColumns: (iconColumns) => {
    set({ iconColumns });
  },

  setAutoSaveEnabled: (autoSaveEnabled) => {
    set({ autoSaveEnabled });
  },

  setAutoSaveDuration: (autoSaveDuration) => {
    set({ autoSaveDuration });
  },

  setNotesEnabled: (notesEnabled) => {
    set({ notesEnabled });
  },

  setTodosEnabled: (todosEnabled) => {
    set({ todosEnabled });
  },

  setPagesEnabled: (pagesEnabled) => {
    set({ pagesEnabled });
  },

  setWeatherEnabled: (weatherEnabled) => {
    set({ weatherEnabled });
  },

  setSearchEnabled: (searchEnabled) => {
    set({ searchEnabled });
  },

  initialize: (settings) => {
    const saved = readAutoSaveFromStorage();
    if (settings) {
      set({
        siteTitle: settings.siteTitle || '我的导航',
        iconColumns: settings.iconColumns ?? 5,
        autoSaveEnabled: settings.autoSaveEnabled ?? saved.enabled,
        autoSaveDuration: settings.autoSaveDuration ?? saved.duration,
        notesEnabled: settings.notesEnabled ?? true,
        todosEnabled: settings.todosEnabled ?? true,
        pagesEnabled: settings.pagesEnabled ?? true,
        weatherEnabled: settings.weatherEnabled ?? true,
        searchEnabled: settings.searchEnabled ?? true,
        settingsReady: true,
      });
    } else {
      // 没有传入 settings 时，使用从 localStorage 读取的值
      set({
        autoSaveEnabled: saved.enabled,
        autoSaveDuration: saved.duration,
        settingsReady: true,
      });
    }
  },
}));

setupAutoPersist(useSettingsStore, [
  { key: 'siteTitle', persist: (v) => getServices().dataManager.updateSiteTitle(v as string) },
  { key: 'iconColumns', persist: (v) => getServices().dataManager.updateIconColumns(v as number) },
  { key: 'autoSaveEnabled', persist: (v) => getServices().dataManager.updateAutoSaveEnabled(v as boolean) },
  { key: 'autoSaveDuration', persist: (v) => getServices().dataManager.updateAutoSaveDuration(v as number) },
  { key: 'weatherEnabled', persist: (v) => getServices().dataManager.updateWeatherEnabled(v as boolean) },
  { key: 'searchEnabled', persist: (v) => getServices().dataManager.updateSearchEnabled(v as boolean) },
  { key: 'notesEnabled', persist: (v) => getServices().dataManager.updateNotesEnabled(v as boolean) },
  { key: 'todosEnabled', persist: (v) => getServices().dataManager.updateTodosEnabled(v as boolean) },
  { key: 'pagesEnabled', persist: (v) => getServices().dataManager.updatePagesEnabled(v as boolean) },
]);