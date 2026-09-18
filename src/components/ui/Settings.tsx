import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import SettingsWindow from './SettingsWindow';
import WallpaperManager from '../features/WallpaperManager';
import SearchManager from '../features/SearchManager';
import IconSettings from './IconSettings';
import AutoSaveSettings from './AutoSaveSettings';
import FaviconSettings from './FaviconSettings';
import { Palette } from '../common/PalettePicker';
import SchemePicker from '../common/SchemePicker';
import SaveSchemeButton from '../common/SaveSchemeButton';
import HintTip from '../common/HintTip';
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
import { LANGUAGE_OPTIONS } from '../../i18n';
import type { SupportedLanguage } from '../../i18n';
import createLogger from '../../utils/logger';

const logger = createLogger('Settings');

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('settings');
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
    lightness === 0
      ? t('lightness.original')
      : lightness > 0
        ? t('lightness.brighter', { value: lightness })
        : t('lightness.darker', { value: -lightness });
  
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
    language,
    setLanguage,
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
      language: s.language,
      setLanguage: s.setLanguage,
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
        setToast({ type: 'success', message: t('toasts.loadSuccess') });
      } else {
        setToast({ type: 'error', message: t('toasts.loadFailed') });
      }
    } catch (error) {
      logger.error('Failed to load data', error);
      setToast({ type: 'error', message: t('toasts.loadFailedNetwork') });
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
    setToast({ type: 'success', message: t('toasts.sitesCleared') });
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
            message: t('toasts.cleanupSummaryWithMore', {
              count: result.deletedCount,
              remaining: result.estimatedRemaining,
            }),
            onContinue: () => handleConfirmCleanupIcons(result.cursor, result.prefix),
            continueText: t('actions.continueCleanup')
          });
        } else {
          setToast({
            type: 'success',
            message: t('toasts.cleanupSummary', { count: result.deletedCount }),
          });
        }
      } else {
        setToast({ type: 'error', message: t('toasts.cleanupFailed') });
      }
    } catch (error) {
      logger.error('Failed to clean up icons', error);
      setToast({ type: 'error', message: t('toasts.cleanupFailedNetwork') });
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
        title={t('title')}
        isClosing={closing || !isOpen}
        onClose={onClose}
      >
        {/* ── 第 1 组：个性化 ───────────────────────────────── */}
        <div className="settings-section">
          <h3>{t('sections.personalization')}</h3>
          <div className="tool-buttons">
            <div className="setting-item">
              <label>{t('siteTitle.label')}</label>
              <input
                type="text"
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                placeholder={t('siteTitle.placeholder')}
                className="title-input"
              />
            </div>
            <div className="setting-item">
              <label htmlFor="settings-language">{t('language.label')}</label>
              <select
                id="settings-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={() => setShowWallpaperManager(true)}>{t('actions.changeWallpaper')}</button>
            <button onClick={() => setShowIconSettings(true)}>{t('actions.iconSettings')}</button>
            <button onClick={() => setShowFaviconManager(true)}>{t('actions.faviconSources')}</button>
          </div>
          {/* 调色板：全局 16 槽（设置模式 2×8）；点任意槽弹取色器改色，
              弹窗内可为该槽设置别名（显示为「别名（调色板 N）：颜色」），使用该槽位的元素自动跟随 */}
          <div className="palette-manage-block">
            {/* 配色方案：语义上「选方案 → 决定调色板色调」，故置于调色板标题与色块之前。
                内置 7 套 + 用户自建，下拉选中即一键改写 16 槽颜色（使用槽位的元素自动跟随） */}
            <SchemePicker />
            <div className="palette-manage-head">
              <span className="palette-manage-title">{t('palette.title')}</span>
              <HintTip text={t('palette.hint')} />
              {/* 保存为方案：把当前调色板快照存为自建方案，故与调色板标题同排 */}
              <SaveSchemeButton />
            </div>
            <Palette mode="settings" />
            {/* 全局明暗度：不修改各槽颜色，仅在实际使用（图标/文件夹/便签表面）时叠加亮度，
                实现整站颜色统一调亮/调暗；下方滑杆 0 = 原色 */}
            <div className="palette-lightness-block">
              <div className="palette-lightness-head">
                <span className="palette-lightness-title">{t('lightness.title')}</span>
                <HintTip text={t('lightness.hint')} />
                <span className="palette-lightness-value">{lightnessLabel}</span>
                <div
                  className="palette-lightness-preview"
                  title={t('lightness.previewHint')}
                >
                  <span className="palette-lightness-preview-label">{t('lightness.previewLabel')}</span>
                  <label className="settings-switch palette-lightness-preview-switch">
                    <input
                      type="checkbox"
                      checked={previewEnabled}
                      onChange={(e) => setPreviewEnabled(e.target.checked)}
                      aria-label={t('lightness.previewAria')}
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
                aria-label={t('lightness.aria')}
              />
              <div className="palette-lightness-foot">
                <span className="palette-lightness-mark">{t('lightness.dim')}</span>
                <span className="palette-lightness-mark">{t('lightness.bright')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 第 2 组：偏好设置 ───────────────────────────── */}
        <div className="settings-section">
          <h3>{t('sections.preferences')}</h3>
          <div className="tool-buttons">
            <button onClick={() => setShowSearchManager(true)}>{t('actions.searchEngines')}</button>
            <button onClick={() => setShowAutoSaveSettings(true)}>{t('actions.autoSave')}</button>
          </div>
        </div>

        {/* ── 第 3 组：功能开关（控制主界面上各功能入口的显隐） ── */}
        <div className="settings-section">
          <h3>{t('sections.features')}</h3>
          <div className="settings-feature-list">
            <div className="settings-feature-row">
              <span className="settings-feature-name">{t('features.weather')}</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={weatherEnabled}
                  onChange={(e) => setWeatherEnabled(e.target.checked)}
                  aria-label={t('features.weatherAria')}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">{t('features.search')}</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={searchEnabled}
                  onChange={(e) => setSearchEnabled(e.target.checked)}
                  aria-label={t('features.searchAria')}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">{t('features.notes')}</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={notesEnabled}
                  onChange={(e) => setNotesEnabled(e.target.checked)}
                  aria-label={t('features.notesAria')}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">{t('features.todos')}</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={todosEnabled}
                  onChange={(e) => setTodosEnabled(e.target.checked)}
                  aria-label={t('features.todosAria')}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
            <div className="settings-feature-row">
              <span className="settings-feature-name">{t('features.pages')}</span>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={pagesEnabled}
                  onChange={(e) => setPagesEnabled(e.target.checked)}
                  aria-label={t('features.pagesAria')}
                />
                <span className="settings-switch-track" />
              </label>
            </div>
          </div>
        </div>

        {/* ── 第 4 组：数据管理 ───────────────────────────── */}
        <div className="settings-section">
          <h3>{t('sections.data')}</h3>
          <div className="tool-buttons">
            <button
              onClick={handleLoadFromKV}
              disabled={isLoading}
            >
              {isLoading ? t('actions.loading') : t('actions.loadFromCloud')}
            </button>
            <button
              onClick={handleImportPreset}
            >
              {t('actions.importPreset')}
            </button>
            <ImportExport />
            <button
              onClick={handleClearAllSites}
              className="logout-button"
            >
              {t('actions.clearAllSites')}
            </button>
          </div>
        </div>

        {/* ── 第 5 组：账户与关于 ─────────────────────────── */}
        <div className="settings-section">
          <h3>{t('sections.account')}</h3>
          <div className="tool-buttons">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="logout-button"
            >
              {t('actions.logout')}
            </button>
            <button onClick={() => setShowAboutDialog(true)}>{t('actions.about')}</button>
          </div>
        </div>
      </SettingsWindow>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title={t('dialogs.loadDataTitle')}
        message={t('dialogs.loadDataMessage')}
        onConfirm={handleConfirmLoadFromKV}
        onCancel={handleCancelLoadFromKV}
      />

      {/* 注销确认对话框 */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title={t('dialogs.logoutTitle')}
        message={t('dialogs.logoutMessage')}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          authService.logout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* 清理图标确认对话框 */}
      <ConfirmDialog
        isOpen={showCleanupConfirm}
        title={t('dialogs.cleanupTitle')}
        message={t('dialogs.cleanupMessage')}
        onConfirm={handleConfirmCleanupIcons}
        onCancel={handleCancelCleanupIcons}
      />

      {/* 清空所有站点确认对话框 */}
      <ConfirmDialog
        isOpen={showClearSitesConfirm}
        title={t('dialogs.clearSitesTitle')}
        message={t('dialogs.clearSitesMessage')}
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
          title={t('windows.wallpaper')}
          onClose={() => setShowWallpaperManager(false)}
        >
          <WallpaperManager />
        </SettingsWindow>
      )}

      {/* 搜索管理面板 */}
      {showSearchManager && (
        <SettingsWindow
          title={t('windows.search')}
          onClose={() => setShowSearchManager(false)}
        >
          <SearchManager />
        </SettingsWindow>
      )}

      {/* 图标源管理面板 */}
      {showFaviconManager && (
        <SettingsWindow
          title={t('windows.favicon')}
          onClose={() => setShowFaviconManager(false)}
        >
          <FaviconSettings />
        </SettingsWindow>
      )}

      {/* 桌面图标设置面板 */}
      {showIconSettings && (
        <SettingsWindow
          title={t('windows.icon')}
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
          title={t('windows.autoSave')}
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
