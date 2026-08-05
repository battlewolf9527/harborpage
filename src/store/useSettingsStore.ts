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

  setSiteTitle: (title: string) => void;
  setIconColumns: (columns: number) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setAutoSaveDuration: (duration: number) => void;
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

const initialState: Omit<SettingsState, 'setSiteTitle' | 'setIconColumns' | 'setAutoSaveEnabled' | 'setAutoSaveDuration' | 'initialize'> = {
  siteTitle: '我的导航',
  iconColumns: 5,
  autoSaveEnabled: DEFAULT_AUTO_SAVE_ENABLED,
  autoSaveDuration: DEFAULT_AUTO_SAVE_DURATION,
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

  initialize: (settings) => {
    const saved = readAutoSaveFromStorage();
    if (settings) {
      set({
        siteTitle: settings.siteTitle || '我的导航',
        iconColumns: settings.iconColumns ?? 5,
        autoSaveEnabled: settings.autoSaveEnabled ?? saved.enabled,
        autoSaveDuration: settings.autoSaveDuration ?? saved.duration,
      });
    } else {
      // 没有传入 settings 时，使用从 localStorage 读取的值
      set({
        autoSaveEnabled: saved.enabled,
        autoSaveDuration: saved.duration,
      });
    }
  },
}));

setupAutoPersist(useSettingsStore, [
  { key: 'siteTitle', persist: (v) => getServices().dataManager.updateSiteTitle(v as string) },
  { key: 'iconColumns', persist: (v) => getServices().dataManager.updateIconColumns(v as number) },
  { key: 'autoSaveEnabled', persist: (v) => getServices().dataManager.updateAutoSaveEnabled(v as boolean) },
  { key: 'autoSaveDuration', persist: (v) => getServices().dataManager.updateAutoSaveDuration(v as number) },
]);