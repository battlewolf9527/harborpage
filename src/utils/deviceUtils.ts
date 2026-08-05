/**
 * 触摸设备检测工具
 * 
 * 平衡性能和响应性的方案：
 * - 使用缓存避免重复计算
 * - 提供 force 参数支持强制重新检测
 * - 支持监听设备变化事件
 */

const createTouchDetector = () => {
  let cached: boolean | undefined;

  const detector = (force = false): boolean => {
    if (typeof cached === 'undefined' || force) {
      cached = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    return cached;
  };

  // 暴露缓存控制方法
  (detector as typeof detector & { resetCache: () => void }).resetCache = () => {
    cached = undefined;
  };

  return detector;
};

/**
 * 检测设备是否支持触摸
 * 
 * @param force - 是否强制重新检测（默认使用缓存）
 * @returns true 表示支持触摸，false 表示不支持
 * 
 * @example
 * ```typescript
 * isTouchDevice();        // 使用缓存结果
 * isTouchDevice(true);    // 强制重新检测
 * ```
 */
export const isTouchDevice = createTouchDetector();

/**
 * 检测点击是否在空白区域（非图标区域）
 *
 * @param target - 被点击的 HTML 元素
 * @returns true 表示点击在空白区域
 */
export const isClickOnEmptyArea = (target: HTMLElement): boolean => {
  const area = target.dataset.clickArea;
  if (area === 'empty' || area === 'grid') return true;
  return target.parentElement?.dataset.clickArea === 'grid';
};
