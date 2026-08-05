import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useIconsStore } from '../store/useIconsStore';
import { useIconsUIStore } from '../store/useIconsUIStore';

export function useDeleteIcon() {
  const {
    showConfirmDialog,
    iconToDelete,
    setShowConfirmDialog,
    setIconToDelete,
  } = useIconsUIStore(
    useShallow((s) => ({
      showConfirmDialog: s.showConfirmDialog,
      iconToDelete: s.iconToDelete,
      setShowConfirmDialog: s.setShowConfirmDialog,
      setIconToDelete: s.setIconToDelete,
    })),
  );

  const { deleteIcon } = useIconsStore(
    useShallow((s) => ({ deleteIcon: s.deleteIcon })),
  );

  const handleDeleteIcon = useCallback((iconId: string) => {
    setIconToDelete(iconId);
    setShowConfirmDialog(true);
  }, [setIconToDelete, setShowConfirmDialog]);

  const confirmDeleteIcon = useCallback(() => {
    if (iconToDelete) {
      deleteIcon(iconToDelete);
      setShowConfirmDialog(false);
      setIconToDelete(null);
    }
  }, [iconToDelete, deleteIcon, setShowConfirmDialog, setIconToDelete]);

  const cancelDeleteIcon = useCallback(() => {
    setShowConfirmDialog(false);
    setIconToDelete(null);
  }, [setShowConfirmDialog, setIconToDelete]);

  return {
    showConfirmDialog,
    handleDeleteIcon,
    confirmDeleteIcon,
    cancelDeleteIcon,
  };
}
