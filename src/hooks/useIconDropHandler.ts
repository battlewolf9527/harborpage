import { useCallback } from 'react';
import type { Website } from '../types';
import { useIconsStore } from '../store/useIconsStore';
import { useIconsUIStore } from '../store/useIconsUIStore';

export function useIconDropHandler(
  websites: Website[],
  onIconsChange: (icons: Website[]) => void
) {
  const setPendingFolderCreation = useIconsStore((s) => s.setPendingFolderCreation);
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
      // 暂存两个图标 ID，待用户在对话框中输入名称后由 createFolder 读取。
      // 不能依赖 store.draggedIcon，因为它会被 dragend 事件清空。
      setPendingFolderCreation({
        draggedIconId: draggedIcon.id,
        targetIconId,
      });
      setShowFolderNameDialog(true);
      return true;
    }

    return false;
  }, [websites, onIconsChange, setPendingFolderCreation, setShowFolderNameDialog]);

  return handleDrop;
}
