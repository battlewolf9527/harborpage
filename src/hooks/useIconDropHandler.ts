import { useCallback } from 'react';
import type { Website } from '../types';
import { useIconsStore } from '../store/useIconsStore';
import { useIconsUIStore } from '../store/useIconsUIStore';

export function useIconDropHandler(
  websites: Website[],
  onIconsChange: (icons: Website[]) => void
) {
  const setDraggedIcon = useIconsStore((s) => s.setDraggedIcon);
  const setTargetIconId = useIconsStore((s) => s.setTargetIconId);
  const setShowFolderNameDialog = useIconsUIStore((s) => s.setShowFolderNameDialog);

  const handleDrop = useCallback((
    _e: React.DragEvent,
    targetIconId: string,
    draggedIcon: Website,
    targetIcon: Website,
    position: string | null
  ): boolean => {
    if (position !== 'center') return false;

    if (targetIcon.isFolder && !draggedIcon.isFolder) {
      const newIcons = websites.map(icon => {
        if (icon.id === targetIconId) {
          return {
            ...icon,
            children: [...(icon.children || []), draggedIcon]
          };
        }
        if (icon.id === draggedIcon.id) {
          return null;
        }
        return icon;
      }).filter((icon): icon is Website => icon !== null);

      onIconsChange(newIcons);
      return true;
    }

    if (!targetIcon.isFolder && !draggedIcon.isFolder) {
      setTargetIconId(targetIconId);
      setDraggedIcon(draggedIcon);
      setShowFolderNameDialog(true);
      return true;
    }

    return false;
  }, [websites, onIconsChange, setDraggedIcon, setTargetIconId, setShowFolderNameDialog]);

  return handleDrop;
}
