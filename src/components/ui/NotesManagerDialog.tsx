import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './NotesManagerDialog.css';
import { useNotesStore } from '../../store/useNotesStore';
import { usePaletteStore } from '../../store/usePaletteStore';
import type { Note } from '../../types';
import NoteEditorDialog from './NoteEditorDialog';
import ConfirmDialog from '../common/ConfirmDialog';
import { noteHexStyleVars } from '../../utils/noteColors';
import { adjustHexLightness } from '../../utils/colorUtils';
import { buildSelection, resolveColorHex } from '../../utils/paletteColors';
import { useListPointerReorder } from '../../hooks/useListPointerReorder';

interface NotesManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotesManagerDialog: React.FC<NotesManagerDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('notes');
  const {
    notes,
    deleteNote,
    reorderNotes,
    loadAllContents,
  } = useNotesStore(
    useShallow((s) => ({
      notes: s.notes,
      deleteNote: s.deleteNote,
      reorderNotes: s.reorderNotes,
      loadAllContents: s.loadAllContents,
    })),
  );
  const slots = usePaletteStore((s) => s.slots);
  const lightness = usePaletteStore((s) => s.lightness);

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

  // 搜索过滤：在标题或内容中包含关键字即命中（不区分大小写）
  // 正文分片存储后不在初始化数据里，有关键字时先按需拉全量正文再做全文匹配
  const keyword = useMemo(() => search.trim().toLowerCase(), [search]);
  const [searchLoadFailed, setSearchLoadFailed] = useState(false);

  useEffect(() => {
    if (!isOpen || !keyword) return;
    let cancelled = false;
    void loadAllContents().then((failed) => {
      if (!cancelled) setSearchLoadFailed(failed > 0);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, keyword, loadAllContents]);

  // 加载中（仍有正文未取回且未失败）——由数据推导，避免在 effect 里同步 setState
  const searching =
    keyword !== '' && !searchLoadFailed && notes.some((note) => !note.contentLoaded);

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

  // ── 拖拽排序（Pointer Events，桌面与触屏同一套代码）──────────────────────
  // 纵向列表：只画指示线，松手才落库。
  // 搜索过滤态下禁止起拖（顺序结果不是完整集合，避免用户困惑）。
  // 落库时要把「可见列表下标」映射回原 notes 下标。
  const { draggingKey, overKey, overPosition, getItemProps } = useListPointerReorder({
    keys: visibleNotes.map((note) => note.id),
    canStart: () => !filteredIds,
    onReorder: (from, over, position) => {
      const insertAt = position === 'before' ? over : over + 1;
      // 映射到原 notes 下标
      const fromOrig = notes.indexOf(visibleNotes[from]);
      const overOrig = notes.indexOf(visibleNotes[over]);
      if (fromOrig < 0 || overOrig < 0) return;
      const rawInsert =
        insertAt >= visibleNotes.length
          ? notes.length
          : notes.indexOf(visibleNotes[insertAt] ?? visibleNotes[visibleNotes.length - 1]);
      // 如果目标不存在（极少见：insertAt === visibleNotes.length）
      const toOrig =
        insertAt >= visibleNotes.length ? notes.length : rawInsert < 0 ? notes.length : rawInsert;
      if (fromOrig === toOrig) return;
      reorderNotes(fromOrig, toOrig);
    },
  });

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
        aria-label={t('manager.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notes-mgr-header">
          <div className="notes-mgr-title-row">
            <h2>📒 {t('manager.title')}</h2>
            <button
              type="button"
              className="notes-mgr-close"
              onClick={runClose}
              aria-label={t('close')}
              title={t('closeEsc')}
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
                placeholder={t('manager.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="notes-mgr-search-clear"
                  onClick={() => setSearch('')}
                  aria-label={t('manager.clearSearch')}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="notes-mgr-stats">
              {searching ? (
                <span>{t('manager.searching')}</span>
              ) : filteredIds ? (
                <span>{t('manager.statsFiltered', { visible: visibleNotes.length, total: notes.length })}</span>
              ) : (
                <span>{t('manager.stats', { total: notes.length })}</span>
              )}
            </div>
            <button type="button" className="notes-mgr-add" onClick={handleCreate}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('manager.create')}
            </button>
          </div>
        </div>

        <div className="notes-mgr-body">
          {visibleNotes.length === 0 && !searching ? (
            <div className="notes-mgr-empty">
              <div className="notes-mgr-empty-emoji">📭</div>
              <h3>{filteredIds ? t('manager.emptyFilteredTitle') : t('manager.emptyTitle')}</h3>
              <p>
                {filteredIds
                  ? t('manager.emptyFilteredHint')
                  : t('manager.emptyHint')}
              </p>
            </div>
          ) : (
            <ul className="notes-mgr-list">
              {visibleNotes.map((note) => {
                // 绑定槽 → 槽当前色；旧数据静态解析；统一走解析后的内联变量，改色即时生效；
                // lightness = 全局明暗度（不改存储 hex），表面色渲染时叠加亮度
                const resolvedHex = resolveColorHex(buildSelection(note.color, note.colorSlot), slots);
                const colorStyle = resolvedHex
                  ? noteHexStyleVars(adjustHexLightness(resolvedHex, lightness), 0.14)
                  : undefined;
                const isDragging = draggingKey === note.id;
                const isDragOver = overKey === note.id;
                return (
                  <li
                    key={note.id}
                    {...getItemProps(note.id)}
                    className={`notes-mgr-item
                      ${isDragging ? 'dragging' : ''}
                      ${isDragOver && overPosition === 'before' ? 'drop-top' : ''}
                      ${isDragOver && overPosition === 'after' ? 'drop-bottom' : ''}
                    `}
                    style={colorStyle}
                  >
                    <div
                      className="notes-mgr-dot"
                      title={t('manager.dragToSort')}
                      aria-hidden="true"
                    />
                    <div className="notes-mgr-item-body" onClick={() => handleOpenEditor(note.id)}>
                      <div className="notes-mgr-item-title-row">
                        <span className="notes-mgr-item-title">{note.title || t('untitled')}</span>
                      </div>
                      <div className="notes-mgr-item-content">
                        {/* 正文未加载时用索引里的摘要兜底，列表无需为了预览拉全文 */}
                        {note.content
                          ? note.content.replace(/\s+/g, ' ').slice(0, 120) || t('blankContent')
                          : note.preview
                            ? note.preview
                            : <em>{t('noContent')}</em>
                        }
                      </div>
                      <div className="notes-mgr-item-meta">
                        {note.updatedAt
                          ? <>{t('updatedAt', { date: new Date(note.updatedAt).toLocaleString() })}</>
                          : note.createdAt
                            ? <>{t('createdAt', { date: new Date(note.createdAt).toLocaleString() })}</>
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
                        title={t('edit')}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="notes-mgr-action delete"
                        onClick={(e) => handleDeleteClick(note.id, e)}
                        title={t('delete')}
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
        title={t('editor.deleteConfirmTitle')}
        message={t('editor.deleteConfirmMessage')}
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
