import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import './SettingsWindow.css';

interface SettingsWindowProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  isClosing?: boolean;
  onClosingComplete?: () => void;
}

interface SettingsWindowRef {
  handleClose: () => void;
}

const ANIMATION_DURATION = 260; // 与 SettingsWindow.css 中 @keyframes duration 严格对齐

const SettingsWindow = forwardRef<SettingsWindowRef, SettingsWindowProps>(({
  title,
  onClose,
  children,
  isClosing = false,
  onClosingComplete,
}, ref) => {
  const [localIsClosing, setLocalIsClosing] = useState<boolean>(isClosing);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false); // 防重复调用 onClose / onClosingComplete

  /* 组件卸载清理定时器与已完成标记 */
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      closedRef.current = false;
    };
  }, []);

  /* ── 外部命令式关（齿轮按钮 toggle、父 isOpen 变 false 等）
        父传 isClosing=true → 本地状态直接跟随（挂上 settings-panel-closing 类
        → @keyframes settingsSlideOut 从第一帧开始播）。
        用「渲染期间条件更新」同步（值未变化时不重复 set），
        避免在 effect 里 setState 触发级联渲染。 */
  if (isClosing && !localIsClosing) {
    setLocalIsClosing(true);
  }

  /* ── 关闭完成通知（单例：只触发一次）
        必须在滑出动画最后一帧播完后调用，保证视觉过渡完整 → 父卸载。
        双保险：① onAnimationEnd 监听 slideOut 动画完成（最准确）；
               ② setTimeout(ANIMATION_DURATION + 20ms)（兜底防浏览器动画事件不触发）。 */
  const finishClosing = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onClose();
    onClosingComplete?.();
  }, [onClose, onClosingComplete]);

  /* 兜底定时器：即使 onAnimationEnd 未触发，动画到时也强制推进 */
  useEffect(() => {
    if (!localIsClosing) return;
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      finishClosing();
    }, ANIMATION_DURATION + 20);
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [localIsClosing, finishClosing]);

  /* 用户主动关（✕ 按钮 / overlay 点空白 / ESC 键） */
  const handleClose = useCallback(() => {
    if (localIsClosing || closedRef.current) return;
    setLocalIsClosing(true);
  }, [localIsClosing]);

  /* 键盘 ESC 关 */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  useImperativeHandle(ref, () => ({ handleClose }));

  /* 动画完成事件：只对 panel 的 slideOut（closing）生效；overlay 淡出同步完成
     React 动画事件名小驼峰：onAnimationEnd（对应原生 animationend） */
  const handlePanelAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (!localIsClosing) return;
      // 只匹配滑出动画名（SettingsWindow.css 的 @keyframes settingsSlideOut），
      // 避免滑入动画 settingsSlideIn 的完成事件也触发关窗。
      if (e.animationName === 'settingsSlideOut') {
        finishClosing();
      }
    },
    [localIsClosing, finishClosing],
  );

  return (
    <>
      {/* Overlay：稳定带 .settings-overlay-open（淡入终态可见 opacity=1）
          关闭时叠加 .settings-overlay-closing → @keyframes settingsFadeOut 同步淡出 */}
      <div
        className={`settings-overlay settings-overlay-open ${localIsClosing ? 'settings-overlay-closing' : ''}`}
        onClick={handleClose}
      />
      {/* Panel：稳定带 .settings-panel-open（滑入终态 translateX(0)，可见）
          关闭时叠加 .settings-panel-closing → @keyframes settingsSlideOut 从 0→100% 滑出。
          用 ref 监听 animationend 确认动画播完再推进关窗（时间 100% 对齐）。 */}
      <div
        ref={panelRef}
        className={`settings-panel settings-panel-open ${localIsClosing ? 'settings-panel-closing' : ''}`}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        <div className="panel-header">
          <h2>{title}</h2>
          <button className="back-button" onClick={handleClose}>
            ✕
          </button>
        </div>
        {/* 内容滚动区：面板本身不滚动（左侧装饰亮线锚定在固定高度的面板上），
            内容超高时仅此区域滚动，亮线始终铺满整条侧边栏 */}
        <div className="settings-scroll">{children}</div>
      </div>
    </>
  );
});

SettingsWindow.displayName = 'SettingsWindow';

export default SettingsWindow;
