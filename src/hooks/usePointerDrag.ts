import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * 统一的指针拖拽引擎（替代 HTML5 Drag & Drop）。
 *
 * 背景：HTML5 DnD 在触屏上完全不工作 —— 移动端浏览器不会从触摸生成 dragstart。
 * 因此把全部 7 个拖拽调用点统一切换到 Pointer Events，桌面与触屏共用一套代码。
 *
 * 手势分配（桌面 / 触屏差异化）：
 *  - 鼠标 / 手写笔：按下后位移超过 mouseThreshold 即起拖（与浏览器原生拖拽的手感一致）。
 *  - 触屏：长按 touchDelay（默认 500ms）起拖；长按窗口内先划走则判定为滚动，直接放弃手势。
 *    - 起拖后未移动即松手 → 交给 onLongPressTap：由调用方弹出上下文菜单
 *      （原来的 500ms 长按菜单改为「长按起拖，未移动松手弹菜单」，避免与起拖抢同一个手势）。
 *
 * 关键机制：
 *  - pointerdown 时挂「非 passive」的 document touchmove 监听：React 的 onTouchMove 是
 *    passive 的，无法 preventDefault，只有原生监听才能阻断拖拽期间的页面滚动。
 *  - 命中测试用 document.elementFromPoint + closest(属性选择器)，因此 drag ghost 必须
 *    pointer-events: none，否则它会挡住自己下方的投放目标。
 *  - onDragMove 按 rAF 节流；指针贴在滚动容器边缘时自动滚动（原生 DnD 自带的能力，
 *    换成 Pointer Events 后必须自己补）。
 *  - 手势结束后吞掉紧随其后的 click，否则松手会顺带打开图标链接。
 *  - 拖拽期间用 body.is-dragging-active 标记全局状态（既有 CSS 依赖它降 backdrop-filter）。
 */

/** 视口坐标点（与 clientX / clientY 同一坐标系）。 */
export interface DragPoint {
  x: number;
  y: number;
}

/** 一次命中测试的结果：投放目标的 key（对应 data-* 属性值）与承载该属性的元素。 */
export interface DragHit {
  key: string;
  el: HTMLElement;
}

export interface UsePointerDragOptions {
  /** 命中测试所用的属性名（不带方括号），默认 'data-drag-key' */
  hitAttribute?: string | undefined;
  /**
   * 命中兜底：把「目标之间的空隙」也算作相邻目标的投放区，默认关闭。
   *
   * 取值是承载这些目标的拖拽容器选择器（图标网格是 '.icon-grid'）。指针落在该容器内、
   * 却没有直接压在某个目标上时，取同一行里水平方向最近的那个目标（拖动源自己除外）——
   * 网格列宽由 1fr 均分，图标盒子只占其中一小块（还常被 justify-items: center 居中），
   * 图标之间会留下大片空隙，空隙里 elementFromPoint 只能拿到容器本身，
   * 没有兜底就完全排不动。
   * 迁到 Pointer Events 之前这块空间由 .icon-wrapper 两侧的 .icon-drop-zone-left/right
   * （各 50px）覆盖，迁移时被一并清理，排序的操作空间随之明显变小，因此这里补回来。
   *
   * 因为容器不会越过页面 / 窗口边界，指针离开容器（例如把图标拖出文件夹窗口）时
   * 命中照旧为 null，依赖 hit === null 的语义不受影响。
   */
  hitAreaSelector?: string | undefined;
  /**
   * 触屏长按起拖延时（ms），默认 500。
   * 这个值同时就是「长按」的判定阈值：长按到时即起拖，起拖后未移动就松手则回调
   * onLongPressTap 弹上下文菜单。因此原来那套独立的 500ms 长按 hook 必须让位给这里，
   * 否则同一个长按会被两套机制各触发一次。
   */
  touchDelay?: number | undefined;
  /** 起拖前的位移容差（px），默认 10。长按窗口内超出即放弃手势、放行页面滚动 */
  touchTolerance?: number | undefined;
  /** 鼠标 / 手写笔的起拖位移阈值（px），默认 4。避免纯点击被误判成拖拽 */
  mouseThreshold?: number | undefined;
  /** 是否绘制跟随指针的 ghost 浮层，默认 true */
  ghost?: boolean | undefined;
  /** 拖拽正式开始（鼠标越过阈值 / 触屏长按到时） */
  onDragStart: (key: string, point: DragPoint) => void;
  /** 拖拽中移动（已按 rAF 节流）；hit 为 null 表示指针下方没有可投放目标 */
  onDragMove: (hit: DragHit | null, point: DragPoint) => void;
  /** 松手投放 */
  onDragEnd: (hit: DragHit | null, point: DragPoint) => void;
  /** 长按已起拖、但松手前几乎没有移动：用于弹上下文菜单 */
  onLongPressTap?: ((key: string, point: DragPoint) => void) | undefined;
  /**
   * 拖拽已开始、但最终没有产生投放的终态回调：
   * Esc / pointercancel / 窗口失焦等异常中断，
   * 以及触屏「长按起拖后原地松手改为弹菜单」——后者也需要调用方复位拖拽状态。
   */
  onDragCancel?: (() => void) | undefined;
  /**
   * 该 key 此刻是否允许起拖，默认全部允许。
   * 用于「编辑态 / 删除确认中 / 搜索结果过滤态下禁止拖拽」这类逐项判断：
   * 必须在 pointerdown 就拦掉，否则会话已经建好，再取消会白闪一次 ghost。
   */
  canStart?: ((key: string) => boolean) | undefined;
  /** 是否禁用拖拽 */
  disabled?: boolean | undefined;
}

/** 挂到拖拽把手元素上的 props。 */
export interface DragHandleProps {
  onPointerDown: (e: ReactPointerEvent) => void;
}

interface DragSession {
  key: string;
  pointerId: number;
  pointerType: string;
  sourceEl: HTMLElement;
  /** 拖拽期间自动滚动所作用的最近可滚动祖先 */
  scrollEl: HTMLElement | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** 触屏长按计时器 */
  delayTimer: number | null;
  /** 是否已进入拖拽状态：此时才画 ghost、才阻断滚动、才派发 onDragMove */
  active: boolean;
  /** 起拖瞬间的指针位置，用于判断「长按后有没有真的移动」 */
  activeX: number;
  activeY: number;
  ghost: HTMLElement | null;
  /** 指针相对 ghost 左上角的偏移，保证 ghost 跟手而不是跳到指针中心 */
  ghostOffsetX: number;
  ghostOffsetY: number;
  rafId: number | null;
}

/** 自动滚动触发区宽度（px） */
const AUTO_SCROLL_EDGE = 60;
/** 自动滚动每帧最大位移（px） */
const AUTO_SCROLL_MAX_SPEED = 14;

const autoScrollSpeed = (distanceIntoEdge: number): number =>
  Math.min(
    AUTO_SCROLL_MAX_SPEED,
    Math.max(1, (distanceIntoEdge / AUTO_SCROLL_EDGE) * AUTO_SCROLL_MAX_SPEED),
  );

/** 从元素向上找最近的、当前真的可以滚动的祖先容器。 */
function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = window.getComputedStyle(node);
    const canScrollY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight;
    const canScrollX =
      (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth;
    if (canScrollY || canScrollX) return node;
    node = node.parentElement;
  }
  return null;
}

export function usePointerDrag(options: UsePointerDragOptions) {
  // 回调与配置统一放 ref：document 级监听只注册一次，不需要因 props 变化反复解绑重绑
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sessionRef = useRef<DragSession | null>(null);
  const autoScrollActiveRef = useRef(false);
  const autoScrollRafRef = useRef<number | null>(null);
  const clickGuardTimerRef = useRef<number | null>(null);
  /** 当前 click 守卫的摘除函数：安装新守卫 / 组件卸载时必须先摘掉旧的 */
  const clickGuardCleanupRef = useRef<(() => void) | null>(null);

  /** 命中测试：把视口坐标翻译成投放目标 */
  const resolveHit = useCallback((x: number, y: number): DragHit | null => {
    if (typeof document === 'undefined') return null;
    const attr = optionsRef.current.hitAttribute ?? 'data-drag-key';
    const pointed = document.elementFromPoint(x, y);
    if (!pointed) return null;
    const matched = pointed.closest(`[${attr}]`);
    if (matched instanceof HTMLElement) {
      const key = matched.getAttribute(attr);
      return key ? { key, el: matched } : null;
    }

    // 二级命中：指针落在目标之间的空隙里（网格 gap、留白）——
    // 迁移前这些位置由 .icon-drop-zone-left/right 覆盖，详见 hitAreaSelector 的说明。
    const areaSelector = optionsRef.current.hitAreaSelector;
    if (!areaSelector) return null;
    const area = pointed.closest(areaSelector);
    if (!(area instanceof HTMLElement)) return null;
    const sourceKey = sessionRef.current?.key ?? null;
    let bestKey: string | null = null;
    let bestEl: HTMLElement | null = null;
    let bestDist = Infinity;
    // 候选只在拖拽容器内部查：容器之外即便有别的同名目标（被覆盖住的另一片网格）也不算
    area.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
      const key = el.getAttribute(attr);
      // 拖动源自己不算投放目标：否则图标两侧那半个空隙都会被它自己占掉，
      // 高亮要等指针跨过空隙中点才出现，手感上像是「拖了没反应」
      if (!key || key === sourceKey) return;
      const rect = el.getBoundingClientRect();
      // 垂直方向仍要求指针落在目标自身范围内：行与行之间的空隙没有明确归属，
      // 硬塞给上一行或下一行都会让人分不清会插到哪里去
      if (y < rect.top || y > rect.bottom) return;
      // 空隙本身没有元素可压，用「水平方向离谁更近」决定归属：
      // 相当于把两图标之间的整段空隙从正中一分为二，比旧的固定 50px 拖放带更好操作
      const dist = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      if (dist >= bestDist) return;
      bestKey = key;
      bestEl = el;
      bestDist = dist;
    });
    return bestKey && bestEl ? { key: bestKey, el: bestEl } : null;
  }, []);

  /** 手势结束后吞掉紧随其后的 click：否则松手会顺带触发图标的打开链接 */
  const suppressNextClick = useCallback(() => {
    if (typeof document === 'undefined') return;
    // 先摘掉上一次尚未失效的守卫：旧的 swallow 监听留在 capture 阶段会吞掉用户
    // 之后的一次点击（表现为「点了没反应」）
    clickGuardCleanupRef.current?.();

    function cleanup() {
      document.removeEventListener('click', swallow, true);
      if (clickGuardCleanupRef.current === cleanup) {
        clickGuardCleanupRef.current = null;
      }
      if (clickGuardTimerRef.current !== null) {
        clearTimeout(clickGuardTimerRef.current);
        clickGuardTimerRef.current = null;
      }
    }
    function swallow(ev: MouseEvent) {
      ev.preventDefault();
      ev.stopPropagation();
      cleanup();
    }
    document.addEventListener('click', swallow, true);
    clickGuardCleanupRef.current = cleanup;
    // 兜底：某些手势（如拖出窗口松手）之后不一定派发 click，超时后必须自行摘掉，
    // 否则会吞掉用户下一次无关的点击
    clickGuardTimerRef.current = window.setTimeout(cleanup, 400);
  }, []);

  const stopAutoScroll = useCallback(() => {
    autoScrollActiveRef.current = false;
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  }, []);

  const removeGhost = useCallback((session: DragSession) => {
    if (session.ghost && session.ghost.parentNode) {
      session.ghost.parentNode.removeChild(session.ghost);
    }
    session.ghost = null;
  }, []);

  const flushRef = useRef<(() => void) | null>(null);

  /** 边缘自动滚动：指针停在滚动容器上下/左右边缘时持续滚动，并重算命中目标 */
  const autoScrollStep = useCallback(() => {
    autoScrollRafRef.current = null;
    const session = sessionRef.current;
    if (!session || !session.active || !session.scrollEl) {
      autoScrollActiveRef.current = false;
      return;
    }
    const el = session.scrollEl;
    const rect = el.getBoundingClientRect();
    let dx = 0;
    let dy = 0;

    if (el.scrollHeight > el.clientHeight) {
      if (session.lastY < rect.top + AUTO_SCROLL_EDGE) {
        dy = -autoScrollSpeed(rect.top + AUTO_SCROLL_EDGE - session.lastY);
      } else if (session.lastY > rect.bottom - AUTO_SCROLL_EDGE) {
        dy = autoScrollSpeed(session.lastY - (rect.bottom - AUTO_SCROLL_EDGE));
      }
    }
    if (el.scrollWidth > el.clientWidth) {
      if (session.lastX < rect.left + AUTO_SCROLL_EDGE) {
        dx = -autoScrollSpeed(rect.left + AUTO_SCROLL_EDGE - session.lastX);
      } else if (session.lastX > rect.right - AUTO_SCROLL_EDGE) {
        dx = autoScrollSpeed(session.lastX - (rect.right - AUTO_SCROLL_EDGE));
      }
    }

    if (dx === 0 && dy === 0) {
      autoScrollActiveRef.current = false;
      return;
    }

    el.scrollBy(dx, dy);
    // 容器滚过之后，指针下方的目标换了，必须重算一次命中
    flushRef.current?.();
    // 自引用：帧回调要到下一帧才执行，此时 autoScrollStep 早已初始化
    // eslint-disable-next-line react-hooks/immutability
    autoScrollRafRef.current = requestAnimationFrame(autoScrollStep);
  }, []);

  const ensureAutoScroll = useCallback(() => {
    if (autoScrollActiveRef.current) return;
    const session = sessionRef.current;
    if (!session || !session.active || !session.scrollEl) return;
    autoScrollActiveRef.current = true;
    autoScrollRafRef.current = requestAnimationFrame(autoScrollStep);
  }, [autoScrollStep]);

  const updateGhostPosition = useCallback((session: DragSession) => {
    if (!session.ghost) return;
    const x = Math.round(session.lastX - session.ghostOffsetX);
    const y = Math.round(session.lastY - session.ghostOffsetY);
    session.ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const flush = useCallback(() => {
    const session = sessionRef.current;
    if (!session || !session.active) return;
    session.rafId = null;
    updateGhostPosition(session);
    const point: DragPoint = { x: session.lastX, y: session.lastY };
    optionsRef.current.onDragMove(resolveHit(point.x, point.y), point);
    ensureAutoScroll();
  }, [ensureAutoScroll, resolveHit, updateGhostPosition]);
  flushRef.current = flush;

  const scheduleFlush = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.rafId !== null) return;
    session.rafId = requestAnimationFrame(() => {
      const current = sessionRef.current;
      if (!current) return;
      current.rafId = null;
      flush();
    });
  }, [flush]);

  /** 创建跟随指针的浮层。克隆源元素能天然保留图标/列表行的外观，
   *  同时清掉 id 与 data-*，避免污染命中测试与 document.getElementById。 */
  const createGhost = useCallback((sourceEl: HTMLElement, offsetX: number, offsetY: number) => {
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.classList.add('drag-ghost');
    clone.removeAttribute('id');
    clone.removeAttribute('draggable');
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    clone.style.position = 'fixed';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.margin = '0';
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '9999';
    clone.style.willChange = 'transform';
    clone.style.transform = `translate3d(${Math.round(rect.left)}px, ${Math.round(rect.top)}px, 0)`;
    document.body.appendChild(clone);
    // 偏移量照抄初始位置，第一次移动时才用指针位置覆盖
    void offsetX;
    void offsetY;
    return clone;
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      session.lastX = e.clientX;
      session.lastY = e.clientY;

      if (!session.active) {
        const dist = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
        if (session.pointerType === 'mouse' || session.pointerType === 'pen') {
          if (dist > (optionsRef.current.mouseThreshold ?? 4)) {
            // 前向引用安全：这些函数是 useCallback，本回调只在事件触发时执行，
            // 届时整段 hook 函数体早已跑完，const 均已初始化。
            // eslint-disable-next-line react-hooks/immutability
            activateSession(session, { x: e.clientX, y: e.clientY });
          }
          return;
        }
        // 触屏：长按计时器还没到就划走了 → 判定为滚动，放弃本次手势
        if (dist > (optionsRef.current.touchTolerance ?? 10)) {
          // eslint-disable-next-line react-hooks/immutability
          finishSession(true);
        }
        return;
      }

      scheduleFlush();
    },
    // activateSession / finishSession 通过 ref 间接引用，避免循环依赖
    [scheduleFlush],
  );

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const session = sessionRef.current;
    if (!session || e.pointerId !== session.pointerId) return;
    session.lastX = e.clientX;
    session.lastY = e.clientY;
    finishSession(false);
  }, []);

  const handlePointerCancel = useCallback((e: PointerEvent) => {
    const session = sessionRef.current;
    if (!session || e.pointerId !== session.pointerId) return;
    finishSession(true);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    finishSession(true);
  }, []);

  const handleWindowBlur = useCallback(() => {
    finishSession(true);
  }, []);

  /** 非 passive 的 touchmove：拖拽期间阻断页面滚动（React 的 onTouchMove 是 passive，做不到） */
  const handleTouchMove = useCallback((e: TouchEvent) => {
    const session = sessionRef.current;
    if (!session || !session.active) return;
    if (e.cancelable) e.preventDefault();
  }, []);

  // activateSession / finishSession 需要在多个 useCallback 之间互相引用，
  // 用 ref 持有实现，彻底绕开「回调依赖顺序」问题，同时保证监听函数引用稳定
  const activateRef = useRef<((session: DragSession, point: DragPoint) => void) | null>(null);
  const finishRef = useRef<((cancelled: boolean) => void) | null>(null);

  function activateSession(session: DragSession, point: DragPoint) {
    activateRef.current?.(session, point);
  }
  function finishSession(cancelled: boolean) {
    finishRef.current?.(cancelled);
  }

  const bindListeners = useCallback(() => {
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('blur', handleWindowBlur);
  }, [
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyDown,
    handleTouchMove,
    handleWindowBlur,
  ]);

  const unbindListeners = useCallback(() => {
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerCancel);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('blur', handleWindowBlur);
  }, [
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyDown,
    handleTouchMove,
    handleWindowBlur,
  ]);

  finishRef.current = (cancelled: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    unbindListeners();

    if (session.delayTimer !== null) {
      clearTimeout(session.delayTimer);
      session.delayTimer = null;
    }
    if (session.rafId !== null) {
      cancelAnimationFrame(session.rafId);
      session.rafId = null;
    }
    stopAutoScroll();
    removeGhost(session);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('is-dragging-active');
    }

    if (!session.active) {
      // 手势从未真正开始（快速点按 / 划走滚动），交给浏览器原生的 click 处理
      return;
    }

    const opts = optionsRef.current;
    if (cancelled) {
      opts.onDragCancel?.();
      return;
    }

    const point: DragPoint = { x: session.lastX, y: session.lastY };
    const tolerance = opts.touchTolerance ?? 10;
    const moved =
      Math.hypot(point.x - session.activeX, point.y - session.activeY) > tolerance;

    // 触屏长按起拖后基本没动就松手 —— 同一个长按手势两用。
    if (!moved && session.pointerType === 'touch') {
      if (opts.onLongPressTap) {
        // 有菜单回调：这次手势的终态是「弹菜单」而不是投放，必须回调一次 onDragCancel
        // 让调用方复位拖拽状态（源元素 .dragging / draggedIcon 等）。
        // 否则长按弹菜单、再点空白关闭菜单后，图标会永远停在"已拿起"的样式与状态里
        opts.onDragCancel?.();
        // 吞掉这次松手产生的 click，否则会顺带打开链接
        suppressNextClick();
        opts.onLongPressTap(session.key, { x: session.activeX, y: session.activeY });
        return;
      }
      // 没有菜单回调（列表排序等）：当作普通点按，不能吞 click，
      // 但仍要派发 onDragEnd —— 否则调用方的「拖动中」视觉状态会永远留在元素上
      opts.onDragEnd(resolveHit(point.x, point.y), point);
      return;
    }

    suppressNextClick();
    opts.onDragEnd(resolveHit(point.x, point.y), point);
  };

  activateRef.current = (session: DragSession, point: DragPoint) => {
    if (session.active) return;
    const opts = optionsRef.current;
    session.active = true;
    session.activeX = point.x;
    session.activeY = point.y;

    // 先把 ghost 克隆出来，再派发 onDragStart —— 否则源元素已经带上 .dragging
    // 的淡化/缩放样式，ghost 会跟着一起变淡
    if (opts.ghost !== false && typeof document !== 'undefined') {
      const rect = session.sourceEl.getBoundingClientRect();
      session.ghostOffsetX = point.x - rect.left;
      session.ghostOffsetY = point.y - rect.top;
      session.ghost = createGhost(session.sourceEl, session.ghostOffsetX, session.ghostOffsetY);
      updateGhostPosition(session);
    }

    // 标记 body 进入全局拖拽状态：既有 CSS 依赖它降低 backdrop-filter 强度、
    // 关闭图标 hover 放大/闪烁动画，避免大量合成层叠加导致 GPU OOM
    if (typeof document !== 'undefined') {
      document.body.classList.add('is-dragging-active');
    }

    opts.onDragStart(session.key, point);
    scheduleFlush();
  };

  const startPress = useCallback(
    (key: string, e: ReactPointerEvent) => {
      const opts = optionsRef.current;
      if (opts.disabled) return;
      if (opts.canStart && !opts.canStart(key)) return;
      if (sessionRef.current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const sourceEl = e.currentTarget as HTMLElement | null;
      if (!sourceEl) return;

      const session: DragSession = {
        key,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        sourceEl,
        scrollEl: findScrollContainer(sourceEl),
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        delayTimer: null,
        active: false,
        activeX: e.clientX,
        activeY: e.clientY,
        ghost: null,
        ghostOffsetX: 0,
        ghostOffsetY: 0,
        rafId: null,
      };
      sessionRef.current = session;
      bindListeners();

      // 鼠标 / 手写笔：等位移越过阈值再起拖，纯点击不进入拖拽
      if (e.pointerType !== 'touch') return;

      // 触屏：长按起拖。计时器到点即进入拖拽；若中途划走，pointermove 里会直接放弃
      session.delayTimer = window.setTimeout(() => {
        session.delayTimer = null;
        if (sessionRef.current !== session) return;
        activateSession(session, { x: session.lastX, y: session.lastY });
      }, opts.touchDelay ?? 500);
    },
    [bindListeners],
  );

  // 卸载兜底：会话没走完就被卸载（如拖拽中文件夹窗口被关闭）时必须清理干净
  useEffect(() => {
    return () => {
      const session = sessionRef.current;
      if (session) {
        if (session.delayTimer !== null) clearTimeout(session.delayTimer);
        if (session.rafId !== null) cancelAnimationFrame(session.rafId);
        removeGhost(session);
        sessionRef.current = null;
      }
      unbindListeners();
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      autoScrollActiveRef.current = false;
      // 摘掉可能还挂着的 click 守卫（连同它的兜底定时器）
      clickGuardCleanupRef.current?.();
      if (clickGuardTimerRef.current !== null) {
        clearTimeout(clickGuardTimerRef.current);
        clickGuardTimerRef.current = null;
      }
      if (
        typeof document !== 'undefined' &&
        document.body.classList.contains('is-dragging-active')
      ) {
        document.body.classList.remove('is-dragging-active');
      }
    };
  }, [removeGhost, unbindListeners]);

  // 每个 key 复用同一个 props 对象：IconGrid / 列表行的 React.memo 不会被新函数击穿
  const handlePropsCacheRef = useRef(new Map<string, DragHandleProps>());
  const startPressRef = useRef(startPress);
  startPressRef.current = startPress;

  const getDragHandleProps = useCallback((key: string): DragHandleProps => {
    const cache = handlePropsCacheRef.current;
    let props = cache.get(key);
    if (!props) {
      props = {
        onPointerDown: (e: ReactPointerEvent) => startPressRef.current(key, e),
      };
      cache.set(key, props);
    }
    return props;
  }, []);

  return { getDragHandleProps };
}
