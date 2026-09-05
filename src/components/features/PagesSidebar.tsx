import React, { useState, useRef, useEffect, useCallback } from 'react';
import './PagesSidebar.css';
import ConfirmDialog from '../common/ConfirmDialog';
import { usePagesSelector } from '../../store/selectors';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useFeatureDockStore } from '../../store/useFeatureDockStore';
import { useFeatureEntry } from '../../hooks/useFeatureEntry';
import type { Page } from '../../types';

/** 多页面身份色（入口球与面板共享的品牌色） */
const PAGES_TINT = '#10b981';
const PAGES_TINT2 = '#f59e0b';

/** 多页面入口球图形（宿主决定入口内容） */
const pagesGlyph = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

interface EditingState {
  pageId: string;
  name: string;
}

const PagesSidebar: React.FC = () => {
  // 面板开合：单一事实源在主界面 Dock（入口球与宿主共享）
  const isOpen = useFeatureDockStore((s) => !!s.open.pages);
  const setDockOpen = useFeatureDockStore((s) => s.setOpen);

  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom'>('bottom');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocusedPageIdRef = useRef<string | null>(null);

  // 按需挂载：open → 挂载并展开（滑入）；close → 先播退场动画再卸载
  const [present, setPresent] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const {
    pages,
    currentPageId,
    currentPage,
    setCurrentPageId,
    addPage,
    renamePage,
    deletePage,
    reorderPages,
  } = usePagesSelector();

  // —— 面板在场与展开态：完全由宿主 open 状态驱动。
  //    所有 setState 都只发生在「定时器回调」（异步）里，effect 本体只负责
  //    调度与清理 —— 规避 render 期 setState 在 React 并发/外部 store 触发
  //    的渲染中被丢弃的问题（表现为“open 已置位但面板从未驻留”）。
  useEffect(() => {
    // 打开：先挂载（收起态），供下方 effect 补 expanded 走滑入渐显节奏
    if (!isOpen) return;
    const mountTimer = window.setTimeout(() => setPresent(true), 0);
    return () => window.clearTimeout(mountTimer);
  }, [isOpen]);

  // 展开：面板在场后再延迟一帧补 expanded
  useEffect(() => {
    if (!isOpen || !present) return;
    const expandTimer = window.setTimeout(() => setExpanded(true), 30);
    return () => window.clearTimeout(expandTimer);
  }, [isOpen, present]);

  // 关闭：先收起开始退场，330ms 后真正卸载；同时清理编辑/删除确认等瞬态，
  // 避免面板卸载后残留孤儿状态。
  useEffect(() => {
    if (isOpen || !present) return;
    const collapseTimer = window.setTimeout(() => {
      setExpanded(false);
      setEditing(null);
      setPendingDelete(null);
    }, 0);
    const exitTimer = window.setTimeout(() => setPresent(false), 330);
    return () => {
      window.clearTimeout(collapseTimer);
      window.clearTimeout(exitTimer);
    };
  }, [isOpen, present]);

  useClickOutside(sidebarRef, {
    handler: () => {
      if (isOpen) {
        setDockOpen('pages', false);
      }
    },
    enabled: isOpen && present,
  });

  // 编辑时自动聚焦输入框（仅在进入/切换编辑目标时聚焦+全选，避免每次改字都全选）
  const editingPageId = editing?.pageId ?? null;
  useEffect(() => {
    if (editingPageId !== lastFocusedPageIdRef.current) {
      if (editingPageId !== null && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      lastFocusedPageIdRef.current = editingPageId;
    }
  }, [editingPageId]);

  const handlePageClick = useCallback((pageId: string) => {
    if (pageId !== currentPageId) {
      setCurrentPageId(pageId);
    }
  }, [currentPageId, setCurrentPageId]);

  const handleAddPage = useCallback(() => {
    addPage('');
  }, [addPage]);

  const handleStartRename = useCallback((e: React.MouseEvent, page: Page) => {
    e.stopPropagation();
    setEditing({ pageId: page.id, name: page.name });
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (editing && editing.name.trim()) {
      renamePage(editing.pageId, editing.name.trim());
    }
    setEditing(null);
  }, [editing, renamePage]);

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  }, [handleRenameSubmit]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, page: Page) => {
    e.stopPropagation();
    setPendingDelete(page);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (pendingDelete) {
      deletePage(pendingDelete.id);
      setPendingDelete(null);
    }
  }, [pendingDelete, deletePage]);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  // ── 拖拽排序 ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (editing || pendingDelete) {
      e.preventDefault();
      return;
    }
    setDragIndex(index);
    setDragOverIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', String(index));
    } catch { /* noop */ }
  }, [editing, pendingDelete]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (dragIndex === null) return;
    if (dragIndex === index) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position: 'top' | 'bottom' = e.clientY < midY ? 'top' : 'bottom';

    setDragOverIndex(index);
    setDragOverPosition(position);
  }, [dragIndex]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    const related = e.relatedTarget;
    if (related instanceof Node && e.currentTarget.contains(related)) return;
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  }, [dragOverIndex]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (dragIndex === null) {
      setDragOverIndex(null);
      return;
    }
    const insertAt = dragOverPosition === 'top' ? index : index + 1;
    reorderPages(dragIndex, insertAt);
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverPosition, reorderPages]);

  const pageCount = pages.length;

  // 倒置依赖：向主界面注册入口描述（当前页名/页数驱动 tooltip 文案）
  useFeatureEntry('pages', {
    glyph: pagesGlyph,
    tint: PAGES_TINT,
    tint2: PAGES_TINT2,
    label: currentPage ? `${currentPage.name}（共${pageCount}页）` : `（共${pageCount}页）`,
    badge: null,
  });

  return (
    <>
      {present && (
        <div
          ref={sidebarRef}
          className={`pages-sidebar ${expanded ? 'expanded' : ''} ${present && !expanded ? 'animating' : ''}`}
        >
          <div className="pages-sidebar-content">
            <div className="pages-sidebar-header">
              <h2>页面切换</h2>
              <div style={{ fontSize: '0.55vw', color: 'var(--text-secondary)', fontFamily: "'Inter', sans-serif" }}>
                共 {pageCount} 个页面
              </div>
            </div>

            <button className="add-page-btn" onClick={handleAddPage}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新建页面
            </button>

            <div className="pages-list">
              {pages.map((page, index) => {
                const isActive = page.id === currentPageId;
                const isEditing = editing?.pageId === page.id;
                const isDragging = dragIndex === index;
                const isDragOver = dragOverIndex === index;
                const showIndicatorTop = isDragOver && dragOverPosition === 'top';
                const showIndicatorBottom = isDragOver && dragOverPosition === 'bottom';

                return (
                  <div
                    key={page.id}
                    className={`page-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${showIndicatorTop ? 'drop-indicator-top' : ''} ${showIndicatorBottom ? 'drop-indicator-bottom' : ''}`}
                    draggable={!isEditing && !pendingDelete}
                    onClick={() => !isEditing && handlePageClick(page.id)}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={(e) => handleDragLeave(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    {!isEditing && (
                      <div
                        className="drag-handle"
                        title="拖拽排序"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="9" cy="5" r="1.6" />
                          <circle cx="15" cy="5" r="1.6" />
                          <circle cx="9" cy="12" r="1.6" />
                          <circle cx="15" cy="12" r="1.6" />
                          <circle cx="9" cy="19" r="1.6" />
                          <circle cx="15" cy="19" r="1.6" />
                        </svg>
                      </div>
                    )}
                    {isEditing && <div className="drag-handle placeholder" />}

                    <div className="page-item-indicator" />

                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        className="page-name-input"
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        onBlur={handleRenameSubmit}
                        onKeyDown={handleRenameKeyDown}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="page-item-name" title={page.name}>
                        {page.name}
                      </span>
                    )}

                    {!isEditing && (
                      <div className="page-item-actions">
                        <button
                          className="page-action-btn"
                          title="重命名"
                          onClick={(e) => handleStartRename(e, page)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className="page-action-btn delete"
                          title={pageCount <= 1 ? '至少保留一个页面' : '删除页面'}
                          onClick={(e) => pageCount > 1 && handleDeleteClick(e, page)}
                          style={pageCount <= 1 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {isActive && !isEditing && (
                      <div className="current-page-badge" title="当前页面" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 删除页面确认：统一使用全局 ConfirmDialog（Aurora 风格 + danger 语义红渐变） */}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="确认删除"
        message={
          pendingDelete
            ? `确定要删除页面「${pendingDelete.name}」吗？该页面中的所有网站图标也会被删除。`
            : ''
        }
        confirmType="danger"
        confirmText="删除"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
};

export default PagesSidebar;
