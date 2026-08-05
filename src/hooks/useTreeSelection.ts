import { useState, useCallback, useMemo } from 'react';
import type { Website } from '../types';

function collectAllIdsHelper(items: Website[]): Set<string> {
  const allIds = new Set<string>();
  const collect = (list: Website[]) => {
    list.forEach(item => {
      allIds.add(item.id);
      if (item.children) {
        collect(item.children);
      }
    });
  };
  collect(items);
  return allIds;
}

export function useTreeSelection(data: Website[], initiallySelected = false) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    initiallySelected ? collectAllIdsHelper(data) : new Set()
  );

  const recalculateFolderStates = useCallback((items: Website[], newSelected: Set<string>): void => {
    const postOrder = (item: Website) => {
      if (item.isFolder && item.children) {
        item.children.forEach(postOrder);
        const hasSelectedChild = item.children.some(child => newSelected.has(child.id));
        if (hasSelectedChild) {
          newSelected.add(item.id);
        } else {
          newSelected.delete(item.id);
        }
      }
    };
    items.forEach(postOrder);
  }, []);

  const collectAllIds = useCallback((items: Website[]): Set<string> => {
    return collectAllIdsHelper(items);
  }, []);

  const getAllItemCount = useCallback((): number => {
    let count = 0;
    const countItems = (items: Website[]) => {
      items.forEach(item => {
        count++;
        if (item.children) {
          countItems(item.children);
        }
      });
    };
    countItems(data);
    return count;
  }, [data]);

  const toggleItem = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      recalculateFolderStates(data, newSelected);
      return newSelected;
    });
  }, [data, recalculateFolderStates]);

  const toggleAll = useCallback(() => {
    const total = getAllItemCount();
    setSelectedItems(prev => {
      if (prev.size === total) {
        return new Set();
      }
      return collectAllIds(data);
    });
  }, [collectAllIds, data, getAllItemCount]);

  const isFolderPartiallySelected = useCallback((folder: Website): boolean => {
    if (!folder.children || folder.children.length === 0) return false;
    const selectedChildren = folder.children.filter(child => selectedItems.has(child.id));
    return selectedChildren.length > 0 && selectedChildren.length < folder.children.length;
  }, [selectedItems]);

  const toggleFolder = useCallback((folder: Website) => {
    setSelectedItems(prev => {
      const newSelected = new Set(prev);
      if (prev.has(folder.id)) {
        newSelected.delete(folder.id);
        const removeIds = (items: Website[]) => {
          items.forEach(item => {
            newSelected.delete(item.id);
            if (item.children) {
              removeIds(item.children);
            }
          });
        };
        removeIds(folder.children || []);
      } else {
        newSelected.add(folder.id);
        const addIds = (items: Website[]) => {
          items.forEach(item => {
            newSelected.add(item.id);
            if (item.children) {
              addIds(item.children);
            }
          });
        };
        addIds(folder.children || []);
      }
      return newSelected;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(collectAllIds(data));
  }, [collectAllIds, data]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const resetSelection = useCallback((items?: Website[]) => {
    if (items) {
      setSelectedItems(collectAllIds(items));
    } else {
      setSelectedItems(new Set());
    }
  }, [collectAllIds]);

  return useMemo(() => ({
    selectedItems,
    toggleItem,
    toggleAll,
    toggleFolder,
    isFolderPartiallySelected,
    getAllItemCount,
    selectAll,
    clearSelection,
    resetSelection,
  }), [
    selectedItems,
    toggleItem,
    toggleAll,
    toggleFolder,
    isFolderPartiallySelected,
    getAllItemCount,
    selectAll,
    clearSelection,
    resetSelection,
  ]);
}