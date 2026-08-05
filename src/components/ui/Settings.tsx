import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import SettingsWindow from './SettingsWindow';
import WallpaperManager from '../features/WallpaperManager';
import SearchManager from '../features/SearchManager';
import Notes from '../common/Notes';
import IconSettings from './IconSettings';
import FaviconSettings from './FaviconSettings';
import ImportPresetDialog from './ImportPresetDialog';
import ImportExport from './ImportExport';
import ConfirmDialog from '../common/ConfirmDialog';
import AboutDialog from '../common/AboutDialog';
import Toast from '../common/Toast';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useIconsStore } from '../../store/useIconsStore';
import { getServices } from '../../services/serviceContainer';
import DataRepository from '../../services/DataRepository';
import { initializeAllStores, clearAllPendingDeletes } from '../../services/storeInitializer';
import { useAutoSaveSettings } from '../../hooks/useAutoSaveSettings';
import createLogger from '../../utils/logger';

const logger = createLogger('Settings');

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [showWallpaperManager, setShowWallpaperManager] = useState(false);
  const [showSearchManager, setShowSearchManager] = useState(false);
  const [showFaviconManager, setShowFaviconManager] = useState(false);
  const [showNotesManager, setShowNotesManager] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showClearSitesConfirm, setShowClearSitesConfirm] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string; onContinue?: () => void; continueText?: string } | null>(null);
  
  const authService = getServices().authService;
  const dataManager = getServices().dataManager;
  const { autoSaveDuration, autoSaveEnabled, setAutoSaveDuration, setAutoSaveEnabled } = useAutoSaveSettings();
  
  // 从Zustand store获取状态和方法
  const {
    siteTitle,
    setSiteTitle,
    iconColumns,
    setIconColumns,
  } = useSettingsStore(
    useShallow((s) => ({
      siteTitle: s.siteTitle,
      setSiteTitle: s.setSiteTitle,
      iconColumns: s.iconColumns,
      setIconColumns: s.setIconColumns,
    })),
  );

  // 从KV加载数据
  const handleLoadFromKV = async () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmLoadFromKV = async () => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    try {
      const response = await fetch('/api/data', {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (response.ok) {
        const data = await response.json();
        dataManager.startInitialization();
        try {
          dataManager.setData(data);
          initializeAllStores(data);
          clearAllPendingDeletes();
        } finally {
          dataManager.endInitialization();
        }
        window.dispatchEvent(new CustomEvent('dataLoadedFromCloud'));
        setToast({ type: 'success', message: '数据加载成功' });
      } else {
        setToast({ type: 'error', message: '加载失败，请重试' });
      }
    } catch (error) {
      logger.error('加载数据失败', error);
      setToast({ type: 'error', message: '加载失败，请检查网络连接' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelLoadFromKV = () => {
    setShowConfirmDialog(false);
  };

  const handleCleanupIcons = async () => {
    setShowCleanupConfirm(true);
  };

  const handleImportPreset = () => {
    setShowImportDialog(true);
  };

  const handleCloseImportDialog = () => {
    setShowImportDialog(false);
  };

  const handleClearAllSites = () => {
    setShowClearSitesConfirm(true);
  };

  const handleConfirmClearAllSites = () => {
    setShowClearSitesConfirm(false);
    useIconsStore.getState().clearAllSites();
    setToast({ type: 'success', message: '已清空所有站点' });
  };

  const handleConfirmCleanupIcons = async (cursor?: string, prefix?: string) => {
    setShowCleanupConfirm(false);
    setIsCleaningUp(true);
    try {
      let url = '/api/icon?action=cleanup';
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }
      if (prefix) {
        url += `&prefix=${encodeURIComponent(prefix)}`;
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (response.ok) {
        const result = await response.json();
        if (result.hasMore && result.cursor) {
          // 还有更多图标需要清理，显示继续按钮
          setToast({ 
            type: 'success', 
            message: result.message,
            onContinue: () => handleConfirmCleanupIcons(result.cursor, result.prefix),
            continueText: '继续清理'
          });
        } else {
          setToast({ type: 'success', message: result.message });
        }
      } else {
        setToast({ type: 'error', message: '清理失败，请重试' });
      }
    } catch (error) {
      logger.error('清理图标失败', error);
      setToast({ type: 'error', message: '清理失败，请检查网络连接' });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleCancelCleanupIcons = () => {
    setShowCleanupConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <SettingsWindow 
        title="设置"
        onClose={onClose}
      >
        <div className="settings-section">
          <h3>网站标题</h3>
          <div className="option-item">
            <label>页面标题</label>
            <input
              type="text"
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              placeholder="输入页面标题"
              className="title-input"
            />
          </div>
        </div>
        <div className="settings-section">
          <h3>壁纸设置</h3>
          <button onClick={() => setShowWallpaperManager(true)}>更改壁纸</button>
        </div>
        <IconSettings 
          iconColumns={iconColumns}
          onIconColumnsChange={setIconColumns}
          onCleanupIcons={handleCleanupIcons}
          isCleaningUp={isCleaningUp}
        />
        <div className="settings-section">
          <h3>图标源设置</h3>
          <button onClick={() => setShowFaviconManager(true)}>管理图标源</button>
        </div>
        <div className="settings-section">
          <h3>搜索设置</h3>
          <button onClick={() => setShowSearchManager(true)}>管理搜索引擎</button>
        </div>

        <div className="settings-section">
          <h3>笔记</h3>
          <button onClick={() => setShowNotesManager(true)}>笔记</button>
        </div>

        <div className="settings-section">
          <h3>自动保存</h3>
          <div className="option-item">
            <label>
              倒计时时长: {autoSaveDuration}秒
              <input 
                type="range" 
                min="10" 
                max="99" 
                value={autoSaveDuration}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setAutoSaveDuration(value);
                }}
              />
            </label>
          </div>
          <div className="option-item">
            <label>
              启用自动保存
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={autoSaveEnabled}
                  onChange={(e) => {
                    setAutoSaveEnabled(e.target.checked);
                  }}
                />
                <span className="toggle-slider"></span>
              </label>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>数据管理</h3>
          <button
            onClick={handleLoadFromKV}
            disabled={isLoading}
          >
            {isLoading ? '加载中...' : '从云端加载数据'}
          </button>
          <button
            onClick={handleImportPreset}
            className="reset-button"
          >
            导入预设站点
          </button>
          <button
            onClick={handleClearAllSites}
            className="logout-button"
          >
            清空所有站点
          </button>
          <ImportExport />
        </div>

        <div className="settings-section">
          <h3>账户</h3>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="logout-button"
          >
            注销登录
          </button>
        </div>

        <div className="settings-section">
          <h3>关于</h3>
          <button onClick={() => setShowAboutDialog(true)}>关于 HarborPage</button>
        </div>
      </SettingsWindow>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="确认加载数据"
        message="确定要从云端加载数据吗？这将覆盖当前的本地更改。"
        onConfirm={handleConfirmLoadFromKV}
        onCancel={handleCancelLoadFromKV}
      />

      {/* 注销确认对话框 */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="确认注销"
        message="确定要注销登录吗？注销后需要重新登录才能继续使用应用。"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          authService.logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* 清理图标确认对话框 */}
      <ConfirmDialog
        isOpen={showCleanupConfirm}
        title="确认清理"
        message="确定要清理未使用的图标吗？这将删除R2存储中所有未被网站引用的图标文件，此操作不可恢复。"
        onConfirm={handleConfirmCleanupIcons}
        onCancel={handleCancelCleanupIcons}
      />

      {/* 清空所有站点确认对话框 */}
      <ConfirmDialog
        isOpen={showClearSitesConfirm}
        title="确认清空所有站点"
        message="确定要清空所有站点吗？这将删除所有网站快捷方式和文件夹，此操作不可恢复。"
        onConfirm={handleConfirmClearAllSites}
        onCancel={() => setShowClearSitesConfirm(false)}
      />

      {/* 导入预设站点对话框 */}
      <ImportPresetDialog
        key={showImportDialog ? 'open' : 'closed'}
        isOpen={showImportDialog}
        onClose={handleCloseImportDialog}
      />

      {/* 关于对话框 */}
      <AboutDialog
        isOpen={showAboutDialog}
        onClose={() => setShowAboutDialog(false)}
      />

      {/* Toast提示 */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={toast.onContinue ? 15000 : 2000}
          {...(toast.onContinue ? { onContinue: toast.onContinue } : {})}
          {...(toast.continueText ? { continueText: toast.continueText } : {})}
        />
      )}

      {/* 壁纸管理面板 */}
      {showWallpaperManager && (
        <SettingsWindow 
          title="壁纸管理"
          onClose={() => setShowWallpaperManager(false)}
        >
          <WallpaperManager />
        </SettingsWindow>
      )}

      {/* 搜索管理面板 */}
      {showSearchManager && (
        <SettingsWindow
          title="搜索管理"
          onClose={() => setShowSearchManager(false)}
        >
          <SearchManager />
        </SettingsWindow>
      )}

      {/* 图标源管理面板 */}
      {showFaviconManager && (
        <SettingsWindow
          title="图标源管理"
          onClose={() => setShowFaviconManager(false)}
        >
          <FaviconSettings />
        </SettingsWindow>
      )}

      {/* 笔记管理面板 */}
      {showNotesManager && (
        <SettingsWindow 
          title="笔记"
          onClose={() => setShowNotesManager(false)}
        >
          <Notes />
        </SettingsWindow>
      )}
    </>
  );
};

export default Settings;
