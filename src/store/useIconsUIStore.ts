import { create } from 'zustand';
import type { Website } from '../types';

interface IconsUIState {
  showAddIcon: boolean;
  showEditIcon: boolean;
  editingIcon: Website | null;
  showConfirmDialog: boolean;
  iconToDelete: string | null;
  showFolderNameDialog: boolean;
  showSettings: boolean;
  isEditMode: boolean;

  setShowAddIcon: (show: boolean) => void;
  setShowEditIcon: (show: boolean) => void;
  setEditingIcon: (icon: Website | null) => void;
  setShowConfirmDialog: (show: boolean) => void;
  setIconToDelete: (id: string | null) => void;
  setShowFolderNameDialog: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setIsEditMode: (mode: boolean) => void;

  resetDialogs: () => void;
}

const initialUIState = {
  showAddIcon: false,
  showEditIcon: false,
  editingIcon: null,
  showConfirmDialog: false,
  iconToDelete: null,
  showFolderNameDialog: false,
  showSettings: false,
  isEditMode: false,
};

export const useIconsUIStore = create<IconsUIState>((set) => ({
  ...initialUIState,

  setShowAddIcon: (show) => set({ showAddIcon: show }),
  setShowEditIcon: (show) => set({ showEditIcon: show }),
  setEditingIcon: (icon) => set({ editingIcon: icon }),
  setShowConfirmDialog: (show) => set({ showConfirmDialog: show }),
  setIconToDelete: (id) => set({ iconToDelete: id }),
  setShowFolderNameDialog: (show) => set({ showFolderNameDialog: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  setIsEditMode: (mode) => set({ isEditMode: mode }),

  resetDialogs: () => set({
    showAddIcon: false,
    showEditIcon: false,
    editingIcon: null,
    showConfirmDialog: false,
    iconToDelete: null,
    showFolderNameDialog: false,
  }),
}));