import React from 'react';
import './HintTip.css';

/* ════════════════════════════════════════════════════════════════
   问号提示（HintTip）
   用途：设置面板里较长的说明文案不再平铺在标题旁，改为一个 18px 的问号徽标，
   悬停/键盘聚焦时才浮出玻璃提示气泡（与 EditWebsite 的字段说明同一套观感）。
   - 徽标 tabIndex=0：键盘可达；aria-label 为完整说明，供读屏器直接朗读
   - 气泡 aria-hidden：避免同一段文案被读两遍
   ════════════════════════════════════════════════════════════════ */

interface HintTipProps {
  /** 提示正文（已翻译） */
  text: string;
  /** 附加类名，便于调用方微调定位 */
  className?: string;
}

const HintTip: React.FC<HintTipProps> = ({ text, className }) => (
  <span className={`hint-tip-wrapper${className ? ` ${className}` : ''}`}>
    <span className="hint-tip" tabIndex={0} aria-label={text}>?</span>
    <span className="hint-tip-bubble" aria-hidden="true">{text}</span>
  </span>
);

export default HintTip;