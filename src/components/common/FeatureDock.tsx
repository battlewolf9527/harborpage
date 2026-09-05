import React from 'react';
import PeekBall, { type PeekSlot } from './PeekBall';
import {
  useFeatureDockStore,
  type FeatureId,
} from '../../store/useFeatureDockStore';

/**
 * 宿主 Dock：倒置依赖的「宿主侧」消费点。
 *
 * · 槽位表由主界面决定：哪个功能占哪个位置、怎么呈现、怎么交互 ——
 *   即 PeekBall 的「工作参数」（放置位置 / 呈现方式 / 交互方式）；
 * · 功能组件只负责注册内容描述（glyph/label/badge/身份色/悬停回调），
 *   本组件不 import 任何功能组件，只消费注册表 entries → 真正的依赖倒置；
 * · 功能未挂载（开关关闭 / 未登录）→ 注册表里没有 entry → 该槽自动不渲染，
 *   无需在这里维护任何开关；功能卸载时注册中心自动注销并清理 open 状态。
 */
const DOCK_SLOTS: ReadonlyArray<{ id: FeatureId; slot: PeekSlot }> = [
  {
    id: 'pages',
    slot: { placement: 'left-center', presentation: 'panel-slide', interaction: 'click-toggle' },
  },
  {
    id: 'todos',
    slot: { placement: 'right-center', presentation: 'panel-slide', interaction: 'click-toggle' },
  },
  {
    id: 'notes',
    slot: { placement: 'bottom-center', presentation: 'bar-reveal', interaction: 'hover-open' },
  },
];

const FeatureDock: React.FC = () => {
  const entries = useFeatureDockStore((s) => s.entries);
  const openMap = useFeatureDockStore((s) => s.open);
  const toggle = useFeatureDockStore((s) => s.toggle);
  const setOpen = useFeatureDockStore((s) => s.setOpen);

  return (
    <>
      {DOCK_SLOTS.map(({ id, slot }) => {
        const entry = entries[id];
        if (!entry) return null;
        const active = !!openMap[id];
        return (
          <PeekBall
            key={id}
            entry={entry}
            slot={slot}
            active={active}
            onOpen={() => setOpen(id, true)}
            onToggle={() => toggle(id)}
          />
        );
      })}
    </>
  );
};

export default FeatureDock;
