import React from 'react';
import './PeekBall.css';
import type { FeatureDockEntry } from '../../store/useFeatureDockStore';

/**
 * 共享入口球（Peek Ball）——纯呈现组件，与任何功能组件零耦合。
 *
 * · 内容（glyph/label/badge/身份色）来自功能宿主注册的 FeatureDockEntry；
 * · 工作参数（放置位置/呈现方式/交互方式）由主界面 FeatureDock 通过 slot 传入。
 * 视觉统一为“水晶球”：六层渐变 + 内壁折射 + 底部身份色光（samples/CrystalBall.html 方法）。
 */

export type PeekPlacement = 'left-center' | 'right-center' | 'bottom-center';
export type PeekPresentation = 'panel-slide' | 'bar-reveal';
export type PeekInteraction = 'click-toggle' | 'hover-open';

export interface PeekSlot {
  /** 放置位置 */
  placement: PeekPlacement;
  /** 呈现方式：面板滑入（侧边球贴边+旋转）/ 底部栏升起（打开后入口球淡出隐藏） */
  presentation: PeekPresentation;
  /** 交互方式：点击切换 / 悬停展开 */
  interaction: PeekInteraction;
}

interface PeekBallProps {
  entry: FeatureDockEntry;
  slot: PeekSlot;
  /** 功能面板当前是否打开（驱动 is-active 视觉） */
  active: boolean;
  /** 打开（hover-open / 点击兜底） */
  onOpen: () => void;
  /** 点击切换（click-toggle） */
  onToggle: () => void;
}

const PeekBall: React.FC<PeekBallProps> = ({ entry, slot, active, onOpen, onToggle }) => {
  const { placement, presentation, interaction } = slot;
  const isHover = interaction === 'hover-open';

  const handleClick = () => {
    if (isHover) {
      onOpen();
    } else {
      onToggle();
    }
  };
  const handleHoverStart = () => {
    if (isHover) onOpen();
  };
  const handleHoverEnd = () => {
    if (isHover) entry.onHoverEnd?.();
  };

  const className = [
    'peek-ball',
    `peek-ball--${placement}`,
    `peek-ball--${presentation}`,
    active ? 'is-active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--tint': entry.tint,
    '--tint-2': entry.tint2,
  } as React.CSSProperties;

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={handleClick}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      onFocus={handleHoverStart}
      onBlur={handleHoverEnd}
      aria-label={entry.label}
      aria-expanded={active}
    >
      <span className="peek-ball__tooltip" role="tooltip" aria-hidden="true">
        {entry.label}
      </span>
      <span className="peek-ball__orb" aria-hidden="true">
        <span className="peek-ball__glyph">{entry.glyph}</span>
        {entry.badge != null && entry.badge !== '' && (
          <span className="peek-ball__badge">{entry.badge}</span>
        )}
      </span>
    </button>
  );
};

export default PeekBall;
