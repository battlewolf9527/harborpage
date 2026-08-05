import { create } from 'zustand';
import type { UserData } from '../types';

export interface ImportTask {
  data: UserData;
  mode: 'overwrite' | 'merge';
}

interface ImportState {
  isImporting: boolean;
  importProgress: number;
  importMessage: string;
  importTask: ImportTask | null;

  setIsImporting: (importing: boolean) => void;
  setImportProgress: (progress: number) => void;
  setImportMessage: (message: string) => void;
  startImport: (task: ImportTask) => void;
  finishImport: () => void;
  resetImport: () => void;
}

export const useImportStore = create<ImportState>((set) => ({
  isImporting: false,
  importProgress: 0,
  importMessage: '',
  importTask: null,

  setIsImporting: (importing) => set({ isImporting: importing }),
  setImportProgress: (progress) => set({ importProgress: progress }),
  setImportMessage: (message) => set({ importMessage: message }),
  startImport: (task) => set({
    importTask: task,
    isImporting: true,
    importProgress: 0,
    importMessage: '准备导入...',
  }),
  finishImport: () => set({
    importTask: null,
    isImporting: false,
  }),
  resetImport: () => set({
    isImporting: false,
    importProgress: 0,
    importMessage: '',
    importTask: null,
  }),
}));
