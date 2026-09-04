import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import './NoteBar.css';
import { useNotesStore } from '../../store/useNotesStore';
import { usePaletteStore } from '../../store/usePaletteStore';
import type { Note, PaletteHexMap } from '../../types';
import NotesManagerDialog from './NotesManagerDialog';
import NoteEditorDialog from './NoteEditorDialog';
import { noteHexStyleVars } from '../../utils/noteColors';
import { buildSelection, resolveColorHex } from '../../utils/paletteColors';

/**
 * 便签颜色渲染元数据：绑定槽 → 槽当前色；旧名/hex → 静态解析。
 * 一律以解析后的 hex 生成内联 CSS 变量（--tint/--note-accent/--note-soft），
 * 使调色板改色即时生效，不依赖静态 .color-* 类。
 */
function noteDisplayMeta(
  note: Pick<Note, 'color' | 'colorSlot'> | null | undefined,
  slots?: PaletteHexMap,
): { style?: React.CSSProperties } {
  if (!note) return {};
  const hex = resolveColorHex(buildSelection(note.color, note.colorSlot), slots);
  if (!hex) return {};
  return { style: noteHexStyleVars(hex, 0.14) };
}

/** 小工具：给定 lastMouseRef 的坐标，判断当前鼠标下是否有元素命中任一根节点。
 *  用于 notebar 的 scheduleClose — 因为气泡/缩略预览现在 portal 到 body，
 *  老的「仅看 barRef.contains」会把它们判成不在栏内→误关。 */
function elementLivesIn(el: Element | null, roots: Array<Element | null>): boolean {
  if (!el) return false;
  return roots.some((root) => (root ? root.contains(el) : false));
}

// 笔记栏中段最多显示的笔记球数量（不含 + 和 … 功能球）
const MAX_NOTE_BALLS = 8;

/** 获取笔记球显示的"首字"：标题第一个非空白可见字符，空标题显示「无」。 */
function firstGlyph(title: string): string {
  const s = (title ?? '').trim();
  if (!s) return '无';
  const cp = s.codePointAt(0);
  if (cp != null) return String.fromCodePoint(cp);
  return s.charAt(0);
}

/** 笔记缩略预览内截断（标题+内容）。 */
function truncate(text: string, max = 120): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

const NoteBar: React.FC = () => {
  const { notes, reorderNotes } = useNotesStore(
    useShallow((s) => ({
      notes: s.notes,
      reorderNotes: s.reorderNotes,
    })),
  );
  const slots = usePaletteStore((s) => s.slots);

  // 显示在笔记球区的前 8 条笔记（严格按 store 当前顺序截取；置顶已在 store 顺序里处于最前）
  const ballNotes: Note[] = useMemo(() => notes.slice(0, MAX_NOTE_BALLS), [notes]);

  // ── 显隐控制（单状态 isOpen + CSS transition-delay 分层）─────────────────
  //  为什么用单状态而不是 hovering/revealed + setTimeout 两阶段：
  //     (a) setTimeout(120ms) 会把「抬栏」与「展开球排」切成两段，肉眼能看到
  //         peek-ball 先停下再展开 ——"升起不自然"。
  //     (b) 两个布尔值（hovering/revealed）组合 4 种子态与过渡打架：
  //         例如离开时 revealed 先 false → 球排 collapse 的同时如果用户又
  //         把鼠标移回去，状态翻转会造成 peek-ball 反向晃动一下。
  //  新方案：JS 只给一个 isOpen，其余三阶段动画（抬栏 → 消 peek → 展球排）
  //          都交给 CSS transition-delay 串起来播放，天然单轨、不会跳步。
  const barRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const portalRootRef = useRef<HTMLDivElement | null>(null);
  const ballRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const tooltipRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  // 功能球锚点：peek / + / ⚙︎ / +N badge（与 note 球并列，共用同一套 tooltip reposition 逻辑）
  const featureBallRefs = useRef<Map<string, HTMLElement | null>>(new Map());

  // 最后一次「真实鼠标坐标」记录，供 scheduleClose 到点时做真正的「鼠标是否仍在 bar
  // 里」判定（不能用 bar 自身的固定坐标探针：bar 未坍缩时点永远在 bar 自身，会造成
  // 「永远不关」的假阳性）。
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 });

  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onDocMouseMove = (e: MouseEvent) => {
      lastMouseRef.current.x = e.clientX;
      lastMouseRef.current.y = e.clientY;
    };
    // capture=false 即可；不拦截、不 stopPropagation
    document.addEventListener('mousemove', onDocMouseMove);
    return () => document.removeEventListener('mousemove', onDocMouseMove);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current !== null) return;
    const id = window.setTimeout(() => {
      closeTimerRef.current = null;
      // 260ms 到点时，用「最后一次真实鼠标坐标」判定是否真的离开了 notebar：
      //   · barRef（球排本体）+ portalRootRef（portal 出去的气泡/缩略预览）都算"在栏内"。
      //   · 如果不把 portal 算进命中，用户 hover 到玻璃气泡时会被判离开 → 球排收起。
      if (barRef.current) {
        try {
          const { x, y } = lastMouseRef.current;
          if (x >= 0 && y >= 0) {
            const hit = document.elementFromPoint(x, y);
            if (elementLivesIn(hit, [barRef.current, portalRootRef.current])) return;
          }
        } catch {
          /* 异常时照常关，宁可关错也不要永远不关 */
        }
      }
      setIsOpen(false);
    }, 260);
    closeTimerRef.current = id;
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const handleBarEnter = useCallback(() => {
    cancelClose();
    setIsOpen(true);
  }, [cancelClose]);

  const handleBarLeave = useCallback((e: React.MouseEvent) => {
    const related = e.relatedTarget;
    // relatedTarget 仍在 notebar 子树内 → 是子元素间穿越（球→分隔条→tooltip 等）；
    // relatedTarget 落在 portal 出去的气泡上 → 视为"仍在栏内"，不触发 scheduleClose。
    // instanceof Node 守卫：鼠标甩出到浏览器 UI（React 会把 body/html 映射为 window）时
    // contains(window) 会抛 TypeError 且中断 scheduleClose → 栏被卡开；非 Node 一律按已离开处理。
    if (related instanceof Node) {
      if (e.currentTarget.contains(related)) return;
      if (portalRootRef.current && portalRootRef.current.contains(related)) return;
    }
    scheduleClose();
  }, [scheduleClose]);

  // 键盘无障碍：focus → 立即展开
  const handleBarFocus = useCallback(() => {
    cancelClose();
    setIsOpen(true);
  }, [cancelClose]);

  // ── 对话框：编辑器 + 管理窗口 ────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorNoteId, setEditorNoteId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  const openCreateEditor = useCallback(() => {
    // 新建笔记不在创建瞬间写入 store，用户点击"创建/保存"按钮时才真正 addNote
    setEditorNoteId(null);
    setEditorOpen(true);
  }, []);

  const openNoteEditor = useCallback((id: string) => {
    setEditorNoteId(id);
    setEditorOpen(true);
  }, []);

  const openManager = useCallback(() => {
    setManagerOpen(true);
  }, []);

  // ── Hover 气泡提示（两类：note 球的完整缩略预览 / peek、+、⚙︎、badge 等轻量文本气泡）
  //     统一用 synthetic id 管：`note:${noteId}` / `__peek__` / `__add__` / `__more__` / `__badge__` / `__tip_edit__`
  const [activeBallId, setActiveBallId] = useState<string | null>(null);
  const tooltipLeaveTimerRef = useRef<number | null>(null);

  const cancelTooltipHide = useCallback(() => {
    if (tooltipLeaveTimerRef.current !== null) {
      window.clearTimeout(tooltipLeaveTimerRef.current);
      tooltipLeaveTimerRef.current = null;
    }
  }, []);

  /** 把 synthetic id 解析为「锚点 DOM」：
   *    - note:* → 用 ballRefs；
   *    - 其他功能 id → 用独立 featureBallRefs。 */
  const resolveAnchor = useCallback((id: string): HTMLElement | null => {
    if (!id) return null;
    if (id.startsWith('note:')) return ballRefs.current.get(id.slice(5)) ?? null;
    return (featureBallRefs.current.get(id) as HTMLElement | null) ?? null;
  }, []);

  // 让 tooltip（position: fixed）锚定到对应球上方，箭头水平跟球中心对齐；
  // 做视口溢出保护（左/右/上）。
  const repositionTooltip = useCallback((synthId: string) => {
    const ball = resolveAnchor(synthId);
    const tip = tooltipRefs.current.get(synthId);
    if (!ball || !tip) return;
    const ballRect = ball.getBoundingClientRect();
    const tipWidth = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    const viewW = window.innerWidth || document.documentElement.clientWidth;
    const viewH = window.innerHeight || document.documentElement.clientHeight;
    // 间距要抵消球 hover 时的弹跳（translateY -8px + scale 1.18 ≈ 上移 15px，
    // 且定位发生在球的 280ms 过渡动画进行中，球仍在继续上移）→ 取 28px 余量。
    const gap = 28;
    const safe = 8;            // 视口边安全距

    const ballCenterX = ballRect.left + ballRect.width / 2;
    let leftPx = ballCenterX - tipWidth / 2;
    if (leftPx < safe) leftPx = safe;
    if (leftPx + tipWidth > viewW - safe) leftPx = Math.max(safe, viewW - tipWidth - safe);

    // tooltip 放在球上方，若上方空间不足 → 改放到球下方（并翻转箭头方向：下面会用到）
    let topPx = ballRect.top - tipHeight - gap;
    let placeAbove = true;
    if (topPx < safe) {
      placeAbove = false;
      topPx = ballRect.bottom + gap;
      if (topPx + tipHeight > viewH - safe) {
        topPx = Math.max(safe, viewH - tipHeight - safe);
      }
    }
    tip.style.left = `${leftPx}px`;
    tip.style.top = `${topPx}px`;

    // 箭头偏移：默认居中于 tooltip (50%)，再按球中心与 tooltip 中心偏差平移；
    // 同时把位置写到 data-place 属性，CSS 里可切换箭头朝向。
    const arrowShift = ballCenterX - (leftPx + tipWidth / 2);
    tip.style.setProperty('--tip-arrow-shift', `${arrowShift}px`);
    tip.dataset.place = placeAbove ? 'above' : 'below';
  }, [resolveAnchor]);

  const showTooltipFor = useCallback((id: string) => {
    cancelTooltipHide();
    const changing = id;
    setActiveBallId((cur) => {
      if (cur !== changing) return changing;
      return cur;
    });
    // 下一帧再定位（确保 tooltip DOM 已挂载 + 宽度计算准确）
    requestAnimationFrame(() => repositionTooltip(changing));
  }, [cancelTooltipHide, repositionTooltip]);

  const scheduleTooltipHide = useCallback(() => {
    if (tooltipLeaveTimerRef.current !== null) return;
    tooltipLeaveTimerRef.current = window.setTimeout(() => {
      tooltipLeaveTimerRef.current = null;
      setActiveBallId(null);
    }, 120);
  }, []);

  useEffect(() => () => {
    if (tooltipLeaveTimerRef.current !== null) {
      window.clearTimeout(tooltipLeaveTimerRef.current);
    }
  }, []);

  // 窗口 resize / 横向滚动时：当前激活 tooltip 重新定位
  useEffect(() => {
    if (!activeBallId) return;
    const handler = () => repositionTooltip(activeBallId);
    window.addEventListener('resize', handler);
    const row = rowRef.current;
    row?.addEventListener('scroll', handler, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => repositionTooltip(activeBallId));
      const ball = resolveAnchor(activeBallId);
      const tip = tooltipRefs.current.get(activeBallId);
      if (ball) ro.observe(ball);
      if (tip) ro.observe(tip);
    }
    return () => {
      window.removeEventListener('resize', handler);
      row?.removeEventListener('scroll', handler);
      ro?.disconnect();
    };
  }, [activeBallId, repositionTooltip, resolveAnchor]);

  // ── 拖拽重排（仅作用于 ballNotes 范围内的 8 个球） ────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'left' | 'right'>('right');

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, ballIndex: number) => {
    setDragIndex(ballIndex);
    setDragOverIndex(null);
    // 拖动过程中收起 tooltip，避免遮挡
    setActiveBallId(null);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(ballIndex)); } catch { /* noop */ }
    const src = e.currentTarget as HTMLElement;
    try {
      if (src) e.dataTransfer.setDragImage(src, src.offsetWidth / 2, src.offsetHeight / 2);
    } catch { /* noop */ }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, ballIndex: number) => {
    if (dragIndex === null || dragIndex === ballIndex) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const pos: 'left' | 'right' = e.clientX < midX ? 'left' : 'right';
    setDragOverIndex(ballIndex);
    setDragOverPosition(pos);
  }, [dragIndex]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>, ballIndex: number) => {
    const related = e.relatedTarget;
    if (related instanceof Node && e.currentTarget.contains(related)) return;
    if (dragOverIndex === ballIndex) setDragOverIndex(null);
  }, [dragOverIndex]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>, ballIndex: number) => {
    e.preventDefault();
    if (dragIndex === null) {
      setDragOverIndex(null);
      return;
    }
    const original = notes;
    const fromOrig = original.indexOf(ballNotes[dragIndex]);
    const overOrig = original.indexOf(ballNotes[ballIndex]);
    if (fromOrig < 0 || overOrig < 0) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const rawInsert = dragOverPosition === 'left' ? overOrig : overOrig + 1;
    if (fromOrig !== rawInsert) {
      reorderNotes(fromOrig, rawInsert);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, dragOverPosition, notes, ballNotes, reorderNotes]);

  // ── 点击球 → 直接打开编辑器 ───────────────────────────────────────────────
  const handleBallClick = useCallback((note: Note) => {
    openNoteEditor(note.id);
  }, [openNoteEditor]);

  const moreCount = Math.max(0, notes.length - MAX_NOTE_BALLS);

  // 上次 hover 过的 note id：当用户从 note 缩略预览移入「✏️ 编辑」micro 气泡时，
  // activeBallId 切到 __tip_edit__，但 note 缩略预览本体仍要保留在 DOM 里——
  // 否则「✏️ 编辑」按钮 (tip-btn-wrap 锚点) 会随父缩略预览 unmount → resolveAnchor 拿不到锚。
  const [lastActiveNoteId, setLastActiveNoteId] = useState<string | null>(null);
  // activeBallId 仍是 note:xxx 时同步记录本次 hover 的 note id。
  // 采用「渲染期间条件更新」（值不变时不重复 set），避免在 effect 里 setState 触发级联渲染。
  if (activeBallId?.startsWith('note:')) {
    const nextNoteId = activeBallId.slice(5);
    if (nextNoteId !== lastActiveNoteId) {
      setLastActiveNoteId(nextNoteId);
    }
  }
  const activeThumbNoteId: string | null = (() => {
    if (activeBallId?.startsWith('note:')) return activeBallId.slice(5);
    if (activeBallId === '__tip_edit__') return lastActiveNoteId;
    return null;
  })();
  const activeThumbNote: Note | null = useMemo(
    () => (activeThumbNoteId ? notes.find((n) => n.id === activeThumbNoteId) ?? null : null),
    [activeThumbNoteId, notes],
  );

  // 缩略预览悬浮卡身份色：绑定槽 → 槽当前色；旧数据静态解析；统一走解析后的内联变量
  const activeThumbColorMeta = activeThumbNote
    ? noteDisplayMeta(activeThumbNote, slots)
    : null;

  // 生成 peek 球 / + 球 / 管理球 的气泡提示文案
  const peekTipText = useMemo(
    () => notes.length > 0
      ? `${notes.length} 篇笔记 · 悬停展开笔记栏，点击立即新建`
      : '悬停展开笔记栏，点击立即新建笔记',
    [notes.length],
  );
  const badgeTipText = useMemo(
    () => `还有 ${moreCount} 篇不在此栏内，右侧 ⚙︎ 打开笔记管理器可查看全部`,
    [moreCount],
  );
  const editTipText = '在编辑器中打开笔记（全文查看、修改标题/颜色/内容、保存或删除）';

  /** 统一：synthetic id 激活 → 对应的 tooltip hide 处理；relatedTarget 仍在 tooltip 上不关闭。 */
  const handleSynthLeave = useCallback((synthId: string, e: React.MouseEvent | React.FocusEvent) => {
    const related = (e as React.MouseEvent).relatedTarget;
    const tipEl = tooltipRefs.current.get(synthId);
    if (tipEl && related instanceof Node && (tipEl === related || tipEl.contains(related))) return;
    scheduleTooltipHide();
  }, [scheduleTooltipHide]);

  // 打开后保证 peek 下 tooltip 的定位不会算到隐藏态的 row，这里在 isOpen 后也刷新一次。
  useEffect(() => {
    if (isOpen && activeBallId) {
      repositionTooltip(activeBallId);
    }
  }, [isOpen, activeBallId, repositionTooltip]);

  // Portal 渲染的悬浮层：bubble tips（peek / + / more / badge / edit）
  // + note 缩略预览本体。所有气泡统一 render 到 body，避免祖先 transform
  // 把 position:fixed 锁成 absolute relative 祖先 (CSS Transforms §3 containing-block)。
  const portalContent: React.ReactNode = (
    <div
      ref={(el) => { portalRootRef.current = el; }}
      className="nb-portal-root"
      aria-hidden={activeBallId === null}
    >
      {activeBallId === '__peek__' && (
        <div
          ref={(el) => { tooltipRefs.current.set('__peek__', el); }}
          className="nb-bubble-tip nb-bubble-tip--brand"
          onMouseEnter={() => { cancelTooltipHide(); showTooltipFor('__peek__'); }}
          onMouseLeave={scheduleTooltipHide}
        >
          <div className="nb-bubble-tip-arrow" aria-hidden="true" />
          <div className="nb-bubble-tip-title">便签球</div>
          <div className="nb-bubble-tip-text">{peekTipText}</div>
        </div>
      )}
      {activeBallId === '__add__' && (
        <div
          ref={(el) => { tooltipRefs.current.set('__add__', el); }}
          className="nb-bubble-tip nb-bubble-tip--add"
          onMouseEnter={() => { cancelTooltipHide(); showTooltipFor('__add__'); }}
          onMouseLeave={scheduleTooltipHide}
        >
          <div className="nb-bubble-tip-arrow" aria-hidden="true" />
          <div className="nb-bubble-tip-title">新建笔记</div>
          <div className="nb-bubble-tip-text">打开空白编辑器，填写标题与内容后点「保存」才会真正创建。</div>
        </div>
      )}
      {activeBallId === '__more__' && (
        <div
          ref={(el) => { tooltipRefs.current.set('__more__', el); }}
          className="nb-bubble-tip nb-bubble-tip--more"
          onMouseEnter={() => { cancelTooltipHide(); showTooltipFor('__more__'); }}
          onMouseLeave={scheduleTooltipHide}
        >
          <div className="nb-bubble-tip-arrow" aria-hidden="true" />
          <div className="nb-bubble-tip-title">笔记管理器</div>
          <div className="nb-bubble-tip-text">查看全部笔记、批量重排、重命名、调整颜色或删除。</div>
        </div>
      )}
      {activeBallId === '__badge__' && (
        <div
          ref={(el) => { tooltipRefs.current.set('__badge__', el); }}
          className="nb-bubble-tip nb-bubble-tip--micro nb-bubble-tip--badge"
          onMouseEnter={() => { cancelTooltipHide(); showTooltipFor('__badge__'); }}
          onMouseLeave={scheduleTooltipHide}
        >
          <div className="nb-bubble-tip-arrow" aria-hidden="true" />
          <div className="nb-bubble-tip-text">{badgeTipText}</div>
        </div>
      )}

      {activeThumbNote && (
        <div
          ref={(el) => { tooltipRefs.current.set(`note:${activeThumbNote.id}`, el); }}
          className="noteball-tooltip"
          style={activeThumbColorMeta?.style}
          onMouseEnter={() => { cancelTooltipHide(); showTooltipFor(`note:${activeThumbNote.id}`); }}
          onMouseLeave={scheduleTooltipHide}
        >
          <div className="noteball-tooltip-arrow" aria-hidden="true" />
          <div className="noteball-tooltip-header">
            <h4 aria-label={activeThumbNote.title || '无标题'}>
              {activeThumbNote.title || <em>无标题</em>}
            </h4>
          </div>
          <div className="noteball-tooltip-body">
            {activeThumbNote.content
              ? truncate(activeThumbNote.content, 140)
              : <em className="empty">（无内容）</em>
            }
          </div>
          <div className="noteball-tooltip-footer">
            <span className="noteball-tooltip-time">
              {activeThumbNote.updatedAt
                ? <>更新于 {new Date(activeThumbNote.updatedAt).toLocaleString()}</>
                : activeThumbNote.createdAt
                  ? <>创建于 {new Date(activeThumbNote.createdAt).toLocaleString()}</>
                  : null
              }
            </span>
            <div className="noteball-tooltip-actions">
              <span className="tip-btn-wrap"
                ref={(el) => { featureBallRefs.current.set('__tip_edit__', el); }}
                onMouseEnter={() => showTooltipFor('__tip_edit__')}
                onMouseLeave={(e) => handleSynthLeave('__tip_edit__', e)}
              >
                <button
                  type="button"
                  className="tip-btn open"
                  aria-label={editTipText}
                  onClick={(e) => {
                    e.stopPropagation();
                    openNoteEditor(activeThumbNote.id);
                    setActiveBallId(null);
                  }}
                >
                  编辑
                </button>
              </span>
            </div>
          </div>
        </div>
      )}

      {activeBallId === '__tip_edit__' && (
        <div
          ref={(el) => { tooltipRefs.current.set('__tip_edit__', el); }}
          className="nb-bubble-tip nb-bubble-tip--micro nb-bubble-tip--edit"
          onMouseEnter={() => { cancelTooltipHide(); showTooltipFor('__tip_edit__'); }}
          onMouseLeave={scheduleTooltipHide}
        >
          <div className="nb-bubble-tip-arrow" aria-hidden="true" />
          <div className="nb-bubble-tip-text">{editTipText}</div>
        </div>
      )}
    </div>
  );

  const portal = (typeof document !== 'undefined')
    ? createPortal(portalContent, document.body)
    : null;

  return (
    <>
      <div
        ref={barRef}
        className={'notebar' + (isOpen ? ' is-open' : '')}
        onMouseEnter={handleBarEnter}
        onMouseLeave={handleBarLeave}
        onFocus={handleBarFocus}
        role="toolbar"
        aria-label="笔记栏"
      >
        {/* 隐藏态下露出的单个便签球（一半在屏幕下方）；鼠标放上即弹出完整笔记栏 */}
        <button
          type="button"
          ref={(el) => { featureBallRefs.current.set('__peek__', el); }}
          className="notebar-peek-ball"
          onClick={openCreateEditor}
          onMouseEnter={() => { handleBarEnter(); showTooltipFor('__peek__'); }}
          onFocus={() => { handleBarEnter(); showTooltipFor('__peek__'); }}
          onMouseLeave={(e) => handleSynthLeave('__peek__', e)}
          onBlur={scheduleTooltipHide}
          aria-label={`便签（${notes.length} 篇）`}
        />

        <div className="notebar-inner">
          {/* 居中轨道：整排 +/分隔条/8 球/分隔条/⚙︎ 都在里面水平居中，像 macOS 状态栏图标 */}
          <div className="notebar-ball-track">
          {/* 左：+ 新建球 */}
          <button
            type="button"
            ref={(el) => { featureBallRefs.current.set('__add__', el); }}
            className="noteball feature add"
            onClick={openCreateEditor}
            onMouseEnter={() => showTooltipFor('__add__')}
            onFocus={() => showTooltipFor('__add__')}
            onMouseLeave={(e) => handleSynthLeave('__add__', e)}
            onBlur={scheduleTooltipHide}
            aria-label="新建笔记"
          >
            <span className="noteball-glyph">+</span>
          </button>

          <div className="notebar-sep" />

          {/* 中：最多 8 个笔记球（tooltip 已 portal 到 body，这里只渲染球本体） */}
          <div className="noteball-row" ref={rowRef} aria-label="便签球">
            {ballNotes.length === 0 && (
              <div className="notebar-empty-hint" aria-hidden="true">
                还没有笔记，点击左侧 <span className="mini-plus">+</span> 创建第一篇吧
              </div>
            )}
            {ballNotes.map((note, index) => {
              const { style: colorStyle } = noteDisplayMeta(note, slots);
              const synthId = `note:${note.id}`;
              const isDragging = dragIndex === index;
              const isDragOver = dragOverIndex === index;
              return (
                <div
                  key={note.id}
                  className="noteball-wrapper"
                >
                  <div
                    ref={(el) => { ballRefs.current.set(note.id, el); }}
                    className={`noteball note
                      ${isDragging ? 'dragging' : ''}
                      ${isDragOver && dragOverPosition === 'left' ? 'drop-left' : ''}
                      ${isDragOver && dragOverPosition === 'right' ? 'drop-right' : ''}
                    `}
                    style={colorStyle}
                    role="button"
                    tabIndex={0}
                    draggable
                    aria-label={`便签：${note.title || '无标题'}`}
                    onClick={() => handleBallClick(note)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleBallClick(note);
                      }
                    }}
                    onMouseEnter={() => showTooltipFor(synthId)}
                    onMouseLeave={(e) => handleSynthLeave(synthId, e)}
                    onFocus={() => showTooltipFor(synthId)}
                    onBlur={scheduleTooltipHide}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={(e) => handleDragLeave(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    data-note-id={note.id}
                  >
                    <span className="noteball-glyph">{firstGlyph(note.title)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="notebar-sep" />

          {/* 右：⚙︎ 管理球（带超出数量徽章） */}
          <button
            type="button"
            ref={(el) => { featureBallRefs.current.set('__more__', el); }}
            className="noteball feature more"
            onClick={openManager}
            onMouseEnter={() => showTooltipFor('__more__')}
            onFocus={() => showTooltipFor('__more__')}
            onMouseLeave={(e) => handleSynthLeave('__more__', e)}
            onBlur={scheduleTooltipHide}
            aria-label="笔记管理"
          >
            {moreCount > 0 && (
              <span
                ref={(el) => { featureBallRefs.current.set('__badge__', el); }}
                className="noteball-more-badge"
                onMouseEnter={(e) => { e.stopPropagation(); showTooltipFor('__badge__'); }}
                onMouseLeave={(e) => { e.stopPropagation(); handleSynthLeave('__badge__', e); }}
              >
                +{moreCount}
              </span>
            )}
            <span className="noteball-glyph">⚙︎</span>
          </button>
          </div>
        </div>
      </div>

      {portal}

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
      <NotesManagerDialog
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
      />
    </>
  );
};

export default NoteBar;
