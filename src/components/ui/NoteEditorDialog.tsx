import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './NoteEditorDialog.css';
import { useNotesStore } from '../../store/useNotesStore';
import type { Note, NoteColor } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';
import createLogger from '../../utils/logger';

const logger = createLogger('NoteEditorDialog');

// 便签球颜色：与 types/NoteColor 字面量严格一致，共 16 色
const ALL_COLORS: NoteColor[] = [
  'yellow', 'amber', 'orange', 'coral',
  'pink', 'rose',
  'red',
  'green', 'lime', 'emerald', 'teal', 'cyan',
  'blue', 'sky',
  'purple', 'indigo',
];

const EMPTY: Pick<Note, 'title' | 'content'> = { title: '', content: '' };

interface NoteEditorDialogProps {
  /** true 打开 / false 关闭 */
  isOpen: boolean;
  /** 编辑目标 id；为空即新建 */
  noteId?: string | null;
  /** 关闭回调（会在关闭动画完成时触发） */
  onClose: () => void;
}

const NoteEditorDialog: React.FC<NoteEditorDialogProps> = ({ isOpen, noteId, onClose }) => {
  const { notes, addNote, updateNote, deleteNote } = useNotesStore(
    useShallow((s) => ({
      notes: s.notes,
      addNote: s.addNote,
      updateNote: s.updateNote,
      deleteNote: s.deleteNote,
    })),
  );

  // 每次默认颜色随机（新建模式），与原逻辑一致
  const pickRandomColor = (): NoteColor =>
    ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];

  // ── 【关键】直接在 useState lazy init 里派生初值，彻底移除 effect 里同步 setState。
  //    父组件通过 key={noteId ?? 'new'} 切换上下文时会重挂载组件，
  //    useState 的初始化函数只会跑一次，语义等价于原 effect。
  type EditorState = {
    activeId: string | null;
    draft: Pick<Note, 'title' | 'content'>;
    color: NoteColor;
  };
  const initEditorState = (): EditorState => {
    if (noteId) {
      const target = notes.find((n) => n.id === noteId);
      if (target) {
        return {
          activeId: target.id,
          draft: { title: target.title, content: target.content },
          color: target.color ?? pickRandomColor(),
        };
      }
      logger.warn('NoteEditorDialog: 找不到目标笔记，退化为新建模式。', noteId);
    }
    return {
      activeId: null,
      draft: { ...EMPTY },
      color: pickRandomColor(),
    };
  };
  const [editorState, setEditorState] = useState<EditorState>(initEditorState);
  const { activeId, draft, color } = editorState;
  type DraftShape = Pick<Note, 'title' | 'content'>;
  const setDraft = (d: React.SetStateAction<DraftShape>) =>
    setEditorState((s) => ({
      ...s,
      draft: typeof d === 'function' ? (d as (prev: DraftShape) => DraftShape)(s.draft) : d,
    }));
  const setColor = (c: React.SetStateAction<NoteColor>) =>
    setEditorState((s) => ({
      ...s,
      color: typeof c === 'function' ? (c as (prev: NoteColor) => NoteColor)(s.color) : c,
    }));

  // 关闭流程：先触发本地 isClosing 动画 → 延迟调用 onClose
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 删除确认
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 打开后聚焦标题框（纯副作用，不 setState → 不再触发 ESLint）
  useEffect(() => {
    const t = window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(t);
  }, []);

  // ── 动画关闭计时清理 ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const runClosing = useCallback(() => {
    if (closeTimerRef.current) return;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setIsClosing(false);
      onClose();
    }, 260);
  }, [onClose]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        runClosing();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, runClosing]);

  // ── 保存 ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const title = draft.title.trim() || '无标题';
    const content = draft.content.trim();

    if (activeId) {
      const existing = notes.find((n) => n.id === activeId);
      const merged: Partial<Note> = { title, content };
      if (existing && existing.color !== color) merged.color = color;
      // 单次 update：pinned 字段已从 UI 入口移除，不再写入
      updateNote(activeId, merged);
    } else {
      addNote({ title, content, color });
    }
    runClosing();
  }, [activeId, draft, color, updateNote, addNote, notes, runClosing]);

  // Ctrl/Cmd+S 保存；Enter 在标题输入 → 跳到正文；最后输入框(正文) Ctrl/⌘ + Enter 保存
  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      contentTextareaRef.current?.focus();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const handleContentKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  // ── 删除 ──────────────────────────────────────────────────────────────
  const handleDelete = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!activeId) return;
    e?.preventDefault();
    e?.stopPropagation();
    setConfirmDelete(true);
  }, [activeId]);

  const handleConfirmDelete = useCallback(() => {
    if (activeId) deleteNote(activeId);
    setConfirmDelete(false);
    runClosing();
  }, [activeId, deleteNote, runClosing]);

  // ── 颜色切换 ──────────────────────────────────────────────────────────
  const handlePickColor = useCallback((c: NoteColor) => {
    setColor(c);
  }, []);

  if (!isOpen) return null;

  const isCreate = !activeId;

  return (
    <>
      {/* 遮罩层仅作视觉背景，不再绑定外部点击关闭：编辑器存在未保存的标题/内容/颜色，
          误点外部（例如拖拽选词松开在框外、手抖碰到遮罩）会导致工作丢失。
          合法关闭入口只保留：header ✕ / footer 取消 / footer 删除 / Esc 键（后者触发 runClosing）。 */}
      <div
        className={`note-editor-overlay ${isClosing ? 'closing' : ''}`}
      />
      <div
        className={`note-editor-dialog color-${color} ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={isCreate ? '新建笔记' : '编辑笔记'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="note-editor-header">
          <div className="note-editor-title-row">
            <h2>{isCreate ? '新建笔记' : '编辑笔记'}</h2>
            <button
              type="button"
              className="note-editor-close"
              onClick={runClosing}
              aria-label="关闭"
              title="关闭 (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="note-editor-toolbar">
            <div className="note-editor-color-palette" role="group" aria-label="便签颜色">
              {ALL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`note-color-chip ${c} ${color === c ? 'active' : ''}`}
                  onClick={() => handlePickColor(c)}
                  aria-label={`颜色 ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="note-editor-body">
          <input
            ref={titleInputRef}
            className="note-editor-title"
            type="text"
            placeholder="笔记标题…"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            onKeyDown={handleTitleKeyDown}
          />
          <textarea
            ref={contentTextareaRef}
            className="note-editor-content"
            placeholder="写点什么吧…（⌘/Ctrl + Enter 保存）"
            rows={10}
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            onKeyDown={handleContentKeyDown}
          />
          <div className="note-editor-meta">
            {activeId ? (
              <span>
                创建：
                {(() => {
                  const t = notes.find((n) => n.id === activeId);
                  return t?.createdAt ? new Date(t.createdAt).toLocaleString() : '—';
                })()}
              </span>
            ) : (
              <span>全新笔记，保存后立即生效。</span>
            )}
          </div>
        </div>

        <div className="note-editor-footer">
          {/* ——— 左侧：纯功能性（不直接关闭窗口的破坏性动作）。
                   用户约定：
                     · 左区 = 功能性，不带关闭窗口功能的按钮（如删除：需二次确认，不直接关编辑器）
                     · 右区 = 会关闭窗口的按钮（保存/提交/取消），取消必须最右 */}
          <div className="note-editor-footer-left">
            {!isCreate && (
              <button
                type="button"
                className="note-editor-btn danger"
                onClick={handleDelete}
              >
                🗑️ 删除
              </button>
            )}
          </div>

          {/* ——— 右侧：会关闭窗口的按钮
                   DOM 顺序 [保存/创建] → [取消]，容器 justify-content:flex-end →
                   视觉上取消按钮最右（符合约定）。 */}
          <div className="note-editor-footer-right">
            <button
              type="button"
              className="note-editor-btn primary"
              onClick={handleSave}
            >
              {isCreate ? '创建' : '保存'}
            </button>
            <button
              type="button"
              className="note-editor-btn ghost"
              onClick={runClosing}
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="删除笔记"
        message="确定要删除这篇笔记吗？删除后不可恢复。"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};

export default NoteEditorDialog;
