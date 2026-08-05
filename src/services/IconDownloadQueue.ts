// 全局图标下载队列（已弃用，保留空实现以兼容外部引用）
// 图标缓存已改为通过 POST /api/icon 直接请求，见 iconUtils.ts 中的 cacheAndReload

import type { IconType } from './IconManager';

export const QUEUE_CONFIG = {
  MAX_RETRY: 3,
  IDLE_INTERVAL: 3000,
  ACTIVE_INTERVAL: 100,
} as const;

class IconDownloadQueue {
  private constructor() {}
  private static instance: IconDownloadQueue;

  public static getInstance(): IconDownloadQueue {
    if (!IconDownloadQueue.instance) {
      IconDownloadQueue.instance = new IconDownloadQueue();
    }
    return IconDownloadQueue.instance;
  }

  public addTask(
    _hash: string,
    _hashInput: string,
    _downloadUrl: string,
    _type: IconType,
    _imgElement: HTMLImageElement
  ): boolean {
    // 已弃用：图标缓存改为通过 POST /api/icon 直接请求
    return false;
  }

  public cleanup(): void {}

  public getQueueLength(): number {
    return 0;
  }
}

const instance = IconDownloadQueue.getInstance();

export default instance;
export { IconDownloadQueue };
