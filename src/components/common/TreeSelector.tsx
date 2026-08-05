import React from 'react';
import type { Website } from '../../types';
import type { useTreeSelection } from '../../hooks/useTreeSelection';

type TreeSelection = ReturnType<typeof useTreeSelection>;

interface TreeSelectorProps {
  data: Website[];
  selection: TreeSelection;
}

interface TreeItemProps {
  item: Website;
  depth: number;
  selection: TreeSelection;
}

const TreeItem: React.FC<TreeItemProps> = React.memo(({ item, depth, selection }) => {
  const {
    selectedItems,
    toggleItem,
    toggleFolder,
    isFolderPartiallySelected,
  } = selection;

  return (
    <div className="tree-item">
      <div
        className={`tree-row ${item.isFolder ? 'folder' : 'site'}`}
        style={{ paddingLeft: `${depth * 20}px` }}
        onClick={() => item.isFolder ? toggleFolder(item) : toggleItem(item.id)}
      >
        <div className="checkbox-wrapper">
          {item.isFolder && isFolderPartiallySelected(item) ? (
            <div className="checkbox partial">
              <span className="checkmark">−</span>
            </div>
          ) : (
            <div className={`checkbox ${selectedItems.has(item.id) ? 'checked' : ''}`}>
              <span className="checkmark">{selectedItems.has(item.id) ? '✓' : ''}</span>
            </div>
          )}
        </div>
        <span className="item-icon">{item.isFolder ? '📁' : '🌐'}</span>
        <span className="item-name">{item.name}</span>
      </div>
      {item.isFolder && item.children && (
        <div className="tree-children">
          {item.children.map(child => (
            <TreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selection={selection}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const TreeSelector: React.FC<TreeSelectorProps> = ({ data, selection }) => {
  return (
    <div className="tree-container">
      {data.map(item => (
        <TreeItem
          key={item.id}
          item={item}
          depth={0}
          selection={selection}
        />
      ))}
    </div>
  );
};

export default TreeSelector;
