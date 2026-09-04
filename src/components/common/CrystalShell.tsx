import React from 'react';

/**
 * 水晶图标块的光效层集合（站点图标 / 文件夹图标共用）
 * 对应 samples/Crystal_block.html 中的 .breathe-glow（呼吸发光层）、
 * .crystal-folder（彩色玻璃基底，.cc-glass）以及 ::before 左上柔光、
 * ::after 右下暗部，全部平铺为 .cc-* 子元素，
 * 由 IconItem.css 内的 .icon-circle > .cc-* 规则驱动。
 * 必须是 .icon-circle 的第一个子节点（层级自低到高排列）。
 */
const CrystalShell: React.FC = () => (
  <>
    <span className="cc-layer cc-aura" aria-hidden="true" />
    <span className="cc-layer cc-glass" aria-hidden="true" />
    <span className="cc-layer cc-highlight" aria-hidden="true" />
    <span className="cc-layer cc-texture" aria-hidden="true" />
  </>
);

export default CrystalShell;
