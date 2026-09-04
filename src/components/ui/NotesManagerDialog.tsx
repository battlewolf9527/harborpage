import React, { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './NotesManagerDialog.css';
import { useNotesStore } from '../../store/useNotesStore';
import { usePaletteStore } from '../../store/usePaletteStore';
import type { Note } from '../../types';
import NoteEditorDialog from './NoteEditorDialog';
import ConfirmDialog from '../common/ConfirmDialog';
import { noteHexStyleVars } from '../../utils/noteColors';
import { buildSelection, resolveColorHex } from '../../utils/paletteColors';

interface NotesManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotesManagerDialog: React.FC<NotesManagerDialogProps> = ({ isOpen, onClose }) => {
  const {
    notes,
    deleteNote,
    reorderNotes,
  } = useNotesStore(
    useShallow((s) => ({
      notes: s.notes,
      deleteNote: s.deleteNote,
      reorderNotes: s.reorderNotes,
    })),
  );
  const slots = usePaletteStore((s) => s.slots);

  // 关闭流程（同编辑器：先动画，再回调）
  const [isClosing, setIsClosing] = useState(false);
  const [closeTimer, setCloseTimer] = useState<number | null>(null);
  const runClose = useCallback(() => {
    if (closeTimer !== null) return;
    setIsClosing(true);
    const id = window.setTimeout(() => {
      setCloseTimer(null);
      setIsClosing(false);
      onClose();
    }, 260);
    setCloseTimer(id);
  }, [closeTimer, onClose]);

  const [search, setSearch] = useState('');

  // 内嵌编辑器
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorNoteId, setEditorNoteId] = useState<string | null>(null);

  // 删除确认
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // 拖拽状态（作用在「已过滤可见列表」的下标上，拖动后再映射回原 notes 下标）
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom'>('bottom');

  // 搜索过滤：在标题或内容中包含关键字即命中（不区分大小写）
  const keyword = useMemo(() => search.trim().toLowerCase(), [search]);
  const filteredIds = useMemo(() => {
    if (!keyword) return null;
    const kw = keyword;
    const ids = new Set<string>();
    for (const n of notes) {
      if (
        n.title.toLowerCase().includes(kw) ||
        n.content.toLowerCase().includes(kw)
      ) ids.add(n.id);
    }
    return ids;
  }, [notes, keyword]);

  const visibleNotes: Note[] = useMemo(() => {
    if (!filteredIds) return notes;
    return notes.filter((n) => filteredIds.has(n.id));
  }, [notes, filteredIds]);

  // 搜索过滤后：拖拽 → 映射到原 notes 的 index 执行 reorderNotes
  const handleDrop = useCallback(
    (overIndex: number) => {
      if (dragIndex === null) return;
      const insertAt = dragOverPosition === 'top' ? overIndex : overIndex + 1;
      // 映射到原 notes 下标
      const fromOrig = notes.indexOf(visibleNotes[dragIndex]);
      const overOrig = notes.indexOf(visibleNotes[overIndex]);
      if (fromOrig < 0 || overOrig < 0) return;
      const rawInsert =
        insertAt >= visibleNotes.length
          ? notes.length
          : notes.indexOf(visibleNotes[insertAt] ?? visibleNotes[visibleNotes.length - 1]);
      // 如果目标不存在（极少见：insertAt === visibleNotes.length）
      const toOrig =
        insertAt >= visibleNotes.length ? notes.length : rawInsert < 0 ? notes.length : rawInsert;
      if (fromOrig === toOrig) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      reorderNotes(fromOrig, toOrig);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, dragOverPosition, notes, visibleNotes, reorderNotes],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, index: number) => {
      // 搜索模式下不允许拖拽（因为顺序结果不是完整集合，避免用户困惑）
      if (filteredIds) {
        e.preventDefault();
        return;
      }
      setDragIndex(index);
      setDragOverIndex(null);
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(index)); } catch { /* noop */ }
    },
    [filteredIds],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>, index: number) => {
      if (dragIndex === null || dragIndex === index) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      setDragOverIndex(index);
      setDragOverPosition(e.clientY < mid ? 'top' : 'bottom');
    },
    [dragIndex],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLElement>, index: number) => {
      const related = e.relatedTarget;
      if (related instanceof Node && e.currentTarget.contains(related)) return;
      if (dragOverIndex === index) setDragOverIndex(null);
    },
    [dragOverIndex],
  );

  // 新建：只打开空白编辑器，用户点击"创建/保存"时才真正写入 store
  const handleCreate = useCallback(() => {
    setEditorNoteId(null);
    setEditorOpen(true);
  }, []);

  const handleOpenEditor = useCallback((id: string) => {
    setEditorNoteId(id);
    setEditorOpen(true);
  }, []);

  const handleDeleteClick = useCallback((id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    // 504844 建议的最小防护：阻止冒泡到卡片 body（它 onClick 会打开编辑器）
    e.preventDefault();
    e.stopPropagation();
    setPendingDelete(id);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`notes-mgr-overlay ${isClosing ? 'closing' : ''}`}
        onClick={runClose}
      />
      <div
        className={`notes-mgr-dialog ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="笔记管理"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notes-mgr-header">
          <div className="notes-mgr-title-row">
            <h2>📒 笔记管理</h2>
            <button
              type="button"
              className="notes-mgr-close"
              onClick={runClose}
              aria-label="关闭"
              title="关闭 (Esc)"
            >
              ✕
            </button>
          </div>

          <div className="notes-mgr-toolbar">
            <div className="notes-mgr-search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="搜索标题或内容…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="notes-mgr-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="清除搜索"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="notes-mgr-stats">
              {filteredIds ? (
                <span>命中 {visibleNotes.length} / 共 {notes.length} 篇</span>
              ) : (
                <span>共 {notes.length} 篇 · 拖拽列表行可排序</span>
              )}
            </div>
            <button type="button" className="notes-mgr-add" onClick={handleCreate}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新建
            </button>
          </div>
        </div>

        <div className="notes-mgr-body">
          {visibleNotes.length === 0 ? (
            <div className="notes-mgr-empty">
              <div className="notes-mgr-empty-emoji">📭</div>
              <h3>{filteredIds ? '没有匹配的笔记' : '还没有笔记'}</h3>
              <p>
                {filteredIds
                  ? '试试换个关键词，或者清除搜索条件。'
                  : '点击右上角「新建」创建你的第一篇笔记吧！'}
              </p>
            </div>
          ) : (
            <ul className="notes-mgr-list">
              {visibleNotes.map((note, index) => {
                // 绑定槽 → 槽当前色；旧数据静态解析；统一走解析后的内联变量，改色即时生效
                const resolvedHex = resolveColorHex(buildSelection(note.color, note.colorSlot), slots);
                const colorStyle = resolvedHex ? noteHexStyleVars(resolvedHex, 0.14) : undefined;
                const isDragOver = dragOverIndex === index;
                return (
                  <li
                    key={note.id}
                    className={`notes-mgr-item
                      ${dragIndex === index ? 'dragging' : ''}
                      ${isDragOver && dragOverPosition === 'top' ? 'drop-top' : ''}
                      ${isDragOver && dragOverPosition === 'bottom' ? 'drop-bottom' : ''}
                    `}
                    style={colorStyle}
                    draggable={!filteredIds}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={(e) => handleDragLeave(e, index)}
                    onDrop={() => handleDrop(index)}
                  >
                    <div
                      className="notes-mgr-dot"
                      title="拖拽排序"
                      aria-hidden="true"
                    />
                    <div className="notes-mgr-item-body" onClick={() => handleOpenEditor(note.id)}>
                      <div className="notes-mgr-item-title-row">
                        <span className="notes-mgr-item-title">{note.title || '无标题'}</span>
                      </div>
                      <div className="notes-mgr-item-content">
                        {note.content
                          ? note.content.replace(/\s+/g, ' ').slice(0, 120) || '（空内容）'
                          : <em>（无内容）</em>
                        }
                      </div>
                      <div className="notes-mgr-item-meta">
                        {note.updatedAt
                          ? <>更新于 {new Date(note.updatedAt).toLocaleString()}</>
                          : note.createdAt
                            ? <>创建于 {new Date(note.createdAt).toLocaleString()}</>
                            : null
                        }
                      </div>
                    </div>
                    <div className="notes-mgr-item-actions">
                      <button
                        type="button"
                        className="notes-mgr-action edit"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleOpenEditor(note.id);
                        }}
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="notes-mgr-action delete"
                        onClick={(e) => handleDeleteClick(note.id, e)}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* key 随编辑器上下文切换：id/new + 打开开关
         确保每次打开/切换笔记时 NoteEditorDialog 被重挂载，
         用 useState 的 lazy init 直接派生初值，避免 effect 里同步 setState。 */}
      {editorOpen && (
        <NoteEditorDialog
          key={editorNoteId ?? 'new'}
          isOpen={editorOpen}
          noteId={editorNoteId}
          onClose={() => {
            setEditorOpen(false);
            setEditorNoteId(null);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="删除笔记"
        message="确定要删除这篇笔记吗？删除后不可恢复。"
        onConfirm={() => {
          if (pendingDelete) deleteNote(pendingDelete);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
};

export default NotesManagerDialog;
