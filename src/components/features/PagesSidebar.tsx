import React, { useState, useRef, useEffect, useCallback } from 'react';
import './PagesSidebar.css';
import { usePagesSelector } from '../../store/selectors';
import { useClickOutside } from '../../hooks/useClickOutside';
import type { Page } from '../../types';

interface EditingState {
  pageId: string;
  name: string;
}

const PagesSidebar: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom'>('bottom');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusedPageIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // 编辑时自动聚焦输入框（仅在进入/切换编辑目标时聚焦+全选，避免每次改字都全选）
  useEffect(() => {
    const currentPageId = editing?.pageId ?? null;
    if (currentPageId !== lastFocusedPageIdRef.current) {
      if (editing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      lastFocusedPageIdRef.current = currentPageId;
    }
  }, [editing?.pageId]);

  const startAnimationTimeout = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
      timerRef.current = null;
    }, 300);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsAnimating(true);
    setIsExpanded(prev => !prev);
    startAnimationTimeout();
  }, [startAnimationTimeout]);

  useClickOutside(sidebarRef, {
    handler: () => {
      if (isExpanded) {
        setIsAnimating(true);
        setIsExpanded(false);
        startAnimationTimeout();
        setEditing(null);
      }
    },
    enabled: isExpanded,
  });

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
    // 编辑中或待删除确认时，禁止拖拽
    if (editing || pendingDelete) {
      e.preventDefault();
      return;
    }
    setDragIndex(index);
    setDragOverIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    // 某些浏览器需要设置 data 才会触发拖拽
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
    // 只在离开当前目标本身时清空（避免子元素冒泡误触发）
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
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
    // 插入位置：拖到某一项的上半部 → 放在该项之前（index）；下半部 → 放在该项之后（index+1）
    const insertAt = dragOverPosition === 'top' ? index : index + 1;
    // 直接使用 reorderPages 的 splice(from,1) → splice(insertAt,0,moved) 语义，
    // 它在内部处理 fromIndex 移除对 insertAt 的偏移修正
    reorderPages(dragIndex, insertAt);
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverPosition, reorderPages]);

  const pageCount = pages.length;

  return (
    <>
      <div
        className="pages-sidebar-icon"
        onClick={toggleSidebar}
      >
        <div className="pages-tooltip">
          {currentPage ? `${currentPage.name}` : ''}（共{pageCount}页）
        </div>

        <div className="pages-icon-container">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M9 13h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div ref={sidebarRef} className={`pages-sidebar ${isExpanded ? 'expanded' : ''} ${isAnimating ? 'animating' : ''}`}>
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
                  {/* 拖拽手柄（6点图标） */}
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

      {/* 删除确认对话框 - 使用全局 ConfirmDialog 的内联简化版本 */}
      {pendingDelete && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 1010,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
            onClick={handleCancelDelete}
          >
            <div
              style={{
                background: 'var(--background-white)',
                borderRadius: '0.8vw',
                padding: '1.2vw 1.4vw',
                width: '18vw',
                boxShadow: 'var(--shadow-lg)',
                fontFamily: "'Inter', sans-serif",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 0.6vw', fontSize: '0.85vw', fontWeight: 700, color: 'var(--text-primary)' }}>
                确认删除
              </h3>
              <p style={{ margin: '0 0 1.2vw', fontSize: '0.7vw', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                确定要删除页面「<strong style={{ color: 'var(--text-primary)' }}>{pendingDelete.name}</strong>」吗？<br />
                该页面中的所有网站图标也会被删除。
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5vw' }}>
                <button
                  onClick={handleConfirmDelete}
                  style={{
                    padding: '0.4vw 1vw',
                    fontSize: '0.65vw',
                    borderRadius: '0.4vw',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
                >
                  删除
                </button>
                <button
                  onClick={handleCancelDelete}
                  style={{
                    padding: '0.4vw 1vw',
                    fontSize: '0.65vw',
                    borderRadius: '0.4vw',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--background-light)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default PagesSidebar;
