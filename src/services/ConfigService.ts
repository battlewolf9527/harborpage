// 配置服务 - 用于获取后端配置信息

import { STORAGE_KEYS } from '../constants';
import AuthService from './AuthService';
import DataRepository from './DataRepository';
import createLogger from '../utils/logger';
import i18n from '../i18n';

const logger = createLogger('ConfigService');

interface AppConfig {
  r2Url: string;
  enableR2Cdn: boolean;
  r2StorageAvailable: boolean;
  weatherApiAvailable: boolean;
  /** 后端生效的天气供应商标识（如 qweather），未配置时为空串 */
  weatherProvider: string;
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig | null = null;

  private constructor() {
    this.loadConfigFromStorage();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfigFromStorage(): void {
    try {
      const cachedData = DataRepository.loadConfigValue(STORAGE_KEYS.CONFIG);
      if (cachedData) {
        this.config = JSON.parse(cachedData);
      }
    } catch (error) {
      logger.error('Failed to load config', error);
      this.config = null;
    }
  }

  private saveConfigToStorage(): void {
    try {
      DataRepository.saveConfigValue(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
    } catch (error) {
      logger.error('Failed to save config', error);
    }
  }

  public getConfig(): AppConfig | null {
    return this.config;
  }

  public getR2Url(): string {
    return this.config?.r2Url || '';
  }

  public isR2CdnEnabled(): boolean {
    return this.config?.enableR2Cdn === true;
  }

  public isR2StorageAvailable(): boolean {
    return this.config?.r2StorageAvailable === true;
  }

  public isWeatherApiAvailable(): boolean {
    return this.config?.weatherApiAvailable === true;
  }

  /** 当前生效的天气供应商标识，未配置时返回空串 */
  public getWeatherProviderId(): string {
    return this.config?.weatherProvider || '';
  }

  // 从后端获取配置（需认证）
  public async fetchConfig(): Promise<AppConfig> {
    try {
      const response = await fetch('/api/config', {
        headers: AuthService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (!response.ok) {
        throw new Error(i18n.t('system:config.fetchFailed'));
      }
      const config = await response.json() as AppConfig;
      this.config = config;
      this.saveConfigToStorage();
      return config;
    } catch (error) {
      logger.error('Failed to fetch config', error);
      throw error;
    }
  }

  public clearConfig(): void {
    this.config = null;
    DataRepository.removeConfigValue(STORAGE_KEYS.CONFIG);
  }
}

export default ConfigService.getInstance();
