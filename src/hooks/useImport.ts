import { useState, useCallback, useRef, useEffect } from 'react';
import type { Website, ImportableWebsite } from '../types';
import { useIconsStore } from '../store/useIconsStore';
import { useIconsUIStore } from '../store/useIconsUIStore';
import { useImportStore } from '../store/useImportStore';
import { getServices } from '../services/serviceContainer';
import { getFaviconUrl } from '../services/IconManager';
import { generateId } from '../utils/idUtils';
import createLogger from '../utils/logger';

const logger = createLogger('useImport');

export interface DuplicateSite {
  name: string;
  url: string;
  location: 'desktop' | string;
}

export interface UseImportResult {
  duplicates: DuplicateSite[];
  showDuplicateDialog: boolean;
  duplicateAction: 'overwrite' | 'ignore';
  setDuplicateAction: (action: 'overwrite' | 'ignore') => void;
  setShowDuplicateDialog: (show: boolean) => void;
  checkDuplicate: (site: Website) => DuplicateSite | null;
  findDuplicates: (sites: Website[]) => DuplicateSite[];
  doImport: (sitesToImport: ImportableWebsite[], importStructure: boolean, overwriteAll: boolean, duplicateAction: 'overwrite' | 'ignore') => Promise<void>;
}

export const useImport = (): UseImportResult => {
  const [duplicates, setDuplicates] = useState<DuplicateSite[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'ignore'>('ignore');

  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  const setShowSettings = useIconsUIStore((s) => s.setShowSettings);
  const setIsImporting = useImportStore((s) => s.setIsImporting);
  const setImportProgress = useImportStore((s) => s.setImportProgress);
  const setImportMessage = useImportStore((s) => s.setImportMessage);

  const checkDuplicate = useCallback((site: Website): DuplicateSite | null => {
    const currentWebsites = useIconsStore.getState().websites;
    const desktopExists = currentWebsites.some(
      (icon: Website) => !icon.isFolder && icon.name === site.name && icon.url === site.url
    );
    if (desktopExists) {
      return { name: site.name, url: site.url, location: 'desktop' };
    }

    for (const folder of currentWebsites) {
      if (folder.isFolder && folder.children) {
        const exists = folder.children.some(
          (child: Website) => child.name === site.name && child.url === site.url
        );
        if (exists) {
          return { name: site.name, url: site.url, location: folder.name };
        }
      }
    }

    return null;
  }, []);

  const findDuplicates = useCallback((sites: Website[]): DuplicateSite[] => {
    const found: DuplicateSite[] = [];
    sites.forEach(site => {
      const duplicate = checkDuplicate(site);
      if (duplicate) {
        const exists = found.some(
          d => d.name === site.name && d.url === site.url && d.location === duplicate.location
        );
        if (!exists) {
          found.push(duplicate);
        }
      }
    });
    return found;
  }, [checkDuplicate]);

  const doImport = useCallback(async (
    sitesToImport: ImportableWebsite[],
    importStructure: boolean,
    overwriteAll: boolean,
    duplicateAction: 'overwrite' | 'ignore'
  ) => {
    const actualOverwrite = overwriteAll || duplicateAction === 'overwrite';

    setIsImporting(true);
    setImportProgress(0);
    setImportMessage('正在准备导入...');

    try {
      const requiredFolders = new Set<string>();
      if (importStructure) {
        sitesToImport.forEach(site => {
          if (site.parentFolder) {
            requiredFolders.add(site.parentFolder);
          }
        });
      }

      setImportMessage('正在创建目录...');
      const { websites: currentWebsites, createFolderDirectly } = useIconsStore.getState();
      requiredFolders.forEach(folderName => {
        const exists = currentWebsites.some(
          (icon: Website) => icon.isFolder && icon.name === folderName
        );
        if (!exists) {
          createFolderDirectly(folderName);
        }
      });

      const totalSites = sitesToImport.length;
      let processedSites = 0;

      for (const site of sitesToImport) {
        const duplicate = checkDuplicate(site);

        if (duplicate && !actualOverwrite) {
          processedSites++;
          continue;
        }

        // 为导入的站点生成新 ID，避免与已有站点 ID 冲突
        const newId = generateId();

        // 仅当图标 URL 为空时才预缓存（自动 favicon 模式）
        // icon 字段不为空时（用户自定义 URL 或 R2 URL）由前端直接加载，不需要预缓存
        if (site.url && !site.icon) {
          try {
            const domain = new URL(site.url).hostname;
            const downloadUrl = getFaviconUrl(domain);
            const { iconManager } = getServices();
            await iconManager.preloadIcon('site', newId, downloadUrl, domain);
          } catch (error) {
            logger.error(`预缓存图标失败: ${site.name}`, error);
          }
        }

        const { parentFolder: _, id: _originalId, ...siteData } = site;
        const newSite: Website = {
          ...siteData,
          id: newId,
          isFolder: false,
        };

        const { websites: latestWebsites, addIcon, addIconToFolder } = useIconsStore.getState();
        if (site.parentFolder && importStructure) {
          addIconToFolder(site.parentFolder, newSite);
        } else {
          const desktopExists = latestWebsites.some(
            (icon: Website) => !icon.isFolder && icon.name === site.name && icon.url === site.url
          );

          if (!desktopExists || actualOverwrite) {
            addIcon(newSite);
          }
        }

        processedSites++;
        setImportProgress(Math.round((processedSites / totalSites) * 100));
        setImportMessage(`正在导入: ${site.name}`);
      }

      setImportMessage('导入完成');
    } catch (error) {
      logger.error('导入过程中发生错误', error);
      setImportMessage(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
      // 失败时延长清理时间，让用户有时间阅读错误信息
      cleanupTimerRef.current = setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportMessage('');
        setShowDuplicateDialog(false);
        setDuplicates([]);
        setShowSettings(false);
        cleanupTimerRef.current = null;
      }, 5000);
      return;
    } finally {
      // 成功时使用短延迟
      if (!cleanupTimerRef.current) {
        cleanupTimerRef.current = setTimeout(() => {
          setIsImporting(false);
          setImportProgress(0);
          setImportMessage('');
          setShowDuplicateDialog(false);
          setDuplicates([]);
          setShowSettings(false);
          cleanupTimerRef.current = null;
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    checkDuplicate,
    setShowDuplicateDialog,
    setDuplicates,
  ]);
  return {
    duplicates,
    showDuplicateDialog,
    duplicateAction,
    setDuplicateAction,
    setShowDuplicateDialog,
    checkDuplicate,
    findDuplicates,
    doImport,
  };
};
