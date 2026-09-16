import React, { useEffect, useRef, useCallback, useState, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'
import Search from './components/features/Search'
import SettingsWindow from './components/ui/SettingsWindow'
import FolderWindow from './components/features/FolderWindow'
import IconsContainer from './components/layout/IconsContainer';
import Background from './components/layout/Background';
import ConfirmDialog from './components/common/ConfirmDialog';
import FolderNameDialog from './components/common/FolderNameDialog';
import SavePrompt from './components/common/SavePrompt';
import LoginModal from './components/common/LoginModal';
import ErrorBoundary from './components/common/ErrorBoundary';
import ImportProgressOverlay from './components/common/ImportProgressOverlay';
import MoveToPageDialog from './components/common/MoveToPageDialog';
import FeatureDock from './components/common/FeatureDock';
import { useSettingsSelector, useIconsDataSelector, useIconsUISelector, useImportSelector, usePagesSelector } from './store/selectors'
import type { Website, SearchEngine } from './types'
import { useAuth } from './hooks/useAuth';
import { useDataInitialization } from './hooks/useDataInitialization';
import { useLongPress } from './hooks/useLongPress';
import { useDeleteIcon } from './hooks/useDeleteIcon';
import { useAddWebsiteShortcut } from './hooks/useAddWebsiteShortcut';
import { useWallpaperInit } from './hooks/useWallpaperInit';
import { useWallpaperAutoChange } from './hooks/useWallpaperAutoChange';
import { isClickOnEmptyArea } from './utils/deviceUtils';
import IconDownloadQueue from './services/IconDownloadQueue';
import DataRepository from './services/DataRepository';
import { cleanupWallpaperPersist } from './store/useWallpaperStore';

/**
 * 按需加载（code-split）的组件。
 *
 * 这些组件只在特定条件下出现（功能开关、用户交互），首屏并不需要，
 * 因此改为动态 import，把它们的代码从首屏 chunk 中挪出。
 * 天气模块额外带出 lunisolar（约 47 kB）与图标字体样式；
 * 设置面板带出其下若干管理器子组件（壁纸/搜索/图标/备份等）。
 *
 * 注意：Settings / FolderWindow 是「常驻挂载 + 内部 isOpen 门控」的组件，
 * 不能简单用 `{cond && <Lazy/>}` 包裹，否则关闭时会瞬间卸载、丢掉滑出动画。
 * 这里用「首次打开后持续挂载」的守卫（hasOpenedSettings）来保留其开合过渡。
 */
const Weather = lazy(() => import('./components/features/Weather'));
const EditWebsite = lazy(() => import('./components/common/EditWebsite'));
const TodoSidebar = lazy(() => import('./components/features/TodoSidebar'));
const PagesSidebar = lazy(() => import('./components/features/PagesSidebar'));
const NoteBar = lazy(() => import('./components/ui/NoteBar'));
const Settings = lazy(() => import('./components/ui/Settings'));

const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = title;
    return () => {
      document.title = originalTitle;
    };
  }, [title]);
};

function App() {
  const { t } = useTranslation('common');
  const { isAuthenticated, isCheckingAuth, handleLogin } = useAuth();
  useWallpaperInit(isAuthenticated, isCheckingAuth);
  useWallpaperAutoChange(isAuthenticated, isCheckingAuth);
  const settingsWindowRef = useRef<{ handleClose: () => void }>(null);
  const addIconWindowRef = useRef<{ handleClose: () => void }>(null);

  useEffect(() => {
    const handleUnload = () => {
      IconDownloadQueue.cleanup();
      DataRepository.cleanup();
      cleanupWallpaperPersist();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      IconDownloadQueue.cleanup();
      DataRepository.cleanup();
      cleanupWallpaperPersist();
    };
  }, []);

  const { iconColumns, siteTitle, weatherEnabled, searchEnabled, notesEnabled, todosEnabled, pagesEnabled, settingsReady } = useSettingsSelector();
  useDocumentTitle(siteTitle || t('defaultSiteTitle'));

  const {
    websites, openFolder, setOpenFolder, setWebsiteIcons,
    addIcon, updateIcon, dragIconOut, changeFolderName,
    disbandFolder, deleteFolder, updateFolderIcons, createFolder,
    changeFolderColor,
  } = useIconsDataSelector();

  const {
    showAddIcon, showEditIcon, editingIcon,
    showFolderNameDialog,
    showSettings, setShowAddIcon, setShowEditIcon,
    setEditingIcon, setShowSettings, setShowFolderNameDialog,
  } = useIconsUISelector();

  const { isImporting, importProgress, importMessage } = useImportSelector();
  const { currentPageId } = usePagesSelector();

  /* 设置面板首次打开后才开始挂载（懒加载）；打开过一次后保持挂载，
     以便关闭时的滑出过渡能正常播放（组件内部负责延迟卸载）。
     用渲染期间的「派生状态」latch，避免在 effect 里 setState 触发级联渲染。 */
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  if (showSettings && !hasOpenedSettings) {
    setHasOpenedSettings(true);
  }

  // 跨页移动：fromPageId 通常 = currentPageId；将来扩展 FolderWindow 内部移动时可灵活指定
  const [moveDialog, setMoveDialog] = useState<{ fromPageId: string; iconIds: string[] } | null>(null);
  const handleOpenMoveDialog = useCallback((icon: Website) => {
    if (currentPageId) {
      setMoveDialog({ fromPageId: currentPageId, iconIds: [icon.id] });
    }
  }, [currentPageId]);

  const { showConfirmDialog, handleDeleteIcon, confirmDeleteIcon, cancelDeleteIcon } = useDeleteIcon();

  useDataInitialization(isAuthenticated, isCheckingAuth);

  // 快捷键唤起添加网站窗口时预填的网址
  const [addIconInitialUrl, setAddIconInitialUrl] = useState<string | undefined>(undefined);

  const handleShortcutTrigger = useCallback((url: string | undefined) => {
    setAddIconInitialUrl(url);
    setShowAddIcon(true);
  }, [setShowAddIcon]);

  useAddWebsiteShortcut({
    enabled: isAuthenticated,
    onTrigger: handleShortcutTrigger,
  });

  // 文件夹窗口空白处右键 → 打开「新增网站」（提交后由 handleAddIcon 插入当前文件夹）
  const handleOpenAddSiteFromFolder = useCallback(() => {
    setShowAddIcon(true);
  }, [setShowAddIcon]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isClickOnEmptyArea(e.target as HTMLElement)) {
      setShowAddIcon(true);
    }
  }, [setShowAddIcon]);

  // 触屏长按空白处 → 直接展开「新增网站」侧边栏。
  // 桌面端由右键负责，触屏没有 contextmenu 可用，所以长按只在触屏生效。
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useLongPress(() => {
    setShowAddIcon(true);
  });

  const handleAddIcon = useCallback((icon: Website) => {
    if (openFolder) {
      // 如果文件夹打开中，将图标添加到文件夹中
      const newIcons = websites.map(item => {
        if (item.isFolder && item.id === openFolder.id) {
          return {
            ...item,
            children: [...(item.children || []), icon]
          };
        }
        return item;
      });
      setWebsiteIcons(newIcons);
    } else {
      // 否则添加到根级别
      addIcon(icon);
    }
    setShowAddIcon(false);
    setAddIconInitialUrl(undefined);
  }, [addIcon, openFolder, websites, setWebsiteIcons, setShowAddIcon]);

  const handleCreateFolder = useCallback((name?: string) => {
    createFolder(name);
    setShowFolderNameDialog(false);
  }, [createFolder, setShowFolderNameDialog]);

  const handleSearch = useCallback((query: string, engine: SearchEngine) => {
    window.open(engine.url.replace('{q}', encodeURIComponent(query)), '_blank');
  }, []);

  const handleEditIcon = useCallback((icon: Website) => {
    setEditingIcon(icon);
    setShowEditIcon(true);
  }, [setEditingIcon, setShowEditIcon]);

  // 当前打开文件夹对象（供取色/展示其水晶材质色：iconColor 快照/静态 + colorSlot 槽绑定）
  const openFolderIcon = openFolder
    ? websites.find((item) => item.isFolder && item.id === openFolder.id) ?? null
    : null;

  if (isCheckingAuth) {
    return (
      <div className="app-container" data-click-area="empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div className="login-spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="app-container" data-click-area="empty">
        <Background />
        <LoginModal onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div 
      className="app-container" 
      data-click-area="empty"
      onContextMenu={handleContextMenu} 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Background />
      {/* 等账号设置加载完成后再挂载天气组件，避免天气关闭时仍触发定位/天气请求 */}
      {settingsReady && weatherEnabled && (
        <Suspense fallback={null}>
          <Weather />
        </Suspense>
      )}
      
      <button 
        className="settings-button"
        onClick={() => setShowSettings(!showSettings)}
        aria-label={t('settings')}
      >
        ⚙️
      </button>

      {searchEnabled && <Search onSearch={handleSearch} />}
      
      <IconsContainer
        websites={websites}
        iconColumns={iconColumns}
        onIconsChange={setWebsiteIcons}
        onOpenFolder={(id, name, websites) => setOpenFolder({ id, name, websites })}
        onEditIcon={handleEditIcon}
        onDeleteIcon={handleDeleteIcon}
        onMoveToPage={handleOpenMoveDialog}
      />
      
      <FolderWindow
        folderName={openFolder?.name || ''}
        folderColor={openFolderIcon?.iconColor || ''}
        {...(openFolderIcon?.colorSlot ? { folderColorSlot: openFolderIcon.colorSlot } : {})}
        icons={openFolder?.websites || []}
        isOpen={!!openFolder}
        onClose={() => setOpenFolder(null)}
        iconColumns={iconColumns}
        onIconDragOut={dragIconOut}
        onIconsChange={updateFolderIcons}
        onFolderNameChange={changeFolderName}
        onFolderColorChange={changeFolderColor}
        onEditIcon={handleEditIcon}
        onDeleteIcon={handleDeleteIcon}
        onAddSite={handleOpenAddSiteFromFolder}
        onDisbandFolder={disbandFolder}
        onDeleteFolder={deleteFolder}
        onMoveToPage={handleOpenMoveDialog}
        disableClickOutside={showEditIcon || showAddIcon || showSettings || !!moveDialog}
      />
      
      {(hasOpenedSettings || showSettings) && (
        <Suspense fallback={null}>
          <Settings
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
          />
        </Suspense>
      )}
      
      {showAddIcon && (
        <Suspense fallback={null}>
          <SettingsWindow
            ref={addIconWindowRef}
            title={t('addWebsite')}
            onClose={() => {
              setShowAddIcon(false);
              setAddIconInitialUrl(undefined);
            }}
          >
            <EditWebsite
              onSubmit={handleAddIcon}
              onClose={() => {
                if (addIconWindowRef.current) {
                  addIconWindowRef.current.handleClose();
                }
              }}
              initialUrl={addIconInitialUrl}
            />
          </SettingsWindow>
        </Suspense>
      )}

      {showEditIcon && editingIcon && (
        <Suspense fallback={null}>
          <SettingsWindow
            ref={settingsWindowRef}
            title={t('editWebsite')}
            onClose={() => {
              setShowEditIcon(false);
              setEditingIcon(null);
            }}
          >
            <EditWebsite
              onSubmit={updateIcon}
              onClose={() => {
                if (settingsWindowRef.current) {
                  settingsWindowRef.current.handleClose();
                }
              }}
              icon={editingIcon}
            />
          </SettingsWindow>
        </Suspense>
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={t('deleteConfirmTitle')}
        message={t('deleteConfirmMessage')}
        onConfirm={confirmDeleteIcon}
        onCancel={cancelDeleteIcon}
      />

      {/* 宿主 Dock：为已注册功能渲染共享入口球（倒置依赖宿主侧） */}
      <FeatureDock />

      {pagesEnabled && (
        <Suspense fallback={null}>
          <PagesSidebar />
        </Suspense>
      )}
      {todosEnabled && (
        <Suspense fallback={null}>
          <TodoSidebar />
        </Suspense>
      )}

      {/* 底部半隐入笔记栏（仅登录后展示）；功能开关关闭时不渲染入口 peek 球 */}
      {notesEnabled && (
        <Suspense fallback={null}>
          <NoteBar />
        </Suspense>
      )}

      <MoveToPageDialog
        isOpen={!!moveDialog}
        fromPageId={moveDialog?.fromPageId ?? ''}
        iconIds={moveDialog?.iconIds ?? []}
        onClose={() => setMoveDialog(null)}
      />
      
      <FolderNameDialog
        isOpen={showFolderNameDialog}
        onClose={handleCreateFolder}
      />
      
      <SavePrompt />

      <ImportProgressOverlay 
        isImporting={isImporting}
        importProgress={importProgress}
        importMessage={importMessage}
      />
    </div>
    </ErrorBoundary>
  )
}

export default App