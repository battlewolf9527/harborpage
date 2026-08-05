import { create } from 'zustand';
import type { SearchEngine } from '../types';
import { STORAGE_KEYS } from '../constants';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import DataRepository from '../services/DataRepository';

interface SearchState {
  searchEngines: SearchEngine[];
  defaultSearchEngineId: string;

  setSearchEngines: (engines: SearchEngine[]) => void;
  setDefaultSearchEngineId: (engineId: string) => void;
  initialize: (searchEngines?: SearchEngine[], defaultEngineId?: string) => void;
}

const initialState: Omit<SearchState, 'setSearchEngines' | 'setDefaultSearchEngineId' | 'initialize'> = {
  searchEngines: [
    { id: '1', name: 'Google', url: 'https://www.google.com/search?q={q}', icon: '' },
    { id: '2', name: '百度', url: 'https://www.baidu.com/s?wd={q}', icon: '' },
    { id: '3', name: '必应', url: 'https://www.bing.com/search?q={q}', icon: '' },
  ],
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
      searchEngines: searchEngines ?? initialState.searchEngines,
      defaultSearchEngineId: localDefaultSearchEngineId ?? defaultEngineId ?? initialState.defaultSearchEngineId,
    });
  },
}));

const getDM = () => getServices().dataManager;

setupAutoPersist(useSearchStore, [
  { key: 'searchEngines', persist: (v) => getDM().updateSearchEngines(v as SearchEngine[]) },
  { key: 'defaultSearchEngineId', persist: (v) => getDM().updateDefaultSearchEngineId(v as string) },
]);