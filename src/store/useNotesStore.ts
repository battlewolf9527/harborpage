import { create } from 'zustand';
import type { Note } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';

type NotesUpdater = Note[] | ((prev: Note[]) => Note[]);

interface NotesState {
  notes: Note[];

  setNotes: (notes: NotesUpdater) => void;
  initialize: (notes?: Note[]) => void;
}

const initialState: Omit<NotesState, 'setNotes' | 'initialize'> = {
  notes: [],
};

export const useNotesStore = create<NotesState>((set) => ({
  ...initialState,

  setNotes: (notes) => {
    set((state) => ({
      notes: typeof notes === 'function' ? notes(state.notes) : notes,
    }));
  },

  initialize: (notes) => {
    set({
      notes: notes ?? initialState.notes,
    });
  },
}));

setupAutoPersist(useNotesStore, [
  { key: 'notes', persist: (v) => getServices().dataManager.updateNotes(v as Note[]) },
]);