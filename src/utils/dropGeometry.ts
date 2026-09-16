/**
 * 拖放落点几何：把「指针坐标 + 目标元素矩形」翻译成落点语义。
 *
 * 抽成纯函数的原因：迁移到 Pointer Events 后不再有 dragover/drop 事件里的
 * currentTarget，落点只能靠 elementFromPoint + getBoundingClientRect 自己算，
 * 于是「算落点」这件事从各调用点的事件回调里被抽了出来，必须逐字保留原有分界规则，
 * 否则拖拽手感会变。
 */

/** 一维列表落点：目标元素中线之前为 before，之后为 after。 */
export type ListDropPosition = 'before' | 'after';

/**
 * 一维列表落点。
 * @param axis 'y' 用于纵向列表（页面、便签、搜索源），'x' 用于横向列表（便签球）。
 */
export function computeListDropPosition(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  axis: 'x' | 'y',
): ListDropPosition {
  if (axis === 'x') {
    return clientX < rect.left + rect.width / 2 ? 'before' : 'after';
  }
  return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

/** 网格落点区域。 */
export type GridDropZone = 'before' | 'after' | 'center';

/**
 * 网格落点：左右各 25% 分别判为 before / after，中间 50% 统一返回 center，
 * 由调用方再依据「是否允许中心投放」决定最终是 center 还是 invalid。
 * 与迁移前 handleDragOverIcon 的分界规则完全一致，保证手感不变。
 *
 * 注意：这个 25% / 75% 只描述「指针落在图标盒子内」时的分区。图标盒子之外
 * （图标与图标之间的空隙）不在图标盒子里，必然落在分界之外，会自然判为 before / after，
 * 无需另行处理；空隙本身能否命中由命中测试的 hitAreaSelector 负责（见 usePointerDrag）。
 */
export function computeGridDropZone(rect: DOMRect, clientX: number): GridDropZone {
  const x = clientX - rect.left;
  if (x < rect.width * 0.25) return 'before';
  if (x >= rect.width * 0.75) return 'after';
  return 'center';
}

/** 指针是否已离开矩形（用于「拖出文件夹窗口」判定）。 */
export function isPointerOutsideRect(
  rect: DOMRect,
  clientX: number,
  clientY: number,
): boolean {
  return (
    clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom
  );
}
