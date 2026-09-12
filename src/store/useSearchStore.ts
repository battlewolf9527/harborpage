import { create } from 'zustand';
import type { SearchEngine } from '../types';
import { STORAGE_KEYS } from '../constants';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import DataRepository from '../services/DataRepository';
import i18n from '../i18n';

interface SearchState {
  searchEngines: SearchEngine[];
  defaultSearchEngineId: string;

  setSearchEngines: (engines: SearchEngine[]) => void;
  setDefaultSearchEngineId: (engineId: string) => void;
  initialize: (searchEngines?: SearchEngine[], defaultEngineId?: string) => void;
}

/**
 * 默认搜索引擎：名称按当前界面语言生成（Google 各语言同名，百度/必应取本地化名称）。
 * 仅在无持久化数据时作为初始值使用；已持久化的旧数据视作用户自定义，不做改写。
 */
const createDefaultSearchEngines = (): SearchEngine[] => [
  { id: '1', name: 'Google', url: 'https://www.google.com/search?q={q}', icon: '' },
  { id: '2', name: i18n.t('search:defaultEngines.baidu'), url: 'https://www.baidu.com/s?wd={q}', icon: '' },
  { id: '3', name: i18n.t('search:defaultEngines.bing'), url: 'https://www.bing.com/search?q={q}', icon: '' },
];

const initialState: Omit<SearchState, 'setSearchEngines' | 'setDefaultSearchEngineId' | 'initialize'> = {
  searchEngines: createDefaultSearchEngines(),
  defaultSearchEngineId: '1',
};

export const useSearchStore = create<SearchState>((set) => ({
  ...initialState,

  setSearchEngines: (searchEngines) => {
    set({ searchEngines });
  },

  setDefaultSearchEngineId: (defaultSearchEngineId) => {
    set({ defaultSearchEngineId });
  },

  initialize: (searchEngines, defaultEngineId) => {
    const localDefaultSearchEngineId = DataRepository.loadConfigValue(STORAGE_KEYS.DEFAULT_SEARCH_ENGINE_ID);

    set({
      searchEngines: searchEngines ?? createDefaultSearchEngines(),
      defaultSearchEngineId: localDefaultSearchEngineId ?? defaultEngineId ?? initialState.defaultSearchEngineId,
    });
  },
}));

const getDM = () => getServices().dataManager;

setupAutoPersist(useSearchStore, [
  { key: 'searchEngines', persist: (v) => getDM().updateSearchEngines(v as SearchEngine[]) },
  { key: 'defaultSearchEngineId', persist: (v) => getDM().updateDefaultSearchEngineId(v as string) },
]);