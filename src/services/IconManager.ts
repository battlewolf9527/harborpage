// 图标管理服务 - 合并优化版

import ConfigService from './ConfigService';
import AuthService from './AuthService';
import DataRepository from './DataRepository';
import FaviconConfigService from './FaviconConfigService';
import MD5 from 'crypto-js/md5';
import createLogger from '../utils/logger';

const logger = createLogger('IconManager');

/**
 * 图标类型常量
 */
export const IconType = {
  SEARCH: 'search',
  SITE: 'site'
} as const;

export type IconType = typeof IconType[keyof typeof IconType];

/**
 * 图标对象接口
 */
export interface IconObject {
  id: string;
  name: string;
  url: string;
  icon?: string;
  /** 图标底色（CSS 颜色值，用于文字图标填充颜色）
   *  当 icon 为纯文本时，iconColor 作为文字颜色 */
  iconColor?: string;
}

/**
 * Favicon URL 构建（集中管理，避免重复）
 * 使用 FaviconConfigService 获取用户配置的 favicon 源
 */
export function getFaviconUrl(domain: string): string {
  return FaviconConfigService.buildFirstEnabledUrl(domain);
}

/**
 * 判断 URL 是否为内网/本地地址
 * 覆盖 IPv4 私有地址段、IPv6 本地地址段、localhost 等
 */
export function isPrivateNetworkAddress(urlStr: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(urlStr).hostname;
  } catch {
    return false;
  }

  // 去除 IPv6 方括号并统一小写
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // localhost 及 mDNS .local 域名
  if (host === 'localhost' || host.endsWith('.local')) {
    return true;
  }

  // IPv4 地址
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 127) return true;                         // 127.0.0.0/8
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16
    if (a === 0) return true;                           // 0.0.0.0/8
    return false;
  }

  // IPv6 地址（包含冒号）
  if (host.includes(':')) {
    if (host === '::1' || host === '::') return true;   // loopback / unspecified
    // fe80::/10 (link-local)
    if (host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) return true;
    // fc00::/7 (unique local)
    if (host.startsWith('fc') || host.startsWith('fd')) return true;
    return false;
  }

  return false;
}

/**
 * 判断字符串是否为 URL 格式（以 http://、https:// 或 /api/ 开头）
 */
export function isUrlLike(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/api/');
}

/**
 * 生成文字图标 SVG data URI（透明背景，文字颜色由 iconColor 决定）
 * 最大容纳 4 个字符（可显示两个汉字）
 * @param text 显示文字
 * @param textColor 文字颜色（CSS 颜色值，如 '#2563EB'），默认白色
 */
export function generateColoredTextSvg(text: string, textColor: string = '#FFFFFF'): string {
  const trimmed = text.trim();
  const displayText = trimmed.length > 4 ? trimmed.slice(0, 4) : trimmed;

  // 根据字符长度自适应字体大小（画布为 64x64）
  const len = displayText.length;
  let fontSize: number;
  if (len === 1) {
    fontSize = 40;
  } else if (len === 2) {
    fontSize = 32;
  } else if (len === 3) {
    fontSize = 24;
  } else {
    fontSize = 20;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}" font-family="system-ui,-apple-system,sans-serif" font-weight="600" fill="${textColor}">${displayText}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

class IconManager {
  private static instance: IconManager;

  private constructor() {}

  public static getInstance(): IconManager {
    if (!IconManager.instance) {
      IconManager.instance = new IconManager();
    }
    return IconManager.instance;
  }

  // MD5 哈希函数（与后端保持一致）
  private generateMd5Hash(input: string): string {
    return MD5(input).toString();
  }

  // 生成图标文件名（新规则：hash只基于hashInput）
  private generateIconFilename(hashInput: string, ext: string = 'png'): string {
    const normalizedInput = hashInput.toLowerCase();
    const hash = this.generateMd5Hash(normalizedInput);
    return `${hash}.${ext}`;
  }

  // 生成完整的R2 URL
  private generateR2IconUrl(type: IconType, hashInput: string, r2Url: string): string {
    const filename = this.generateIconFilename(hashInput);
    const prefix = type === 'search' ? 'SearchEngines' : 'WebSites';
    // 移除 r2Url 末尾的斜杠，避免重复
    const cleanR2Url = r2Url.replace(/\/$/, '');
    return `${cleanR2Url}/${prefix}/${filename}`;
  }

  // 获取hashInput和downloadUrl
  // hashInput 用于 R2 文件名生成，downloadUrl 用于 favicon 下载
  private getHashAndDownload(_type: IconType, icon: IconObject): { hashInput: string; downloadUrl: string; domain: string } {
    const domain = this.extractDomain(icon.url);

    // 如果icon字段存在且不为空，且不是API URL
    if (icon.icon && icon.icon.trim() && !icon.icon.startsWith('/api/icon')) {
      // 用户填写了图标URL
      return {
        hashInput: icon.icon.trim(),
        downloadUrl: icon.icon.trim(),
        domain,
      };
    } else {
      // 用户未填写图标URL：用 icon.id 作为 hashInput（保证同一站点文件名一致）
      return {
        hashInput: icon.id,
        downloadUrl: getFaviconUrl(domain),
        domain,
      };
    }
  }

  // 从URL提取域名
  public extractDomain(urlString: string): string {
    try {
      const url = new URL(urlString);
      return url.hostname;
    } catch {
      return urlString;
    }
  }

  // ==================== 公开方法 ====================

  /**
   * 获取图标hash（用于下载队列去重）
   * @param type 图标类型
   * @param icon 图标对象
   * @returns hash值
   */
  public getIconHash(type: IconType, icon: IconObject): string {
    const { hashInput } = this.getHashAndDownload(type, icon);
    return this.generateMd5Hash(hashInput.toLowerCase());
  }

  /**
   * 获取图标下载URL
   * @param type 图标类型
   * @param icon 图标对象
   * @returns 下载URL
   */
  public getIconDownloadUrl(type: IconType, icon: IconObject): string {
    const { downloadUrl } = this.getHashAndDownload(type, icon);
    return downloadUrl;
  }

  /**
   * 获取hashInput
   * @param type 图标类型
   * @param icon 图标对象
   * @returns hashInput
   */
  public getHashInput(type: IconType, icon: IconObject): string {
    const { hashInput } = this.getHashAndDownload(type, icon);
    return hashInput;
  }

  /**
   * 获取域名（用于后端构建 favicon 源 URL）
   * @param type 图标类型
   * @param icon 图标对象
   * @returns 域名
   */
  public getIconDomain(type: IconType, icon: IconObject): string {
    const { domain } = this.getHashAndDownload(type, icon);
    return domain;
  }

  /**
   * 获取图标URL的核心逻辑（同步）
   * @param type 图标类型
   * @param icon 图标对象
   * @param r2Url R2 URL配置
   * @param enableR2Cdn 是否启用R2 CDN
   * @returns 图标URL
   */
  private getIconUrlCore(type: IconType, icon: IconObject, r2Url: string, enableR2Cdn: boolean): string {
    // 非URL格式的自定义图标：emoji/字符直接返回，纯文本生成彩色SVG
    if (icon.icon && !icon.icon.startsWith('http') && !icon.icon.startsWith('/api/')) {
      if (icon.icon.startsWith('data:')) {
        return icon.icon;
      }
      // 纯文本图标（如 "Ba"），生成透明背景的SVG，文字颜色由 iconColor 决定
      return generateColoredTextSvg(icon.icon, icon.iconColor);
    }
    
    // 如果图标是用户上传的（以R2 URL开头），直接返回
    if (this.isUserUploadedIconUrl(icon.icon)) {
      return icon.icon!;
    }

    // 内网地址且无自定义图标URL：返回 🌐 SVG，保持一致的渲染效果
    const hasCustomHttpIcon = icon.icon && icon.icon.startsWith('http');
    if (!hasCustomHttpIcon && isPrivateNetworkAddress(icon.url)) {
      return generateColoredTextSvg('🌐', icon.iconColor);
    }

    // 用户设置了自定义 URL（非 R2 上传）→ 直接返回，不走 R2 缓存流程
    if (icon.icon && icon.icon.startsWith('http') && !this.isUserUploadedIconUrl(icon.icon)) {
      return icon.icon;
    }

    // R2 不可用或 CDN 模式禁用
    if (!r2Url || !enableR2Cdn) {
      const { downloadUrl } = this.getHashAndDownload(type, icon);
      return downloadUrl;
    }
    
    // R2 可用：为自动 favicon 生成 R2 URL
    const { hashInput } = this.getHashAndDownload(type, icon);
    return this.generateR2IconUrl(type, hashInput, r2Url);
  }

  /**
   * 同步获取图标URL（用于不需要等待的场景）
   * @param type 图标类型
   * @param icon 图标对象
   * @returns 图标URL
   */
  public getIconUrlSync(type: IconType, icon: IconObject): string {
    const r2Url = ConfigService.getR2Url();
    const enableR2Cdn = ConfigService.isR2CdnEnabled();
    return this.getIconUrlCore(type, icon, r2Url, enableR2Cdn);
  }

  /**
   * 根据 type 和 hashInput 直接生成 R2 URL
   * @param type 图标类型
   * @param hashInput hash输入值
   * @returns R2 URL，如果没有配置R2_URL则返回空字符串
   */
  public getR2UrlByHashInput(type: IconType, hashInput: string): string {
    const r2Url = ConfigService.getR2Url();
    if (!r2Url) {
      return '';
    }
    return this.generateR2IconUrl(type, hashInput, r2Url);
  }

  /**
   * 获取图标类型
   * @param icon 图标对象（必须包含 url 属性）
   * @returns 图标类型 'search' 或 'site'
   */
  public getIconType(icon: { url: string }): IconType {
    // 检查是否是搜索引擎（URL中包含 {q} 占位符）
    if (icon.url.includes('{q}')) {
      return IconType.SEARCH;
    }
    return IconType.SITE;
  }

  /**
   * 判断图标URL是否是用户上传的图标（以R2 URL开头）
   * @param iconUrl 图标URL
   * @returns 是否是用户上传的图标
   */
  public isUserUploadedIconUrl(iconUrl?: string): boolean {
    const r2Url = ConfigService.getR2Url();
    if (!iconUrl || !iconUrl.startsWith('http') || !r2Url) {
      return false;
    }
    // 移除 r2Url 末尾的斜杠，避免匹配失败
    const cleanR2Url = r2Url.replace(/\/$/, '');
    return iconUrl.startsWith(cleanR2Url);
  }

  /**
   * 获取错误图片地址（始终使用自包含的 data URI SVG，确保最可靠的回退）
   * @returns 错误图片URL
   */
  public getErrorIconUrl(): string {
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj48cGF0aCBkPSJNMTYgMmMtNy43MzIgMC0xNCA2LjI2OC0xNCAxNHM2LjI2OCAxNCAxNCAxNCAxNC02LjI2OCAxNC0xNC02LjI2OC0xNC0xNC0xNHptMCAyNGMtNS41MjMgMC0xMC00LjQ3Ny0xMC0xMHM0LjQ3Ny0xMCAxMC0xMCAxMCA0LjQ3NyAxMCAxMC00LjQ3NyAxMC0xMCAxMHoiLz48cGF0aCBkPSJNNyAxMGgxOGwtNyAxOCA3LTE4eiIvPjwvc3ZnPg=='
  }

  /**
   * 预下载图标到R2（仅在R2存储可用且CDN模式启用时生效）
   * @param type 图标类型 'search' 或 'site'
   * @param hashInput hash输入值（必须与 getHashAndDownload 一致，否则显示时 404）
   * @param downloadUrl 下载URL
   * @returns 成功时返回 { success: true, iconUrl: R2上的实际地址 }
   */
  public async preloadIcon(
    type: IconType,
    hashInput: string,
    downloadUrl: string,
    domain?: string
  ): Promise<{ success: boolean; iconUrl?: string }> {
    if (!ConfigService.isR2StorageAvailable() || !ConfigService.isR2CdnEnabled()) {
      return { success: false };
    }

    try {
      const response = await fetch('/api/icon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify({
          type,
          hashInput,
          downloadUrl,
          domain,
        }),
      });

      DataRepository.handleAuthResponse(response);
      if (!response.ok) {
        return { success: false };
      }

      try {
        const json = await response.json();
        if (json && typeof json.iconUrl === 'string') {
          return { success: true as const, iconUrl: json.iconUrl };
        }
      } catch {
        // 响应体解析失败不影响 success 标记
      }
      return { success: true as const };
    } catch (error) {
      logger.error('预下载图标失败', error);
      return { success: false };
    }
  }

  public async deleteIconsFromR2(
    items: { id: string; url: string }[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    if (items.length === 0) return;

    const total = items.length;
    let current = 0;
    const failures: { id: string; url: string; error: unknown }[] = [];

    for (const item of items) {
      current++;
      onProgress?.(current, total);

      try {
        let domain: string;
        try {
          domain = new URL(item.url).hostname;
        } catch {
          // 无效 URL，跳过但不计入失败
          continue;
        }

        const response = await fetch(
          `/api/icon?type=site&id=${encodeURIComponent(item.id)}&domain=${encodeURIComponent(domain)}`,
          {
            method: 'DELETE',
            headers: AuthService.getAuthHeaders(),
          }
        );

        DataRepository.handleAuthResponse(response);
        if (!response.ok) {
          logger.error(`删除R2图标失败: ${response.status}`);
          failures.push({ id: item.id, url: item.url, error: `HTTP ${response.status}` });
        }
      } catch (error) {
        logger.error('删除R2图标失败', error);
        failures.push({ id: item.id, url: item.url, error });
      }
    }

    // 如果有失败项，抛出错误让调用方决定是否保留 pendingDeletes
    if (failures.length > 0) {
      throw new Error(`${failures.length}/${total} 个图标删除失败`);
    }
  }
}

// 创建单例实例
const instance = IconManager.getInstance();

// 导出单例和类型
export default instance;
