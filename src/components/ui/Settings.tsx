import React, { useState, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import SettingsWindow from './SettingsWindow';
import WallpaperManager from '../features/WallpaperManager';
import SearchManager from '../features/SearchManager';
import IconSettings from './IconSettings';
import AutoSaveSettings from './AutoSaveSettings';
import FaviconSettings from './FaviconSettings';
import { Palette } from '../common/PalettePicker';
import ImportPresetDialog from './ImportPresetDialog';
import ImportExport from './ImportExport';
import ConfirmDialog from '../common/ConfirmDialog';
import AboutDialog from '../common/AboutDialog';
import Toast from '../common/Toast';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useIconsStore } from '../../store/useIconsStore';
import { usePaletteStore } from '../../store/usePaletteStore';
import { LIGHTNESS_MAX, LIGHTNESS_MIN } from '../../utils/paletteColors';
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
  /* —— 延迟卸载机制（根治「滑出无动画」）
       关闭有 2 条路径：
         A) 子窗口内点 ✕ / ESC / overlay → 子 260ms 过渡 → 父 onClose() → 本组件 isOpen=false
         B) 齿轮按钮 toggle 关（setShowSettings(false) 直接外部改 isOpen=false）→ 走 return null 立刻卸
       之前 return null 让路径 B 完全跳过过渡。
       修复：mounted + closing 双 state + isOpen useEffect 统一延迟卸载；
       并把 closing 作为 isClosing 传给子 → 子 CSS transition 一致可见。 */
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // 打开：立即挂载 + 取消 closing
      if (closingTimerRef.current) { clearTimeout(closingTimerRef.current); closingTimerRef.current = null; }
      setMounted(true);
      setClosing(false);
    } else {
      // 关闭（任何路径）：先进入 closing 过渡 280ms，再卸载
      setClosing(true);
      if (closingTimerRef.current) clearTimeout(closingTimerRef.current);
      closingTimerRef.current = setTimeout(() => {
        closingTimerRef.current = null;
        setMounted(false);
        setClosing(false);
      }, 280); // 与 SettingsWindow.css transition 260ms + 20ms 保险
    }
    return () => {
      if (closingTimerRef.current) { clearTimeout(closingTimerRef.current); closingTimerRef.current = null; }
    };
  }, [isOpen]);

  const [showWallpaperManager, setShowWallpaperManager] = useState(false);
  const [showIconSettings, setShowIconSettings] = useState(false);
  const [showAutoSaveSettings, setShowAutoSaveSettings] = useState(false);
  const [showSearchManager, setShowSearchManager] = useState(false);
  const [showFaviconManager, setShowFaviconManager] = useState(false);
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

  // 全局显示明暗度：不改已存颜色，仅整体调亮/调暗实际使用的颜色表面（图标/文件夹/便签）
  const lightness = usePaletteStore((s) => s.lightness);
  const setLightness = usePaletteStore((s) => s.setLightness);
  // 调色板实时预览开关：开 → 下方色块预览叠加明暗度的观感；关 → 显示真实存储色
  const previewEnabled = usePaletteStore((s) => s.previewEnabled);
  const setPreviewEnabled = usePaletteStore((s) => s.setPreviewEnabled);
  const lightnessLabel =
    lightness === 0 ? '原色' : lightness > 0 ? `变亮 +${lightness}` : `变暗 ${-lightness}`;
  
  // 从Zustand store获取状态和方法
  const {
    siteTitle,
    setSiteTitle,
    iconColumns,
    setIconColumns,
    weatherEnabled,
    setWeatherEnabled,
    searchEnabled,
    setSearchEnabled,
    notesEnabled,
    setNotesEnabled,
    todosEnabled,
    setTodosEnabled,
    pagesEnabled,
    setPagesEnabled,
  } = useSettingsStore(
    useShallow((s) => ({
      siteTitle: s.siteTitle,
      setSiteTitle: s.setSiteTitle,
      iconColumns: s.iconColumns,
      setIconColumns: s.setIconColumns,
      weatherEnabled: s.weatherEnabled,
      setWeatherEnabled: s.setWeatherEnabled,
      searchEnabled: s.searchEnabled,
      setSearchEnabled: s.setSearchEnabled,
      notesEnabled: s.notesEnabled,
      setNotesEnabled: s.setNotesEnabled,
      todosEnabled: s.todosEnabled,
      setTodosEnabled: s.setTodosEnabled,
      pagesEnabled: s.pagesEnabled,
      setPagesEnabled: s.setPagesEnabled,
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

  // 延迟卸载：任何关闭路径（✕/齿轮 toggle/ESC）都必须等 closing 过渡播完才真正卸载
  if (!mounted) return null;

  return (
    <>
      {/* closing/!isOpen 任一为真 → 子进入关闭态 CSS class（transform translateX(100%) + overlay 淡出） */}
      <SettingsWindow 
        title="设置"
        isClosing={closing || !isOpen}
        onClose={onClose}
      >
        {/* ── 第 1 组：个性化 ───────────────────────────────── */}
        <div className="settings-section">
          <h3>个性化</h3>
          <div className="tool-buttons">
            <div className="setting-item">
              <label>网站标题</label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                placeholder="输入页面标题"
                className="title-input"
              />
            </div>
            <button onClick={() => setShowWallpaperManager(true)}>更改壁纸</button>
            <button onClick={() => setShowIconSettings(true)}>桌面图标设置</button>
            <button onClick={() => setShowFaviconManager(true)}>管理图标源</button>
          </div>
          {/* 调色板：全局 16 槽（设置模式 2×8）；点任意槽弹取色器改色，
              弹窗内可为该槽设置别名（显示为「别名（调色板 N）：颜色」），使用该槽位的元素自动跟随 */}
          <div className="palette-manage-block">
            <div className="palette-manage-head">
              <span className="palette-manage-title">调色板</span>
              <span className="palette-manage-hint">点击色块可重新设定该调色板颜色，使用该颜色的元素将自动更新</span>
            </div>
            {/* 全局明暗度：不修改各槽颜色，仅在实际使用（图标/文件夹/便签表面）时叠加亮度，
                实现整站颜色统一调亮/调暗；下方滑杆 0 = 原色 */}
            <div className="palette-lightness-block">
              <div className="palette-lightness-head">
                <span className="palette-lightness-title">全局明暗度</span>
                <span className="palette-lightness-value">{lightnessLabel}</span>
                <div
                  className="palette-lightness-preview"
                  title="开启后，下方调色板色块实时预览叠加明暗度的观感；关闭则显示真实存储色"
                >
                  <span className="palette-lightness-preview-label">实时预览</span>
                  <label className="settings-switch palette-lightness-preview-switch">
                    <input
                      type="checkbox"
                      checked={previewEnabled}
                      onChange={(e) => setPreviewEnabled(e.target.checked)}
                      aria-label="在下方调色板实时预览明暗度效果"
                    />
                    <span className="settings-switch-track" />
                  </label>
                </div>
              </div>
              <input
                type="range"
                min={LIGHTNESS_MIN}
                max={LIGHTNESS_MAX}
                step={1}
                value={lightness}
                onChange={(e) => setLightness(Number(e.target.value))}
                aria-label="全局明暗度：整体调亮或调暗图标、文件夹与便签使用的颜色"
              />
              <div className="palette-lightness-foot">
                <span className="palette-lightness-mark">调暗</span>
                <span className="palette-lightness-hint">不改动已存颜色，仅调整实际使用的颜色明暗</span>
                <span className="palette-lightness-mark">调亮</span>
              </div>
            </div>
            <Palette mode="settings" />
          </div>
        </div>

        {/* ── 第 2 组：偏好设置 ───────────────────────────── */}
        <div className="settings-section">
          <h3>偏好设置</h3>
          <div className="tool-buttons">
            <button onClick={() => setShowSearchManager(true)}>管理搜索引擎</button>
            <button onClick={() => setShowAutoSaveSettings(true)}>自动保存设置</button>
          </div>
        </div>

        {/* ── 第 3 组：功能开关（控制主界面上各功能入口的显隐） ── */}
        <div className="settings-section">
          <h3>功能开关</h3>
          <div className="settings-feature-list">
            <div className="settings-feature-row">
              <span className="settings-feature-name">天气</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={weatherEnabled}
                  onChange={(e) => setWeatherEnabled(e.target.checked)}
                  aria-label="显示天气组件"
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">搜索框</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={searchEnabled}
                  onChange={(e) => setSearchEnabled(e.target.checked)}
                  aria-label="显示搜索框"
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">笔记</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notesEnabled}
                  onChange={(e) => setNotesEnabled(e.target.checked)}
                  aria-label="显示笔记入口"
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">待办事项</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={todosEnabled}
                  onChange={(e) => setTodosEnabled(e.target.checked)}
                  aria-label="显示待办事项入口"
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">多页面</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={pagesEnabled}
                  onChange={(e) => setPagesEnabled(e.target.checked)}
                  aria-label="显示多页面入口"
                />
                <span className="settings-switch-track" />
              </label>
            </div>
          </div>
        </div>

        {/* ── 第 4 组：数据管理 ───────────────────────────── */}
        <div className="settings-section">
          <h3>数据管理</h3>
          <div className="tool-buttons">
            <button
              onClick={handleLoadFromKV}
              disabled={isLoading}
            >
              {isLoading ? '加载中...' : '从云端加载数据'}
            </button>
            <button
              onClick={handleImportPreset}
            >
              导入预设站点
            </button>
            <ImportExport />
            <button
              onClick={handleClearAllSites}
              className="logout-button"
            >
              清空所有站点
            </button>
          </div>
        </div>

        {/* ── 第 5 组：账户与关于 ─────────────────────────── */}
        <div className="settings-section">
          <h3>账户与关于</h3>
          <div className="tool-buttons">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="logout-button"
            >
              注销登录
            </button>
            <button onClick={() => setShowAboutDialog(true)}>关于 HarborPage</button>
          </div>
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

      {/* 桌面图标设置面板 */}
      {showIconSettings && (
        <SettingsWindow
          title="桌面图标设置"
          onClose={() => setShowIconSettings(false)}
        >
          <IconSettings
            iconColumns={iconColumns}
            onIconColumnsChange={setIconColumns}
            onCleanupIcons={handleCleanupIcons}
            isCleaningUp={isCleaningUp}
          />
        </SettingsWindow>
      )}

      {/* 自动保存设置面板 */}
      {showAutoSaveSettings && (
        <SettingsWindow
          title="自动保存设置"
          onClose={() => setShowAutoSaveSettings(false)}
        >
          <AutoSaveSettings
            duration={autoSaveDuration}
            enabled={autoSaveEnabled}
            onDurationChange={setAutoSaveDuration}
            onEnabledChange={setAutoSaveEnabled}
          />
        </SettingsWindow>
      )}
    </>
  );
};

export default Settings;
