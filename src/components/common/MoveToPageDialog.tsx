import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { usePagesStore } from '../../store/usePagesStore';
import './MoveToPageDialog.css';

interface MoveToPageDialogProps {
  isOpen: boolean;
  fromPageId: string;
  iconIds: string[];
  onClose: () => void;
}

const MoveToPageDialog: React.FC<MoveToPageDialogProps> = ({
  isOpen,
  fromPageId,
  iconIds,
  onClose,
}) => {
  const { t } = useTranslation('pages');
  const { pages, moveWebsites, setCurrentPageId } = usePagesStore(
    useShallow((s) => ({
      pages: s.pages,
      moveWebsites: s.moveWebsites,
      setCurrentPageId: s.setCurrentPageId,
    })),
  );

  const targetPages = useMemo(() => {
    return pages.filter(p => p.id !== fromPageId);
  }, [pages, fromPageId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectTarget = (toPageId: string, autoJump: boolean) => {
    moveWebsites(fromPageId, toPageId, iconIds);
    if (autoJump) setCurrentPageId(toPageId);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // useClickOutside 通常基于 mousedown 触发。FolderWindow 打开时 MoveDialog 叠加在其上层，
  // 这里阻断 mousedown 冒泡，避免 FolderWindow 的 useClickOutside 把它判断为"外部点击"而误关文件夹。
  // 这是保险层；App.tsx 同时会在 moveDialog 打开时禁用 FolderWindow 的 useClickOutside。
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="move-to-page-dialog-overlay"
      onClick={handleOverlayClick}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="move-to-page-dialog"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="move-to-page-title">{t('moveToPage.title')}</h3>
        <p className="move-to-page-subtitle">
          {t('moveToPage.subtitle', { selected: iconIds.length })}
        </p>

        {targetPages.length === 0 ? (
          <div className="move-to-page-empty">
            {t('moveToPage.empty')}
          </div>
        ) : (
          <ul className="move-to-page-list">
            {targetPages.map((page) => (
              <li key={page.id} className="move-to-page-item-wrapper">
                <button
                  className="move-to-page-item"
                  onClick={() => handleSelectTarget(page.id, false)}
                >
                  <div className="move-to-page-item-info">
                    <span className="move-to-page-item-dot" />
                    <span className="move-to-page-item-name">{page.name}</span>
                  </div>
                  <span className="move-to-page-item-count">
                    {t('moveToPage.itemCount', { total: page.websites.length })}
                  </span>
                </button>
                <button
                  className="move-to-page-item-jump"
                  title={t('moveToPage.moveAndJump')}
                  onClick={() => handleSelectTarget(page.id, true)}
                >
                  {t('moveToPage.moveAndJump')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="move-to-page-footer">
          <button
            type="button"
            className="move-to-page-cancel"
            onClick={onClose}
          >
            {t('moveToPage.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveToPageDialog;
