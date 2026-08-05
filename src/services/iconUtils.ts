// 图标加载工具函数

import type { SearchEngine, Website } from '../types';
import IconManager, { IconType, getFaviconUrl, isPrivateNetworkAddress } from './IconManager';
import AuthService from './AuthService';
import ConfigService from './ConfigService';
import { getServices } from './serviceContainer';
import createLogger from '../utils/logger';
import React from 'react';
import waitingImg from '../assets/Waiting.png';

const logger = createLogger('iconUtils');

const MAX_CACHE_RETRY = 1;
const MAX_CONCURRENT = 3;

// 已通过 POST 成功缓存到 R2 的 hash（用于防止成功后仍 404 导致的无限重试）
const cacheSucceeded = new Set<string>();
// POST 缓存失败的重试计数
const cacheRetryCount = new Map<string, number>();
// 正在进行中的 POST 请求（用于去重，避免同一 hash 并发多个 POST）
const cacheInProgress = new Set<string>();
// 同一 hash 下的所有 img 元素（用于缓存成功时统一更新）
const hashImgMap = new Map<string, Set<HTMLImageElement>>();

/**
 * 信号量：限制同时进行的 POST 缓存请求数量
 */
class Semaphore {
  private permits: number;
  private waiters: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>(resolve => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      next();
    } else {
      this.permits++;
    }
  }
}

const cacheSemaphore = new Semaphore(MAX_CONCURRENT);

/**
 * 生成最终回退的SVG data URI（使用站点名称首字母或 🌐 emoji）
 */
const generateFallbackSvg = (text: string): string => {
  const fontSize = text.length > 2 ? 14 : 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${fontSize}" font-family="system-ui,sans-serif" fill="#666">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

/**
 * 判断是否已经显示错误图标（使用 data URI 前缀匹配，避免浏览器规范化问题）
 */
const isErrorIconDisplayed = (img: HTMLImageElement): boolean => {
  return img.src.startsWith('data:image/svg+xml');
};

/**
 * 显示 🌐 emoji SVG（缓存失败时的最终回退，不再尝试请求）
 */
const showGlobeIcon = (img: HTMLImageElement): void => {
  img.src = generateFallbackSvg('🌐');
};

/**
 * 判断是否为 case 1（空 iconUrl，自动 favicon）
 * icon 为空、空白、或 /api/icon 开头时视为空
 */
const isEmptyIconCase = (icon: SearchEngine | Website): boolean => {
  return !icon.icon || !icon.icon.trim() || icon.icon.startsWith('/api/icon');
};

/**
 * Case 1 专用：将网站/搜索引擎的 icon 属性改为 🌐 并持久化
 * 递归查找嵌套在文件夹中的网站
 */
const persistIconAsGlobe = (icon: SearchEngine | Website, type: IconType): void => {
  // 修改传入的对象引用（使当前 UI 状态一致）
  icon.icon = '🌐';

  // 持久化到 DataManager
  const { dataManager } = getServices();
  const data = dataManager.getData();

  if (type === IconType.SITE) {
    const updateRecursive = (websites: Website[]): Website[] =>
      websites.map(w => {
        if (w.id === icon.id) {
          return { ...w, icon: '🌐' };
        }
        if (w.children) {
          return { ...w, children: updateRecursive(w.children) };
        }
        return w;
      });
    dataManager.updateWebsiteIcons(updateRecursive(data.websites ?? []));
  } else {
    dataManager.updateSearchEngines(
      (data.searchEngines ?? []).map(e => (e.id === icon.id ? { ...e, icon: '🌐' } : e))
    );
  }
};

/**
 * 通知同一 hash 下的所有 img 元素更新 src
 */
const broadcastToHashImgs = (hash: string, src: string): void => {
  const imgs = hashImgMap.get(hash);
  if (!imgs) return;
  for (const img of imgs) {
    img.src = src;
  }
};

/**
 * 通过 POST 请求缓存图标到 R2，成功后重新加载 R2 URL
 * 使用信号量控制并发（最多 MAX_CONCURRENT 个同时执行）
 * 失败时自动重试，达到最大次数后显示默认图标
 * 同一 hash 下的所有 img 元素会在成功/失败时统一更新
 */
const cacheAndReload = async (
  img: HTMLImageElement,
  icon: SearchEngine | Website,
  type: IconType,
  hash: string,
  hashInput: string,
  downloadUrl: string,
  domain: string
): Promise<void> => {
  // 注册 img 到 hashImgMap（用于同 hash 多元素统一更新）
  if (!hashImgMap.has(hash)) {
    hashImgMap.set(hash, new Set());
  }
  hashImgMap.get(hash)!.add(img);

  // 已成功缓存过 → R2 仍加载失败（race condition），直接回退
  if (cacheSucceeded.has(hash)) {
    showGlobeIcon(img);
    return;
  }

  // 正在进行中的请求 → 不重复 POST（但已注册到 hashImgMap，会在成功时被更新）
  if (cacheInProgress.has(hash)) {
    img.src = waitingImg;
    return;
  }

  cacheInProgress.add(hash);

  // 显示等待占位图
  img.src = waitingImg;

  // 等待信号量许可（并发控制在 MAX_CONCURRENT）
  await cacheSemaphore.acquire();

  try {
    const response = await fetch('/api/icon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeaders(),
      },
      body: JSON.stringify({ type, hashInput, downloadUrl, domain }),
    });

    if (response.ok) {
      // 缓存成功 → 清除重试计数，所有同 hash img 重新加载 R2 URL
      cacheSucceeded.add(hash);
      cacheRetryCount.delete(hash);
      cacheInProgress.delete(hash);
      const r2Url = IconManager.getR2UrlByHashInput(type, hashInput);
      broadcastToHashImgs(hash, r2Url);
      hashImgMap.delete(hash);
      return;
    }

    throw new Error(`缓存请求失败: ${response.status}`);
  } catch {
    // 缓存失败 → 检查重试次数
    const retries = (cacheRetryCount.get(hash) || 0) + 1;
    cacheRetryCount.set(hash, retries);

    if (retries < MAX_CACHE_RETRY) {
      // 延迟后重试：保持 cacheInProgress 防止窗口期重复触发
      // 仅在重试真正开始前才释放
      setTimeout(() => {
        cacheInProgress.delete(hash);
        cacheAndReload(img, icon, type, hash, hashInput, downloadUrl, domain);
      }, 300);
    } else {
      // 达到最大重试次数
      cacheRetryCount.delete(hash);
      cacheInProgress.delete(hash);

      // 所有同 hash img 显示 🌐
      const imgs = hashImgMap.get(hash);
      if (imgs) {
        for (const i of imgs) {
          showGlobeIcon(i);
        }
      }
      hashImgMap.delete(hash);

      // Case 1（空 iconUrl）：持久化 icon='🌐'，刷新后不再请求
      if (isEmptyIconCase(icon)) {
        persistIconAsGlobe(icon, type);
      }
    }
  } finally {
    cacheSemaphore.release();
  }
};

/**
 * 错误处理策略函数类型
 */
type ErrorHandler = (img: HTMLImageElement, icon: SearchEngine | Website, type: IconType) => void;

/**
 * 处理用户上传图标的加载失败（Case 3：直接显示 🌐，不修改数据）
 */
const handleUserUploadedIconError: ErrorHandler = (img) => {
  showGlobeIcon(img);
};

/**
 * 处理非CDN模式下的图标加载失败（R2不可用或CDN模式禁用）
 * Case 1（空 icon）：尝试 favicon → 失败后持久化 icon='🌐'
 * Case 2（用户 URL）：直接显示 🌐，不修改数据
 */
const handleNonCdnModeError: ErrorHandler = (img, icon, type) => {
  const hasCustomIcon = !!(icon.icon && icon.icon.startsWith('http'));

  if (!hasCustomIcon) {
    const downloadUrl = IconManager.getIconDownloadUrl(type, icon);
    if (img.src === downloadUrl) {
      persistIconAsGlobe(icon, type);
      showGlobeIcon(img);
      return;
    }
    img.src = downloadUrl;
    return;
  }

  // Case 2：用户自定义 URL 加载失败 → 显示 🌐
  showGlobeIcon(img);
};

/**
 * 处理CDN模式下的图标加载失败（R2可用且CDN模式启用）
 * 
 * 严格按流程图执行：
 * 1. img 组件加载 R2 URL 失败 → 显示 Waiting.png 占位图
 * 2. 正在缓存中（Waiting.png）→ 不重复触发
 * 3. 其它情况 → 开始缓存流程（信号量控制并发 ≤ 3）
 */
const handleCdnModeError: ErrorHandler = (img, icon, type) => {
  if (img.src === waitingImg) {
    return;
  }

  const hash = IconManager.getIconHash(type, icon);
  const hashInput = IconManager.getHashInput(type, icon);
  const downloadUrl = IconManager.getIconDownloadUrl(type, icon);
  const domain = IconManager.getIconDomain(type, icon);

  // Case 2：用户自定义 URL → 不再触发缓存流程，显示 🌐
  if (hashInput.startsWith('http')) {
    showGlobeIcon(img);
    return;
  }

  cacheAndReload(img, icon, type, hash, hashInput, downloadUrl, domain);
};

/**
 * 根据图标状态和R2配置选择合适的错误处理策略
 */
const resolveErrorHandler = (
  icon: SearchEngine | Website,
  r2Url: string,
  enableR2Cdn: boolean
): ErrorHandler => {
  if (IconManager.isUserUploadedIconUrl(icon.icon)) {
    return handleUserUploadedIconError;
  }
  if (!r2Url || !enableR2Cdn) {
    return handleNonCdnModeError;
  }
  return handleCdnModeError;
};

/**
 * 通用图标加载失败处理函数
 */
export const handleIconLoadError = (
  e: React.SyntheticEvent<HTMLImageElement>,
  icon: SearchEngine | Website
) => {
  e.preventDefault();

  const img = e.target as HTMLImageElement;

  // 已经是 data URI SVG（🌐 或首字母回退）→ 不再处理
  if (isErrorIconDisplayed(img)) {
    return;
  }

  const type = IconManager.getIconType(icon);
  const r2Url = ConfigService.getR2Url();
  const enableR2Cdn = ConfigService.isR2CdnEnabled();

  const handler = resolveErrorHandler(icon, r2Url, enableR2Cdn);
  handler(img, icon, type);
};

/**
 * 共享搜索引擎图标渲染逻辑（用于 Search.tsx 和 SearchManager.tsx）
 *
 * @param icon - 搜索引擎对象
 * @param iconUrl - 图标URL（由调用方预计算）
 * @param imgClassName - img 元素的 className
 * @param textClassName - 文本 span 的 className
 * @returns React 元素
 */
export function renderSearchEngineIcon(
  icon: SearchEngine,
  iconUrl: string | undefined,
  imgClassName: string,
  textClassName: string
): React.ReactElement {
  if (!iconUrl) return React.createElement('span', { className: textClassName }, '🔍');
  if (iconUrl.length <= 2) return React.createElement('span', { className: textClassName }, iconUrl);
  if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://') || iconUrl.startsWith('/api/') || iconUrl.startsWith('data:')) {
    return React.createElement('img', {
      src: iconUrl,
      alt: icon.name,
      className: imgClassName,
      referrerPolicy: 'no-referrer',
      onError: (e: React.SyntheticEvent<HTMLImageElement>) => handleIconLoadError(e, icon),
    });
  }
  return React.createElement('span', { className: textClassName }, '🔍');
}

/**
 * 预下载图标到 R2（共享逻辑，用于 EditWebsite 和 SearchManager）
 *
 * 【hashInput 约定】必须与 IconManager.getHashAndDownload() 完全一致：
 *   1. 用户填写了自定义图标 URL（非空且非 API URL）：hashInput = iconInput（用户填的 URL）
 *   2. 用户未填写：hashInput = id（站点/搜索引擎 ID，保证同一站点文件名一致）
 * 否则 R2 中存的路径与前端显示时计算出的路径不一致，导致图标 404。
 *
 * @param iconManager - IconManager 实例
 * @param type - 图标类型 ('site' | 'search')
 * @param id - 站点/搜索引擎的唯一 ID
 * @param url - 站点/搜索引擎的完整 URL
 * @param iconInput - 用户填写的图标 URL（可为空）
 */
export async function preloadIconForUrl(
  iconManager: typeof IconManager,
  type: 'site' | 'search',
  id: string,
  url: string,
  iconInput: string
): Promise<void> {
  // 用户填写了自定义图标 URL → 前端直接加载，不需要后端预下载
  if (iconInput && iconInput.startsWith('http') && !iconManager.isUserUploadedIconUrl(iconInput)) {
    return;
  }

  // 用户未填写图标 URL → 自动获取 favicon，需后端下载并缓存到 R2
  if (!iconInput && url) {
    // 内网地址无法通过服务器获取 favicon，跳过预加载
    if (isPrivateNetworkAddress(url)) return;
    try {
      const domain = new URL(url).hostname;
      const downloadUrl = getFaviconUrl(domain);
      await iconManager.preloadIcon(type, id, downloadUrl, domain);
    } catch (error) {
      logger.error('预下载图标失败', error);
    }
  }
}
