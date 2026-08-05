import { getServices } from './serviceContainer';
import createLogger from '../utils/logger';

const logger = createLogger('autoFetchService');

/** 候选图标（未下载） */
export interface IconCandidate {
  url: string;
  source: string;
}

/** 已下载的图标结果 */
export interface DownloadedIcon {
  url: string;
  source: string;
  dataUrl: string;
  size: number;
  mimeType: string;
}

/** 获取进度回调 */
export interface FetchProgress {
  phase: 'fetching_candidates' | 'downloading' | 'done';
  current: number;
  total: number;
  message: string;
}

type ProgressCallback = (progress: FetchProgress) => void;

/**
 * 自动获取图标服务
 *
 * 架构说明：
 * 1. 候选获取：调用后端 /api/icon/autofetch（仅获取 HTML + 解析 + 生成候选列表）
 *    - 单次请求，通常 < 3 秒，不会超时
 * 2. 图标下载：并发调用后端 /api/icon/download（下载单个图标）
 *    - 前端控制并发数（默认 3），每个请求独立且快速
 *    - 单个图标下载通常 < 2 秒，不会超时
 */
class AutoFetchService {
  /**
   * 获取候选图标列表（仅 URL，不下载）
   */
  async fetchCandidates(websiteUrl: string): Promise<IconCandidate[]> {
    const { authService } = getServices();

    const params = new URLSearchParams({ url: websiteUrl });
    const response = await fetch(`/api/icon/autofetch?${params}`, {
      headers: authService.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`获取候选列表失败: HTTP ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取候选列表失败');
    }

    return result.candidates || [];
  }

  /**
   * 并发下载图标（信号量模式）
   * @param candidates 候选列表
   * @param concurrency 并发数
   * @param onProgress 进度回调
   */
  async downloadIcons(
    candidates: IconCandidate[],
    concurrency: number = 3,
    onProgress?: ProgressCallback
  ): Promise<DownloadedIcon[]> {
    const results: DownloadedIcon[] = [];
    const seen = new Set<string>();
    const uniqueCandidates = candidates.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });

    let completedCount = 0;
    const total = uniqueCandidates.length;

    onProgress?.({
      phase: 'downloading',
      current: 0,
      total,
      message: `开始下载图标 (0/${total})`,
    });

    const downloadOne = async (candidate: IconCandidate): Promise<void> => {
      try {
        const { authService } = getServices();
        const response = await fetch('/api/icon/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
          body: JSON.stringify({ url: candidate.url }),
        });

        if (!response.ok) {
          logger.warn(`下载图标失败 ${candidate.url}: HTTP ${response.status}`);
          return;
        }

        const result = await response.json();
        if (result.success && result.dataUrl) {
          results.push({
            url: candidate.url,
            source: candidate.source,
            dataUrl: result.dataUrl,
            size: result.size || 0,
            mimeType: result.mimeType || 'image/png',
          });
        }
      } catch (err) {
        logger.warn(`下载图标异常 ${candidate.url}:`, err instanceof Error ? err.message : String(err));
      }
    };

    // 信号量并发控制
    let index = 0;
    const worker = async (): Promise<void> => {
      while (index < uniqueCandidates.length) {
        const currentIndex = index++;
        const candidate = uniqueCandidates[currentIndex];
        await downloadOne(candidate);
        completedCount++;
        onProgress?.({
          phase: 'downloading',
          current: completedCount,
          total,
          message: `下载中 (${completedCount}/${total})`,
        });
      }
    };

    const workerCount = Math.min(concurrency, uniqueCandidates.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    onProgress?.({
      phase: 'done',
      current: total,
      total,
      message: `完成，共获取 ${results.length} 个有效图标`,
    });

    return results;
  }

  /**
   * 完整流程：获取候选 + 并发下载
   */
  async fetchAllIcons(
    websiteUrl: string,
    onProgress?: ProgressCallback
  ): Promise<DownloadedIcon[]> {
    onProgress?.({
      phase: 'fetching_candidates',
      current: 0,
      total: 0,
      message: '正在分析页面结构...',
    });

    const candidates = await this.fetchCandidates(websiteUrl);

    if (candidates.length === 0) {
      return [];
    }

    return this.downloadIcons(candidates, 3, onProgress);
  }
}

const instance = new AutoFetchService();
export default instance;
