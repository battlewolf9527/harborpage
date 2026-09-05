import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import './NoteEditorDialog.css';
import { useNotesStore } from '../../store/useNotesStore';
import { usePaletteStore } from '../../store/usePaletteStore';
import type { Note } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';
import { Palette } from '../common/PalettePicker';
import createLogger from '../../utils/logger';
import { noteHexStyleVars } from '../../utils/noteColors';
import { adjustHexLightness } from '../../utils/colorUtils';
import {
  buildSelection,
  canonicalSlotId,
  resolveColorHex,
  randomSlotSelection,
  type ColorSelection,
} from '../../utils/paletteColors';

const logger = createLogger('NoteEditorDialog');

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
  const { notes, addNote, updateNote, deleteNote, applyNoteColor } = useNotesStore(
    useShallow((s) => ({
      notes: s.notes,
      addNote: s.addNote,
      updateNote: s.updateNote,
      deleteNote: s.deleteNote,
      applyNoteColor: s.applyNoteColor,
    })),
  );
  const slots = usePaletteStore((s) => s.slots);
  const lightness = usePaletteStore((s) => s.lightness);

  // ── 【关键】直接在 useState lazy init 里派生初值，彻底移除 effect 里同步 setState。
  //    父组件通过 key={noteId ?? 'new'} 切换上下文时会重挂载组件，
  //    useState 的初始化函数只会跑一次，语义等价于原 effect。
  type EditorState = {
    activeId: string | null;
    draft: Pick<Note, 'title' | 'content'>;
    /** color=最终写入 Note.color 的值（旧数据保留原名/hex；新选择写 hex 快照） */
    color: string;
    /** 绑定槽位 id（跟随调色板当前色；无 = 静态自定义色） */
    colorSlot?: string;
  };
  const initEditorState = (): EditorState => {
    if (noteId) {
      const target = notes.find((n) => n.id === noteId);
      if (target) {
        const fallback = randomSlotSelection(slots);
        return {
          activeId: target.id,
          draft: { title: target.title, content: target.content },
          color: target.color ?? fallback.color ?? '',
          // 打开即归一化槽位 id（旧数据 colorSlot 可能是预设名，落盘时升级为 palette-N）
          ...(canonicalSlotId(target.colorSlot) ? { colorSlot: canonicalSlotId(target.colorSlot) } : {}),
        };
      }
      logger.warn('NoteEditorDialog: 找不到目标笔记，退化为新建模式。', noteId);
    }
    const fallback = randomSlotSelection(slots);
    return {
      activeId: null,
      draft: { ...EMPTY },
      color: fallback.color ?? '',
      ...(fallback.colorSlot ? { colorSlot: fallback.colorSlot } : {}),
    };
  };
  const [editorState, setEditorState] = useState<EditorState>(initEditorState);
  const { activeId, draft, color, colorSlot } = editorState;
  type DraftShape = Pick<Note, 'title' | 'content'>;
  const setDraft = (d: React.SetStateAction<DraftShape>) =>
    setEditorState((s) => ({
      ...s,
      draft: typeof d === 'function' ? (d as (prev: DraftShape) => DraftShape)(s.draft) : d,
    }));
  /** 颜色选择：槽 → 记快照色并绑定 colorSlot；自定义 → 记色并清除 colorSlot */
  const handleColorChange = useCallback((sel: ColorSelection) => {
    setEditorState((s) => {
      if (sel.colorSlot) {
        return { ...s, color: sel.color || '', colorSlot: sel.colorSlot };
      }
      if (sel.color) {
        const next: EditorState = { ...s, color: sel.color };
        delete next.colorSlot;
        return next;
      }
      return s;
    });
  }, []);

  // 关闭流程：先触发本地 isClosing 动画 → 延迟调用 onClose
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 删除确认
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 未保存更改确认（ESC / ✕ / 取消 的统一防误操作入口）
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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

  // 是否存在未保存更改：
  //   · 新建模式：只要输入过标题或内容就算有内容；
  //   · 编辑模式：标题/内容/颜色任一与已存笔记不一致（按保存时的裁剪规则比较）。
  // 有未保存更改时，ESC / ✕ / 取消 先弹确认框，防止误操作丢失内容。
  const hasUnsavedChanges = useMemo(() => {
    if (!activeId) {
      return draft.title.trim().length > 0 || draft.content.trim().length > 0;
    }
    const target = notes.find((n) => n.id === activeId);
    if (!target) return true;
    const titleChanged = (draft.title.trim() || '无标题') !== (target.title ?? '');
    const contentChanged = draft.content.trim() !== (target.content ?? '');
    const colorChanged = color !== (target.color ?? '') || (colorSlot ?? '') !== (target.colorSlot ?? '');
    return titleChanged || contentChanged || colorChanged;
  }, [activeId, draft, color, colorSlot, notes]);

  // 统一关闭入口：有未保存更改 → 弹确认框（可返回继续编辑）；无 → 直接关闭。
  // 供 ESC / 头部 ✕ / 底部 取消 使用，避免误触导致内容丢失。
  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmDiscard(true);
    } else {
      runClosing();
    }
  }, [hasUnsavedChanges, runClosing]);

  // ESC 关闭（有未保存更改时先确认）
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, requestClose]);

  // ── 保存 ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const title = draft.title.trim() || '无标题';
    const content = draft.content.trim();
    // 保存快照色：绑定槽 → 槽当前色（改色后快照保鲜）；静态 → 归一化后的 hex/原名
    const savedColor = resolveColorHex(buildSelection(color, colorSlot), slots) || color || '';

    if (activeId) {
      const existing = notes.find((n) => n.id === activeId);
      const patch: Partial<Note> = { title, content };
      // 颜色仅在用户改动过时才写（避免把旧数据预设名无故改写成 hex）；
      // 需要清除/绑定 colorSlot 时走 applyNoteColor（updateNote 浅合并无法删除字段）
      const colorChanged =
        !existing ||
        color !== (existing.color ?? '') ||
        (colorSlot ?? '') !== (existing.colorSlot ?? '');
      if (colorChanged) {
        applyNoteColor(activeId, {
          color: savedColor,
          ...(colorSlot ? { colorSlot } : {}),
        });
      }
      // pinned 字段已从 UI 入口移除，不再写入
      updateNote(activeId, patch);
    } else {
      addNote({
        title,
        content,
        color: savedColor,
        ...(colorSlot ? { colorSlot } : {}),
      });
    }
    runClosing();
  }, [activeId, draft, color, colorSlot, slots, applyNoteColor, updateNote, addNote, notes, runClosing]);

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

  const isCreate = !activeId;

  // 编辑器主题色 = 当前选择解析后的 hex（绑定槽 → 槽当前色；旧数据静态解析）；
  // 以 hex 直接注入 CSS 变量，槽位改色即改即生效；
  // lightness = 全局明暗度（不改存储 hex），仅编辑表面的实际观感整体叠加亮度
  const editorDisplayHex = resolveColorHex(buildSelection(color, colorSlot), slots);
  const colorStyleVars = editorDisplayHex
    ? noteHexStyleVars(adjustHexLightness(editorDisplayHex, lightness), 0.1)
    : undefined;
  // 取色器展示值：旧数据预设名归一化显示为静态自定义色，便于高亮与原生取色器联动
  const pickerValue: ColorSelection = useMemo(() => {
    if (colorSlot) {
      return color ? { color, colorSlot } : { colorSlot };
    }
    const staticHex = color ? resolveColorHex(buildSelection(color), slots) : '';
    const displayColor = staticHex || color || '';
    return displayColor ? { color: displayColor } : {};
  }, [color, colorSlot, slots]);

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层仅作视觉背景，不再绑定外部点击关闭：编辑器存在未保存的标题/内容/颜色，
          误点外部（例如拖拽选词松开在框外、手抖碰到遮罩）会导致工作丢失。
          合法关闭入口只保留：header ✕ / footer 取消 / footer 删除 / Esc 键；
          前三者（删除有独立二次确认）统一走 requestClose —— 有未保存更改时先弹确认框。 */}
      <div
        className={`note-editor-overlay ${isClosing ? 'closing' : ''}`}
      />
      <div
        className={`note-editor-dialog ${isClosing ? 'closing' : ''}`}
        style={colorStyleVars}
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
              onClick={requestClose}
              aria-label="关闭"
              title="关闭 (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="note-editor-toolbar">
            <div className="note-editor-color-palette" role="group" aria-label="便签颜色">
              <Palette value={pickerValue} onChange={handleColorChange} />
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
              onClick={requestClose}
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

      {/* 未保存更改确认：确认 = 放弃更改并关闭；取消 = 回到编辑器继续编辑。
          确认框自身监听 ESC → onCancel（留在编辑器），阻断冒泡到本编辑器 ESC 逻辑。 */}
      <ConfirmDialog
        isOpen={confirmDiscard}
        title="放弃未保存的更改？"
        message="当前编辑尚未保存，关闭后将丢失输入的标题与内容。"
        confirmText="放弃更改"
        confirmType="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          runClosing();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
};

export default NoteEditorDialog;
