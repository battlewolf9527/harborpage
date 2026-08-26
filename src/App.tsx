import React, { useEffect, useRef, useCallback, useState } from 'react'
import './App.css'
import Search from './components/features/Search'
import SettingsWindow from './components/ui/SettingsWindow'
import FolderWindow from './components/features/FolderWindow'
import IconsContainer from './components/layout/IconsContainer';
import Background from './components/layout/Background';
import EditWebsite from './components/common/EditWebsite';
import Settings from './components/ui/Settings'
import ConfirmDialog from './components/common/ConfirmDialog';
import FolderNameDialog from './components/common/FolderNameDialog';
import SavePrompt from './components/common/SavePrompt';
import LoginModal from './components/common/LoginModal';
import ErrorBoundary from './components/common/ErrorBoundary';
import ImportProgressOverlay from './components/common/ImportProgressOverlay';
import MoveToPageDialog from './components/common/MoveToPageDialog';
import { useSettingsSelector, useIconsDataSelector, useIconsUISelector, useImportSelector, usePagesSelector } from './store/selectors'
import Weather from './components/features/Weather'
import TodoSidebar from './components/features/TodoSidebar'
import PagesSidebar from './components/features/PagesSidebar'
import type { Website, SearchEngine } from './types'
import { useAuth } from './hooks/useAuth';
import { useDataInitialization } from './hooks/useDataInitialization';
import { useLongPress } from './hooks/useLongPress';
import { useDeleteIcon } from './hooks/useDeleteIcon';
import { useAddWebsiteShortcut } from './hooks/useAddWebsiteShortcut';
import { useWallpaperInit } from './hooks/useWallpaperInit';
import { isClickOnEmptyArea } from './utils/deviceUtils';
import IconDownloadQueue from './services/IconDownloadQueue';
import DataRepository from './services/DataRepository';
import { cleanupWallpaperPersist } from './store/useWallpaperStore';

const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = title || '我的导航';
    return () => {
      document.title = originalTitle;
    };
  }, [title]);
};

function App() {
  const { isAuthenticated, isCheckingAuth, handleLogin } = useAuth();
  useWallpaperInit(isAuthenticated, isCheckingAuth);
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

  const { iconColumns, siteTitle } = useSettingsSelector();
  useDocumentTitle(siteTitle);

  const {
    websites, openFolder, setOpenFolder, setWebsiteIcons,
    addIcon, updateIcon, dragIconOut, changeFolderName,
    disbandFolder, deleteFolder, updateFolderIcons, createFolder,
  } = useIconsDataSelector();

  const {
    isEditMode, showAddIcon, showEditIcon, editingIcon,
    showFolderNameDialog,
    showSettings, setIsEditMode, setShowAddIcon, setShowEditIcon,
    setEditingIcon, setShowSettings, setShowFolderNameDialog,
  } = useIconsUISelector();

  const { isImporting, importProgress, importMessage } = useImportSelector();
  const { currentPageId } = usePagesSelector();

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

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isClickOnEmptyArea(e.target as HTMLElement)) {
      setShowAddIcon(true);
    }
  }, [setShowAddIcon]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isClickOnEmptyArea(e.target as HTMLElement)) {
      setIsEditMode(false);
    }
  }, [setIsEditMode]);

  const { handleMouseDown, handleMouseUp, handleMouseLeave } = useLongPress(() => {
    setIsEditMode(true);
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
    setIsEditMode(false);
    setShowAddIcon(false);
    setAddIconInitialUrl(undefined);
  }, [addIcon, openFolder, websites, setWebsiteIcons, setIsEditMode, setShowAddIcon]);

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

  if (isCheckingAuth) {
    return (
      <div className="app-container" data-click-area="empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
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
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <Background />
      <Weather />
      
      <button 
        className="settings-button"
        onClick={() => setShowSettings(!showSettings)}
        aria-label="设置"
      >
        ⚙️
      </button>

      <Search onSearch={handleSearch} />
      
      <IconsContainer
        websites={websites}
        iconColumns={iconColumns}
        onIconsChange={setWebsiteIcons}
        onOpenFolder={(id, name, websites) => setOpenFolder({ id, name, websites })}
        onEditIcon={handleEditIcon}
        onDeleteIcon={handleDeleteIcon}
        onMoveToPage={handleOpenMoveDialog}
      />
      
      {isEditMode && (
        <div className="add-icon-button-container">
          <button 
            className="add-icon-button"
            onClick={() => setShowAddIcon(true)}
            aria-label="新增网站"
          >
            +
          </button>
        </div>
      )}
      
      <FolderWindow
        folderName={openFolder?.name || ''}
        icons={openFolder?.websites || []}
        isOpen={!!openFolder}
        onClose={() => setOpenFolder(null)}
        iconColumns={iconColumns}
        onIconDragOut={dragIconOut}
        onIconsChange={updateFolderIcons}
        onFolderNameChange={changeFolderName}
        onEditIcon={handleEditIcon}
        onDeleteIcon={handleDeleteIcon}
        onDisbandFolder={disbandFolder}
        onDeleteFolder={deleteFolder}
        onMoveToPage={handleOpenMoveDialog}
        disableClickOutside={showEditIcon || showAddIcon || showSettings || !!moveDialog}
      />
      
      <Settings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
      
      {showAddIcon && (
        <SettingsWindow
          ref={addIconWindowRef}
          title="新增网站"
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
      )}

      {showEditIcon && editingIcon && (
        <SettingsWindow 
          ref={settingsWindowRef}
          title="修改网站"
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
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="确认删除"
        message="确定要删除这个网站吗？"
        onConfirm={confirmDeleteIcon}
        onCancel={cancelDeleteIcon}
      />

      <PagesSidebar />
      <TodoSidebar />

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