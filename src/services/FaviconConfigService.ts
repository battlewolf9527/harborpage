import type { FaviconSource } from '../types';
import DataManager from './DataManager';
import createLogger from '../utils/logger';

const logger = createLogger('FaviconConfigService');

/**
 * Favicon 源配置服务
 *
 * 【架构原则】前端不维护默认 favicon 源常量，默认源的唯一权威定义在后端
 * （worker/routes/icon.ts 的 DEFAULT_FAVICON_SOURCE_CONFIGS）。
 * 前端通过 GET /api/icon/sources/defaults 获取默认源并缓存到内存。
 *
 * 用户自定义配置仍存储在 UserData.settings.faviconSources 中（通过 DataManager 同步）。
 */
class FaviconConfigService {
  private static instance: FaviconConfigService;

  /** 内存缓存的后端默认源（应用初始化时预加载） */
  private cachedDefaults: FaviconSource[] | null = null;

  private constructor() {}

  public static getInstance(): FaviconConfigService {
    if (!FaviconConfigService.instance) {
      FaviconConfigService.instance = new FaviconConfigService();
    }
    return FaviconConfigService.instance;
  }

  /**
   * 从后端加载默认 favicon 源并缓存到内存
   * 应在应用初始化时调用
   */
  public async loadDefaultSources(): Promise<void> {
    if (this.cachedDefaults) return;
    try {
      const resp = await fetch('/api/icon/sources/defaults');
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as { sources: FaviconSource[] };
      this.cachedDefaults = data.sources;
    } catch (error) {
      logger.error('从后端加载默认 favicon 源失败', error);
    }
  }

  /**
   * 获取当前用户配置的 favicon 源列表
   * 如果用户未配置，返回内存缓存的后端默认源
   * 注意：需先调用 loadDefaultSources() 完成预加载
   */
  public getSources(): FaviconSource[] {
    try {
      const userData = DataManager.getData();
      const userSources = userData.settings?.faviconSources;
      if (userSources && userSources.length > 0) {
        return userSources;
      }
    } catch (error) {
      logger.error('获取 favicon 源配置失败', error);
    }
    return this.cachedDefaults ?? [];
  }

  /**
   * 获取所有已启用的 favicon 源
   */
  public getEnabledSources(): FaviconSource[] {
    return this.getSources().filter((s) => s.enabled);
  }

  /**
   * 获取第一个已启用的源（用于前端预览）
   */
  public getFirstEnabledSource(): FaviconSource | null {
    const enabled = this.getEnabledSources();
    return enabled.length > 0 ? enabled[0] : null;
  }

  /**
   * 根据域名构建第一个已启用源的 URL
   */
  public buildFirstEnabledUrl(domain: string): string {
    const source = this.getFirstEnabledSource();
    if (!source) {
      return '';
    }
    return source.urlTemplate.replace('{domain}', encodeURIComponent(domain));
  }

  /**
   * 获取默认源列表（深拷贝）
   * 注意：需先调用 loadDefaultSources() 完成预加载
   */
  public getDefaultSources(): FaviconSource[] {
    return (this.cachedDefaults ?? []).map((s) => ({ ...s }));
  }

  /**
   * 保存用户自定义的 favicon 源配置
   */
  public saveSources(sources: FaviconSource[]): void {
    try {
      DataManager.updateFaviconSources(sources);
    } catch (error) {
      logger.error('保存 favicon 源配置失败', error);
    }
  }
}

const instance = FaviconConfigService.getInstance();
export default instance;
