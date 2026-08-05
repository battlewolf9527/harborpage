import type { UserData } from '../types';
import AuthService from './AuthService';
import { STORAGE_KEYS, TRACKED_KEYS } from '../constants';
import createLogger from '../utils/logger';

const logger = createLogger('DataRepository');

class DataRepository {
  private static instance: DataRepository;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {}

  public static getInstance(): DataRepository {
    if (!DataRepository.instance) {
      DataRepository.instance = new DataRepository();
    }
    return DataRepository.instance;
  }

  public handleAuthResponse(response: Response): void {
    if (response.status === 401) {
      AuthService.handleAuthFailure();
    }
  }

  public loadFromLocal(): UserData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DATA);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      logger.error('从本地加载数据失败', e);
      return null;
    }
  }

  public async loadFromAPI(): Promise<UserData | null> {
    try {
      const response = await fetch('/api/data', {
        headers: AuthService.getAuthHeaders(),
      });
      this.handleAuthResponse(response);
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    } catch (e) {
      logger.error('从API加载数据失败', e);
      return null;
    }
  }

  public saveToLocal(data: UserData): void {
    this.scheduleLocalSave(data);
  }

  public flushLocal(data: UserData): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.scheduleLocalSave(data, 0);
  }

  private scheduleLocalSave(data: UserData, delay: number = 500): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(data));
      } catch (error) {
        logger.error('保存本地数据失败', error);
      }
      this.saveTimer = null;
    }, delay);
  }

  public async saveKeyToAPI(key: string, data: unknown): Promise<boolean> {
    try {
      const response = await fetch(`/api/data?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...AuthService.getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      this.handleAuthResponse(response);
      return response.ok;
    } catch (e) {
      logger.error(`保存 ${key} 失败`, e);
      return false;
    }
  }

  public async clearAllFromAPI(): Promise<boolean> {
    try {
      for (const key of TRACKED_KEYS) {
        const response = await fetch(`/api/data?key=${key}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        });
        this.handleAuthResponse(response);
        if (!response.ok) return false;
      }
      return true;
    } catch (e) {
      logger.error('清除数据失败', e);
      return false;
    }
  }

  public getTrackedKeys(): string[] {
    return [...TRACKED_KEYS];
  }

  public saveConfigValue(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      logger.error(`保存配置 ${key} 失败`, error);
    }
  }

  public loadConfigValue(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      logger.error(`加载配置 ${key} 失败`, error);
      return null;
    }
  }

  public removeConfigValue(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.error(`删除配置 ${key} 失败`, error);
    }
  }

  public saveUnsavedChanges(changedKeys: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.UNSAVED_CHANGES, JSON.stringify(changedKeys));
    } catch (error) {
      logger.error('保存未保存状态失败', error);
    }
  }

  public loadUnsavedChanges(): string[] | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.UNSAVED_CHANGES);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed && typeof parsed === 'object' && parsed.hasUnsavedChanges !== undefined) {
        if (parsed.hasUnsavedChanges) {
          return [...TRACKED_KEYS];
        }
      }
      return null;
    } catch (error) {
      logger.error('加载未保存状态失败', error);
      return null;
    }
  }

  public saveCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      logger.error(`保存缓存 ${key} 失败`, error);
    }
  }

  public loadCache<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.error(`加载缓存 ${key} 失败`, error);
      return null;
    }
  }

  /**
   * 清理定时器和资源
   * 在应用卸载或页面关闭时调用
   */
  public cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}

export default DataRepository.getInstance();