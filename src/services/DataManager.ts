import type { UserData, Website, SearchEngine, Todo, Note, Settings, WallpaperType } from '../types';
import ChangeTracker from './ChangeTracker';
import DataRepository from './DataRepository';
import { STORAGE_KEYS } from '../constants';
import { mergeById } from '../utils/importExportUtils';
import createLogger from '../utils/logger';

const logger = createLogger('DataManager');

class DataManager {
  private static instance: DataManager;
  private data: UserData = {};
  private isSyncing: boolean = false;
  private _isInitializing: boolean = false;

  private constructor() {}

  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  public async initialize(): Promise<void> {
    const localData = DataRepository.loadFromLocal();
    if (localData) {
      this.data = localData;
      ChangeTracker.loadState();
      return;
    }

    const apiData = await DataRepository.loadFromAPI();
    if (apiData) {
      this.data = apiData;
      DataRepository.flushLocal(this.data);
      ChangeTracker.clearAll();
    }
  }

  public async saveChanges(): Promise<{ performed: boolean; error?: string }> {
    if (this.isSyncing) return { performed: false, error: '正在同步中' };
    if (!ChangeTracker.hasChanges()) return { performed: false };

    try {
      this.isSyncing = true;
      const changedKeys = ChangeTracker.getChangedKeys();
      const savedKeys: string[] = [];
      // 快照当前数据状态，避免 await 期间 this.data 被修改导致同一轮保存读取不同时间点数据
      const dataSnapshot = { ...this.data };

      for (const key of changedKeys) {
        const data = dataSnapshot[key as keyof UserData];
        const success = await DataRepository.saveKeyToAPI(key, data ?? {});
        if (!success) {
          // 回滚：将已成功保存的 key 重新标记为已变更，以便下次重试
          for (const savedKey of savedKeys) {
            ChangeTracker.markChanged(savedKey);
          }
          logger.error(`保存 ${key} 失败，已回滚 ${savedKeys.length} 个已保存的 key`);
          return { performed: false, error: '保存失败' };
        }
        savedKeys.push(key);
        ChangeTracker.clearChanged(key);
      }

      DataRepository.flushLocal(this.data);
      return { performed: true };
    } catch (error) {
      logger.error('保存数据失败', error);
      return { performed: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      this.isSyncing = false;
    }
  }

  public hasChanges(): boolean {
    return ChangeTracker.hasChanges();
  }

  public subscribeChanges(listener: (hasChanges: boolean) => void): () => void {
    return ChangeTracker.subscribe(listener);
  }

  public getChangedKeys(): string[] {
    return ChangeTracker.getChangedKeys();
  }

  public getData(): UserData {
    return this.data;
  }

  public setData(data: UserData): void {
    this.data = data;
    ChangeTracker.clearAll();
  }

  public startInitialization(): void {
    this._isInitializing = true;
  }

  public endInitialization(): void {
    this._isInitializing = false;
  }

  public isInitializing(): boolean {
    return this._isInitializing;
  }

  public async clearData(): Promise<boolean> {
    const success = await DataRepository.clearAllFromAPI();
    if (success) {
      this.data = {};
      ChangeTracker.clearAll();
      DataRepository.flushLocal(this.data);
    }
    return success;
  }

  // 应用导入的全量数据。
  // - overwrite：用导入数据整体覆盖（保留当前壁纸）
  // - merge：按 ID 合并，同 ID 项用导入项替换，新项追加；设置项字段级合并
  // 两种模式均保留当前壁纸。返回合并后的数据，供调用方初始化各 store。
  public applyImportedData(
    imported: UserData,
    mode: 'overwrite' | 'merge' = 'overwrite',
  ): UserData {
    const current = this.data;
    let merged: UserData;

    if (mode === 'merge') {
      merged = {
        ...current,
        websites: mergeById(current.websites, imported.websites ?? []),
        searchEngines: mergeById(current.searchEngines, imported.searchEngines ?? []),
        todos: mergeById(current.todos ?? current.todoList, imported.todos ?? []),
        notes: mergeById(current.notes, imported.notes ?? []),
      };
      // 设置项字段级合并：导入字段覆盖，未导入字段保留
      if (imported.settings) {
        merged.settings = { ...(current.settings ?? {}), ...imported.settings };
      }
    } else {
      // 覆盖：导入数据整体替换（壁纸通过 current 保留）
      merged = { ...current, ...imported };
    }

    this.data = merged;

    // 同步本地配置项，使 store 初始化时能读取到导入的默认搜索引擎
    if (imported.settings?.defaultSearchEngineId) {
      DataRepository.saveConfigValue(
        STORAGE_KEYS.DEFAULT_SEARCH_ENGINE_ID,
        imported.settings.defaultSearchEngineId,
      );
    }

    DataRepository.flushLocal(this.data);

    // 标记导入的键为已变更，触发保存提示以同步到云端
    ChangeTracker.markChanged('settings');
    ChangeTracker.markChanged('websites');
    ChangeTracker.markChanged('searchEngines');
    ChangeTracker.markChanged('todos');
    ChangeTracker.markChanged('notes');

    return merged;
  }

  private ensureSettings(): Settings {
    if (!this.data.settings) {
      this.data = { ...this.data, settings: {} };
    }
    return this.data.settings!;
  }

  private updateData(key: string, updater: () => void, persistToLocalStorage?: { key: string; value: string }): void {
    updater();
    if (!this.isInitializing()) {
      ChangeTracker.markChanged(key);
    }
    if (persistToLocalStorage) {
      DataRepository.saveConfigValue(persistToLocalStorage.key, persistToLocalStorage.value);
    }
    DataRepository.saveToLocal(this.data);
  }

  private updateSettingsField<K extends keyof Settings>(field: K, value: Settings[K]): void {
    this.updateData('settings', () => {
      this.data = {
        ...this.data,
        settings: { ...this.ensureSettings(), [field]: value },
      };
    });
  }

  public updateWallpaper(wallpaper: string | null, type: WallpaperType): void {
    this.updateData('wallpaper', () => {
      const current = this.data.wallpaper;
      this.data = {
        ...this.data,
        wallpaper: current
          ? { ...current, url: wallpaper, type }
          : { url: wallpaper, type },
      };
    });
  }

  public updateSolidColor(color: string): void {
    this.updateData('wallpaper', () => {
      const current = this.data.wallpaper;
      this.data = {
        ...this.data,
        wallpaper: current
          ? { ...current, solidColor: color }
          : { url: null, type: 'solid', solidColor: color },
      };
    });
  }

  public updateSiteTitle(title: string): void {
    this.updateSettingsField('siteTitle', title);
  }

  public updateIconColumns(columns: number): void {
    this.updateSettingsField('iconColumns', columns);
  }

  public updateAutoSaveEnabled(enabled: boolean): void {
    this.updateSettingsField('autoSaveEnabled', enabled);
    DataRepository.saveConfigValue(STORAGE_KEYS.AUTO_SAVE_ENABLED, JSON.stringify(enabled));
  }

  public updateAutoSaveDuration(duration: number): void {
    this.updateSettingsField('autoSaveDuration', duration);
    DataRepository.saveConfigValue(STORAGE_KEYS.AUTO_SAVE_DURATION, String(duration));
  }

  public updateBlurLevel(blurLevel: number): void {
    this.updateData('wallpaper', () => {
      const current = this.data.wallpaper;
      this.data = {
        ...this.data,
        wallpaper: current
          ? { ...current, blurLevel }
          : { url: null, type: 'solid', blurLevel },
      };
    });
  }

  public updateOverlayLevel(overlayLevel: number): void {
    this.updateData('wallpaper', () => {
      const current = this.data.wallpaper;
      this.data = {
        ...this.data,
        wallpaper: current
          ? { ...current, overlayLevel }
          : { url: null, type: 'solid', overlayLevel },
      };
    });
  }

  public updateWebsiteIcons(icons: Website[]): void {
    this.updateData('websites', () => {
      this.data = { ...this.data, websites: icons };
    });
  }

  public updateSearchEngines(engines: SearchEngine[]): void {
    this.updateData('searchEngines', () => {
      this.data = { ...this.data, searchEngines: engines };
    });
  }

  public updateTodos(todos: Todo[]): void {
    this.updateData('todos', () => {
      this.data = { ...this.data, todos: todos };
    });
  }

  public updateNotes(notes: Note[]): void {
    this.updateData('notes', () => {
      this.data = { ...this.data, notes: notes };
    });
  }

  public updateDefaultSearchEngineId(engineId: string): void {
    this.updateData('settings', () => {
      this.data = {
        ...this.data,
        settings: { ...this.ensureSettings(), defaultSearchEngineId: engineId },
      };
    }, { key: STORAGE_KEYS.DEFAULT_SEARCH_ENGINE_ID, value: engineId });
  }

  public updateFaviconSources(sources: import('../types').FaviconSource[]): void {
    this.updateSettingsField('faviconSources', sources);
  }
}

export default DataManager.getInstance();