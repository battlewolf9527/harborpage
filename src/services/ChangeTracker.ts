import DataRepository from './DataRepository';

class ChangeTracker {
  private static instance: ChangeTracker;
  private changes: Set<string> = new Set();
  private listeners: Set<(hasChanges: boolean) => void> = new Set();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: boolean = false;

  private constructor() {}

  public static getInstance(): ChangeTracker {
    if (!ChangeTracker.instance) {
      ChangeTracker.instance = new ChangeTracker();
    }
    return ChangeTracker.instance;
  }

  public markChanged(key: string): void {
    this.changes.add(key);
    this.scheduleSave();
    this.notifyListeners();
  }

  public clearChanged(key: string): void {
    this.changes.delete(key);
    this.scheduleSave();
    if (this.changes.size === 0) this.notifyListeners();
  }

  public hasChanges(): boolean {
    return this.changes.size > 0;
  }

  public getChangedKeys(): string[] {
    return Array.from(this.changes);
  }

  public clearAll(): void {
    // 先取消任何待执行的防抖保存定时器，防止竞态
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.changes.clear();
    this.pendingSave = false;
    // 立即同步一个空集到 localStorage，覆盖之前的状态
    DataRepository.saveUnsavedChanges([]);
    this.notifyListeners();
  }

  public subscribe(listener: (hasChanges: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const hasChanges = this.changes.size > 0;
    this.listeners.forEach(listener => listener(hasChanges));
  }

  public loadState(): void {
    const savedKeys = DataRepository.loadUnsavedChanges();
    if (savedKeys) {
      this.changes = new Set(savedKeys);
      if (this.changes.size > 0) {
        this.notifyListeners();
      }
    }
  }

  private scheduleSave(): void {
    this.pendingSave = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.flushSave();
    }, 300);
  }

  private flushSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.pendingSave) {
      DataRepository.saveUnsavedChanges(Array.from(this.changes));
      this.pendingSave = false;
    }
  }
}

export default ChangeTracker.getInstance();
