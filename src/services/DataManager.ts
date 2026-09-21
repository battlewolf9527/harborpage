import type { UserData, Website, SearchEngine, Todo, Note, Settings, WallpaperType, WallpaperData, Page, PaletteHexMap, PaletteAliasMap, PaletteScheme } from '../types';
import ChangeTracker from './ChangeTracker';
import DataRepository from './DataRepository';
import NotesRepository from './NotesRepository';
import { STORAGE_KEYS } from '../constants';
import { mergeById } from '../utils/importExportUtils';
import { normalizeAliasMap, normalizeLightness, normalizePaletteMap, normalizeSchemeList } from '../utils/paletteColors';
import { createDefaultPage } from '../store/usePagesStore';
import createLogger from '../utils/logger';
import i18n from '../i18n';

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
      this.stripWallpaperDeviceState();
      ChangeTracker.loadState();
      await this.reconcileNotesOnInit();
      return;
    }

    const apiData = await DataRepository.loadFromAPI();
    if (apiData) {
      this.data = apiData;
      this.stripWallpaperDeviceState();
      DataRepository.flushLocal(this.data);
      ChangeTracker.clearAll();
    }
  }

  /**
   * 启动对账：本机镜像里「曾确认上云、但云端索引已没有」的笔记按云端为准本地移除。
   * 用于让别的浏览器上的删除在本机生效；只认 NotesRepository 记录过的云端 id，
   * 从未上云的本地新笔记不受影响；拉取失败时保持原样，下次启动再对账。
   */
  private async reconcileNotesOnInit(): Promise<void> {
    const notes = this.data.notes;
    if (!notes || notes.length === 0 || !NotesRepository.isSharded()) return;

    const removedIds = await NotesRepository.findNotesDeletedOnCloud(notes.map((note) => note.id));
    if (!removedIds || removedIds.length === 0) return;

    const removed = new Set(removedIds);
    this.data = { ...this.data, notes: notes.filter((note) => !removed.has(note.id)) };
    DataRepository.flushLocal(this.data);
    logger.warn(`Removed ${removedIds.length} note(s) already deleted on cloud: ${removedIds.join(', ')}`);
  }

  /**
   * 提交所有待保存的变更。
   * offline=true 表示请求因断网未能发出：此时不返回 error，
   * 改动已回滚为「待保存」，等联网后由 SavePrompt 自动补交。
   */
  public async saveChanges(): Promise<{ performed: boolean; error?: string; offline?: boolean }> {
    if (this.isSyncing) return { performed: false, error: i18n.t('system:data.syncing') };
    if (!ChangeTracker.hasChanges()) return { performed: false };

    try {
      this.isSyncing = true;
      const changedKeys = ChangeTracker.getChangedKeys();
      const savedKeys: string[] = [];
      // 快照当前数据状态，避免 await 期间 this.data 被修改导致同一轮保存读取不同时间点数据
      const dataSnapshot = { ...this.data };

      for (const key of changedKeys) {
        const data = dataSnapshot[key as keyof UserData];
        // 笔记已拆分为分片存储：这里只提交本轮 diff 出来的增量（正文分片 + 一次索引），
        // 不再整包上传全部笔记
        const success = key === 'notes'
          ? await NotesRepository.flushPending()
          : await DataRepository.saveKeyToAPI(key, data ?? {});
        if (!success) {
          // 回滚：将已成功保存的 key 重新标记为已变更，以便下次重试
          for (const savedKey of savedKeys) {
            ChangeTracker.markChanged(savedKey);
          }
          // 断网导致的失败不算错误：改动已回滚为「待保存」，联网后自动补交，
          // 因此不返回 error，避免把「离线」当成用户可见的保存报错
          if (!navigator.onLine) {
            logger.warn(`Offline, ${key} kept pending (${savedKeys.length} saved key(s) rolled back)`);
            return { performed: false, offline: true };
          }
          logger.error(`Failed to save ${key}, rolled back ${savedKeys.length} saved key(s)`);
          return { performed: false, error: i18n.t('system:data.saveFailed') };
        }
        savedKeys.push(key);
        ChangeTracker.clearChanged(key);
      }

      DataRepository.flushLocal(this.data);
      return { performed: true };
    } catch (error) {
      logger.error('Failed to save data', error);
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
    this.stripWallpaperDeviceState();
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

    // 预处理：旧格式兼容 —— 如果 imported.pages 为空/undefined 但 imported.websites 非空，
    // 把旧 websites upsert 成一个默认页（isDefault 标记；current 中已有默认页则复用 id 并合并网站，
    // 否则新建），保证后续链路 pages 通路就能拿到导入的网站数据且不产生重复默认页
    let normalizedImported = imported;
    const importedLegacyWebsites = imported.websites;
    const importedPages = imported.pages;
    const needsLegacyMigration =
      (!importedPages || importedPages.length === 0) &&
      importedLegacyWebsites && importedLegacyWebsites.length > 0;
    if (needsLegacyMigration) {
      const existingDefaultInCurrent = (current.pages ?? []).find(p => p.isDefault);
      let migratedPage: Page;
      if (existingDefaultInCurrent) {
        migratedPage = {
          ...existingDefaultInCurrent,
          websites: mergeById(existingDefaultInCurrent.websites, importedLegacyWebsites),
        };
      } else {
        migratedPage = createDefaultPage(importedLegacyWebsites);
      }
      normalizedImported = { ...imported, pages: [migratedPage] };
      // 旧格式迁移：强制指向迁移页 id，保证下游 initialize 后直接切到默认页面看到结果
      normalizedImported.currentPageId = migratedPage.id;
    }

    let merged: UserData;

    if (mode === 'merge') {
      merged = {
        ...current,
        websites: mergeById(current.websites, normalizedImported.websites ?? []),
        pages: mergeById(current.pages, normalizedImported.pages ?? []),
        searchEngines: mergeById(current.searchEngines, normalizedImported.searchEngines ?? []),
        todos: mergeById(current.todos ?? current.todoList, normalizedImported.todos ?? []),
        notes: mergeById(current.notes, normalizedImported.notes ?? []),
        // 调色板字段级合并：导入覆盖、未导入保留；key 统一归一化为 palette-N
        palette: normalizePaletteMap({ ...(current.palette ?? {}), ...(normalizedImported.palette ?? {}) }),
        // 调色板槽别名字段级合并：导入覆盖、未导入保留；key 归一化且仅保留非空别名
        paletteAliases: normalizeAliasMap({
          ...(current.paletteAliases ?? {}),
          ...(normalizedImported.paletteAliases ?? {}),
        }),
        // 配色方案按 id 合并（normalizeSchemeList 保留首个同名项）：导入项在前，同 id 以导入覆盖
        paletteSchemes: normalizeSchemeList([
          ...(normalizedImported.paletteSchemes ?? []),
          ...(current.paletteSchemes ?? []),
        ]),
      };
      // 全局明暗度：导入覆盖、未导入保留（undefined 不写，避免覆盖当前值）
      if (normalizedImported.paletteLightness !== undefined) {
        merged.paletteLightness = normalizeLightness(normalizedImported.paletteLightness);
      }
      // 设置项字段级合并：导入字段覆盖，未导入字段保留
      if (normalizedImported.settings) {
        merged.settings = { ...(current.settings ?? {}), ...normalizedImported.settings };
      }
      // 条件赋值 currentPageId，避免 exactOptionalPropertyTypes 问题
      const mergedPageId = normalizedImported.currentPageId ?? current.currentPageId;
      if (mergedPageId !== undefined) {
        merged.currentPageId = mergedPageId;
      }
    } else {
      // 覆盖：导入数据整体替换（壁纸通过 current 保留）
      merged = { ...current, ...normalizedImported };
    }

    this.data = merged;

    // 同步本地配置项，使 store 初始化时能读取到导入的默认搜索引擎
    if (imported.settings?.defaultSearchEngineId) {
      DataRepository.saveConfigValue(
        STORAGE_KEYS.DEFAULT_SEARCH_ENGINE_ID,
        imported.settings.defaultSearchEngineId,
      );
    }

    // 导入的笔记携带正文，先整体入队，待保存时按「每篇一个分片 + 一次索引」落到云端
    NotesRepository.enqueueAll(merged.notes ?? []);

    DataRepository.flushLocal(this.data);

    // 标记导入的键为已变更，触发保存提示以同步到云端
    ChangeTracker.markChanged('settings');
    ChangeTracker.markChanged('websites');
    ChangeTracker.markChanged('pages');
    // ⚠️ currentPageId 不再持久化（刷新永远显示第一页），不进入 ChangeTracker
    ChangeTracker.markChanged('searchEngines');
    ChangeTracker.markChanged('todos');
    ChangeTracker.markChanged('notes');
    if (normalizedImported.palette) {
      ChangeTracker.markChanged('palette');
    }
    if (normalizedImported.paletteAliases) {
      ChangeTracker.markChanged('paletteAliases');
    }
    if (normalizedImported.paletteSchemes) {
      ChangeTracker.markChanged('paletteSchemes');
    }

    return merged;
  }

  private ensureSettings(): Settings {
    if (!this.data.settings) {
      this.data = { ...this.data, settings: {} };
    }
    return this.data.settings!;
  }

  private updateData(
    key: string,
    updater: () => void,
    persistToLocalStorage?: { key: string; value: string },
    options?: { markAsChanged?: boolean },
  ): void {
    updater();
    const { markAsChanged = true } = options ?? {};
    if (!this.isInitializing() && markAsChanged) {
      ChangeTracker.markChanged(key);
    }
    if (persistToLocalStorage) {
      DataRepository.saveConfigValue(persistToLocalStorage.key, persistToLocalStorage.value);
    }
    DataRepository.saveToLocal(this.data);
  }

  /**
   * 移除旧数据里遗留的壁纸计时锚点字段。
   * 该字段表达的是「这台设备上次换图的时间」，属本机状态（现由 useWallpaperStore 存 localStorage），
   * 不再随 wallpaper 入云；历史数据里可能残留，加载时清掉，避免它继续跟着 wallpaper 被上传。
   */
  private stripWallpaperDeviceState(): void {
    const current = this.data.wallpaper;
    if (!current || !('lastAutoChangeAt' in current)) return;
    const { lastAutoChangeAt: _legacy, ...rest } = current as WallpaperData & { lastAutoChangeAt?: number };
    this.data = { ...this.data, wallpaper: rest };
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

  public updateWeatherEnabled(enabled: boolean): void {
    this.updateSettingsField('weatherEnabled', enabled);
  }

  public updateSearchEnabled(enabled: boolean): void {
    this.updateSettingsField('searchEnabled', enabled);
  }

  public updateNotesEnabled(enabled: boolean): void {
    this.updateSettingsField('notesEnabled', enabled);
  }

  public updateTodosEnabled(enabled: boolean): void {
    this.updateSettingsField('todosEnabled', enabled);
  }

  public updatePagesEnabled(enabled: boolean): void {
    this.updateSettingsField('pagesEnabled', enabled);
  }

  public updateLanguage(language: string): void {
    this.updateSettingsField('language', language);
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

  public updateWallpaperAutoChange(autoChangeEnabled: boolean, autoChangeIntervalHours: number): void {
    this.updateData('wallpaper', () => {
      const current = this.data.wallpaper;
      this.data = {
        ...this.data,
        wallpaper: current
          ? { ...current, autoChangeEnabled, autoChangeIntervalHours }
          : { url: null, type: 'gradient', autoChangeEnabled, autoChangeIntervalHours },
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

  /**
   * 笔记变更入口：与当前数据做 diff，只把真正的增量交给 NotesRepository（改一条只写一条分片），
   * 「加载正文」不构成变更，避免静默加载触发保存提示。初始化期间只更新内存、不入队。
   */
  public updateNotes(notes: Note[]): void {
    const changed = this.isInitializing() ? false : this.diffNotes(this.data.notes ?? [], notes);
    this.updateData(
      'notes',
      () => {
        this.data = { ...this.data, notes: notes };
      },
      undefined,
      { markAsChanged: changed },
    );
  }

  /**
   * 对比前后两份笔记，把差异入队到 NotesRepository。
   * 返回是否存在「真实变更」（用于 markChanged）；正文由「未加载」变为「已加载」不算变更。
   */
  private diffNotes(previous: Note[], next: Note[]): boolean {
    const prevById = new Map(previous.map((note) => [note.id, note]));
    let changed = false;

    for (const note of next) {
      const before = prevById.get(note.id);
      if (!before) {
        // 新增笔记：正文与元数据都写
        NotesRepository.enqueue(note);
        changed = true;
        continue;
      }

      const wasLoaded = before.contentLoaded === true || before.content !== '';
      const isLoading = !wasLoaded && note.contentLoaded === true;
      if (before.content !== note.content && !isLoading) {
        NotesRepository.enqueue(note);
        changed = true;
      } else if (
        before.title !== note.title ||
        before.preview !== note.preview ||
        before.color !== note.color ||
        before.colorSlot !== note.colorSlot ||
        before.updatedAt !== note.updatedAt ||
        before.pinned !== note.pinned
      ) {
        // 仅元数据变化（标题/摘要/颜色/时间），不重写正文分片
        NotesRepository.enqueueMeta(note);
        changed = true;
      }
    }

    const nextIds = new Set(next.map((note) => note.id));
    for (const before of previous) {
      if (!nextIds.has(before.id)) {
        NotesRepository.enqueueDelete(before.id);
        changed = true;
      }
    }

    const orderChanged =
      previous.length !== next.length || next.some((note, index) => previous[index]?.id !== note.id);
    if (orderChanged) {
      NotesRepository.enqueueOrder(next.map((note) => note.id));
      changed = true;
    }

    return changed;
  }

  /**
   * 初始化完成后的笔记同步（在本地镜像写盘前同步执行）：
   * · 已确认分片格式：仅当上次退出时确有未保存的 notes 变更，才整包补交（正文只取本地仍持有的）；
   * · 尚未确认分片格式：本地镜像里可能存着旧格式正文，静默全量推送一次，成功后才允许剥离本地正文。
   */
  public async syncNotesAfterInit(): Promise<void> {
    const notes = this.data.notes ?? [];

    if (NotesRepository.isSharded()) {
      if (ChangeTracker.getChangedKeys().includes('notes')) {
        NotesRepository.enqueueAll(notes);
      }
      return;
    }

    if (!notes.some((note) => note.contentLoaded === true || note.content !== '')) {
      // 本地没有正文（新设备/新装）：云端已是分片格式，直接确认
      NotesRepository.markSharded();
      return;
    }

    NotesRepository.enqueueAll(notes);
    const ok = await NotesRepository.flushPending();
    if (ok) {
      NotesRepository.markSharded();
    } else {
      logger.warn('Initial notes migration to sharded storage failed, will retry on next launch');
    }
  }

  public updatePalette(palette: PaletteHexMap): void {
    this.updateData('palette', () => {
      this.data = { ...this.data, palette };
    });
  }

  public updatePaletteAliases(aliases: PaletteAliasMap): void {
    this.updateData('paletteAliases', () => {
      this.data = { ...this.data, paletteAliases: normalizeAliasMap(aliases) };
    });
  }

  public updatePaletteSchemes(schemes: PaletteScheme[]): void {
    this.updateData('paletteSchemes', () => {
      this.data = { ...this.data, paletteSchemes: normalizeSchemeList(schemes) };
    });
  }

  public updatePaletteLightness(lightness: number): void {
    this.updateData('paletteLightness', () => {
      this.data = { ...this.data, paletteLightness: normalizeLightness(lightness) };
    });
  }

  public updateDefaultSearchEngineId(engineId: string): void {
    // 主页面切换默认搜索引擎 → 写内存 + 本地持久化 + 云端静默同步，
    // 但**不 markChanged**，这样 SavePrompt 不会弹出"需要保存"的图标和倒计时提醒。
    // 项目约束：defaultSearchEngineId 必须同步到云端（不能只写本地）。
    // 云同步失败时仅打日志，有双重兜底：① saveToLocal 已防刷新丢失 ② 用户之后任何触发
    // settings 键 markChanged 的操作（如 autoSave / faviconSources）都会重新整体上传 settings。
    this.updateData(
      'settings',
      () => {
        this.data = {
          ...this.data,
          settings: { ...this.ensureSettings(), defaultSearchEngineId: engineId },
        };
      },
      { key: STORAGE_KEYS.DEFAULT_SEARCH_ENGINE_ID, value: engineId },
      { markAsChanged: false },
    );

    // ⚠️ 不经过 ChangeTracker / saveChanges，不触发任何 UI（SavePrompt/Toast/倒计时）
    const settingsSnapshot = { ...this.ensureSettings() };
    (async () => {
      try {
        await DataRepository.saveKeyToAPI('settings', settingsSnapshot);
      } catch (err) {
        logger.warn('Silent cloud sync of defaultSearchEngineId failed (later operations will retry automatically):', err);
      }
    })();
  }

  public updateFaviconSources(sources: import('../types').FaviconSource[]): void {
    this.updateSettingsField('faviconSources', sources);
  }

  public updatePages(pages: Page[]): void {
    this.updateData('pages', () => {
      this.data = { ...this.data, pages };
    });
  }

  public updateCurrentPageId(id: string): void {
    this.updateData('currentPageId', () => {
      this.data = { ...this.data, currentPageId: id };
    });
  }
}

export default DataManager.getInstance();