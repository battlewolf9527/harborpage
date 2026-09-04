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
 * 将 iconColor 换算成注入 .icon-circle 的 HSL CSS 变量对象；
 * 非十六进制颜色（如 'transparent'）或未设置时返回 undefined（走 CSS 缺省）。
 */
export function hexToHslCssVars(color?: string): Record<string, string> | undefined {
  if (!color) return undefined;
  const hsl = hexToHsl(color);
  if (!hsl) return undefined;
  return {
    '--c-hue': String(Math.round(hsl.h)),
    '--c-sat': `${Math.round(hsl.s)}%`,
    '--c-lit': `${Math.round(hsl.l)}%`,
  };
}
