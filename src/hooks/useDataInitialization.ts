import { useEffect } from 'react';
import { getServices } from '../services/serviceContainer';
import { initializeAllStores } from '../services/storeInitializer';
import FaviconConfigService from '../services/FaviconConfigService';
import createLogger from '../utils/logger';

const logger = createLogger('DataInit');

export function useDataInitialization(isAuthenticated: boolean, isCheckingAuth: boolean) {
  useEffect(() => {
    if (!isAuthenticated || isCheckingAuth) return;

    let cancelled = false;
    const dataManager = getServices().dataManager;

    const initData = async () => {
      dataManager.startInitialization();
      try {
        await dataManager.initialize();
        if (cancelled) return;
        const data = dataManager.getData();
        initializeAllStores(data);
        // 预加载后端默认 favicon 源到内存缓存（前端不再硬编码默认源常量）
        await FaviconConfigService.loadDefaultSources();
        // 注意：不再调用 ChangeTracker.clearAll()
        // 原因：syncToDataManager() 在 _isInitializing=true 时不会调用 markChanged()，
        // 所以初始化期间不会产生新的变更标记。而 loadState() 从 localStorage 恢复的
        // 未保存变更标记是用户上次会话遗留的真实未保存数据，必须保留以便自动保存触发。
      } catch (error) {
        if (!cancelled) {
          logger.error('数据初始化失败', error);
        }
      } finally {
        if (!cancelled) {
          dataManager.endInitialization();
        }
      }
    };

    initData();
    return () => { cancelled = true; };
  }, [isAuthenticated, isCheckingAuth]);
}