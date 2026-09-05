/**
 * 颜色工具
 * 水晶图标把 iconColor（通常为 #rrggbb）换算成 HSL 三要素，
 * 注入 .icon-circle 的 --c-hue / --c-sat / --c-lit，
 * 供 IconItem.css 按 Crystal_block.html 的调色板方案派生材质色。
 */

export interface HslColor {
  /** 色相 0–360 */
  h: number;
  /** 饱和度 0–100 */
  s: number;
  /** 亮度 0–100 */
  l: number;
}

/**
 * 将 #rgb / #rrggbb 十六进制颜色转换为 HSL。
 * 传入其他格式（如 'transparent'）时返回 null，由调用方回落默认色。
 */
export function hexToHsl(hex: string): HslColor | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;

  let r: number;
  let g: number;
  let b: number;
  if (match[1].length === 3) {
    r = parseInt(match[1][0] + match[1][0], 16);
    g = parseInt(match[1][1] + match[1][1], 16);
    b = parseInt(match[1][2] + match[1][2], 16);
  } else {
    r = parseInt(match[1].slice(0, 2), 16);
    g = parseInt(match[1].slice(2, 4), 16);
    b = parseInt(match[1].slice(4, 6), 16);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      default:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * 将 #rgb / #rrggbb 十六进制颜色转换为 rgba() 字符串（用于 --note-soft 等半透明派生色）。
 * 非十六进制格式时原样返回。
 */
export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * 将 HSL（h∈[0,360]，s/l∈[0,100]）转换为 #rrggbb 小写 hex。
 * 用作「显示层明暗度」：hex → HSL 加/减亮度 → 再转回 hex，不改动存储色。
 */
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const light = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toByte = (v: number): string =>
    Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}

/**
 * 在 hex 颜色的 HSL 亮度通道上叠加偏移（0 = 不变；正值调亮、负值调暗，结果夹在 0-100），
 * 返回新的 hex。用于「显示层全局明暗度」：不改任何已存 hex，仅在渲染表面时整体调整。
 * 非十六进制输入原样返回。
 */
export function adjustHexLightness(hex: string, offset: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const delta = Number.isFinite(offset) ? offset : 0;
  return hslToHex(hsl.h, hsl.s, Math.min(100, Math.max(0, hsl.l + delta)));
}

/**
 * 将 iconColor 换算成注入 .icon-circle 的 HSL CSS 变量对象；
 * 非十六进制颜色（如 'transparent'）或未设置时返回 undefined（走 CSS 缺省）。
 * @param lightnessOffset 显示层亮度叠加偏移（0 = 原色），仅改变 --c-lit，不改色相/饱和度
 */
export function hexToHslCssVars(
  color?: string,
  lightnessOffset = 0,
): Record<string, string> | undefined {
  if (!color) return undefined;
  const hsl = hexToHsl(color);
  if (!hsl) return undefined;
  const delta = Number.isFinite(lightnessOffset) ? lightnessOffset : 0;
  return {
    '--c-hue': String(Math.round(hsl.h)),
    '--c-sat': `${Math.round(hsl.s)}%`,
    '--c-lit': `${Math.round(Math.min(100, Math.max(0, hsl.l + delta)))}%`,
  };
}
