import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './EditWebsite.css';
import AutoFetchDialog from './AutoFetchDialog';
import type { Website } from '../../types';
import { getServices } from '../../services/serviceContainer';
import { getFaviconUrl, isPrivateNetworkAddress, isUrlLike, generateColoredTextSvg } from '../../services/IconManager';
import { preloadIconForUrl } from '../../services/iconUtils';
import DataRepository from '../../services/DataRepository';
import Toast from './Toast';
import { generateId } from '../../utils/idUtils';
import createLogger from '../../utils/logger';

const logger = createLogger('EditWebsite');

// 图标颜色预设：透明 + 9 种主题色，最后一项为自定义（彩虹渐变标记）
const ICON_COLOR_PRESETS = [
  '',          // 透明
  '#EF4444',   // 红
  '#F97316',   // 橙
  '#EAB308',   // 黄
  '#22C55E',   // 绿
  '#14B8A6',   // 青
  '#3B82F6',   // 蓝
  '#6366F1',   // 靛
  '#A855F7',   // 紫
  '#EC4899',   // 粉
];

// 自定义颜色：不在预设中的颜色由 color picker 提供，彩虹渐变按钮表示

function getInitialIcon(icon: string | undefined): string {
  if (!icon) return '';
  if (icon.startsWith('/api/icon') || icon.startsWith('/api/favicon')) {
    return '';
  }
  return icon;
}

/**
 * 将网址拆分为协议部分和不含协议的地址部分
 */
function splitUrl(url: string): { protocol: string; urlWithoutProtocol: string } {
  if (url.startsWith('http://')) {
    return { protocol: 'http://', urlWithoutProtocol: url.slice(7) };
  }
  if (url.startsWith('https://')) {
    return { protocol: 'https://', urlWithoutProtocol: url.slice(8) };
  }
  return { protocol: 'https://', urlWithoutProtocol: url };
}

interface EditWebsiteProps {
  onSubmit: (icon: Website) => void;
  onClose: () => void;
  icon?: Website;
  /** 预填网址（新增时自动填入，需拆分协议） */
  initialUrl?: string | undefined;
}

const EditWebsite: React.FC<EditWebsiteProps> = ({ onSubmit, onClose, icon, initialUrl }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const { authService, iconManager } = getServices();

  // 计算初始URL状态：编辑时从 icon.url 拆分，新增时从 initialUrl 拆分
  const [initialUrlState] = useState(() => {
    const sourceUrl = icon?.url || initialUrl || '';
    return splitUrl(sourceUrl);
  });

  const [newIcon, setNewIcon] = useState({
    id: icon?.id || generateId(),
    name: icon?.name || '',
    url: initialUrlState.urlWithoutProtocol,
    icon: getInitialIcon(icon?.icon),
    iconColor: icon?.iconColor || '',
  });

  // URL协议选择（默认https://）
  const [protocol, setProtocol] = useState(initialUrlState.protocol);

  // 防抖后的URL，用于favicon预览
  const [debouncedUrl, setDebouncedUrl] = useState(initialUrlState.urlWithoutProtocol);
  const urlTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [errors, setErrors] = useState({
    name: '',
    url: '',
  });

  const [uploading, setUploading] = useState(false);
  const [savingToR2, setSavingToR2] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; message: string } | null>(null);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [showAutoFetch, setShowAutoFetch] = useState(false);

  const validateUrl = useCallback((url: string) => {
    if (!url) return true;
    try {
      // 如果URL已经有协议，直接验证
      if (url.startsWith('http://') || url.startsWith('https://')) {
        new URL(url);
        return true;
      }
      // 如果URL没有协议，添加协议后验证
      new URL(`https://${url}`);
      return true;
    } catch {
      return false;
    }
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {
      name: '',
      url: '',
    };

    if (!newIcon.name.trim()) {
      newErrors.name = '请输入网站名称';
    } else if (newIcon.name.trim().length > 20) {
      newErrors.name = '网站名称不能超过20个字符';
    }

    if (!newIcon.url.trim()) {
      newErrors.url = '请输入网站URL';
    } else if (!validateUrl(newIcon.url.trim())) {
      newErrors.url = '请输入有效的URL';
    }

    setErrors(newErrors);
    return !newErrors.name && !newErrors.url;
  }, [newIcon.name, newIcon.url, validateUrl]);

  const fetchTitleForUrl = useCallback(async (urlStr: string) => {
    if (!urlStr.trim()) return;
    
    let fullUrl = urlStr.trim();
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = `${protocol}${fullUrl}`;
    }

    // 内网地址无法通过服务器获取标题，直接跳过
    if (isPrivateNetworkAddress(fullUrl)) return;

    // 如果名称已有内容，不自动覆盖
    if (newIcon.name.trim()) return;

    setIsFetchingTitle(true);
    try {
      const response = await fetch(`/api/title?url=${encodeURIComponent(fullUrl)}`, {
        headers: {
          ...authService.getAuthHeaders(),
        },
      });
      DataRepository.handleAuthResponse(response);
      if (response.ok) {
        const result = await response.json();
        if (result.title) {
          setNewIcon(prev => ({ ...prev, name: result.title }));
        }
      }
    } catch (error) {
      // 静默失败，用户可手动输入
      logger.debug('获取标题失败', error);
    } finally {
      setIsFetchingTitle(false);
    }
  }, [protocol, newIcon.name, authService]);

  // 组件挂载后自动聚焦 URL 输入框
  useEffect(() => {
    if (urlInputRef.current && !icon) {
      urlInputRef.current.focus();
    }
  }, [icon]);

  /**
   * 粘贴处理：自动剥离 URL 协议并选中对应协议
   */
  const handleUrlPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;

    const hasProtocol = pasted.startsWith('http://') || pasted.startsWith('https://');
    if (!hasProtocol) return;

    const { protocol: detectedProtocol, urlWithoutProtocol } = splitUrl(pasted);
    e.preventDefault();

    const input = urlInputRef.current;
    const start = input?.selectionStart ?? newIcon.url.length;
    const end = input?.selectionEnd ?? newIcon.url.length;
    const before = newIcon.url.slice(0, start);
    const after = newIcon.url.slice(end);
    const newValue = before + urlWithoutProtocol + after;

    setProtocol(detectedProtocol);
    setNewIcon({ ...newIcon, url: newValue });
    if (errors.url) setErrors({ ...errors, url: '' });

    if (urlTimeoutRef.current) clearTimeout(urlTimeoutRef.current);
    urlTimeoutRef.current = setTimeout(() => {
      setDebouncedUrl(newValue);
    }, 3000);

    const newCursorPos = before.length + urlWithoutProtocol.length;
    requestAnimationFrame(() => {
      if (input) {
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  }, [newIcon.url, errors.url]);

  /**
   * 复制处理：自动将协议附加到剪贴板
   */
  const handleUrlCopy = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const input = urlInputRef.current;
    if (!input) return;

    const selectedText = input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0);
    const fullUrl = `${protocol}${selectedText}`;
    e.clipboardData.setData('text/plain', fullUrl);
    e.preventDefault();
  }, [protocol]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024) {
      setToast({ type: 'error', message: '文件大小不能超过100KB' });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (icon?.id) {
        formData.append('id', icon.id);
        const domain = icon.url ? new URL(icon.url).hostname : 'uploaded';
        formData.append('domain', domain);
      }
      
      const response = await fetch('/api/icon/upload', {
        method: 'POST',
        headers: {
          ...authService.getAuthHeaders(),
        },
        body: formData,
      });

      DataRepository.handleAuthResponse(response);
      if (response.ok) {
        const result = await response.json();
        if (result.iconUrl) {
          setNewIcon(prev => ({ ...prev, icon: result.iconUrl }));
        }
      } else {
        const error = await response.json();
        setToast({ type: 'error', message: `上传失败: ${error.error || '未知错误'}` });
      }
    } catch (error) {
      logger.error('上传图标失败', error);
      setToast({ type: 'error', message: '上传失败，请重试' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [icon, authService]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAutoFetchSelect = useCallback((iconDataUrl: string | null, r2Url?: string) => {
    if (r2Url) {
      // 使用R2缓存的图标
      setNewIcon(prev => ({ ...prev, icon: r2Url }));
    } else if (iconDataUrl) {
      // 直接使用data URL
      setNewIcon(prev => ({ ...prev, icon: iconDataUrl }));
    }
    setShowAutoFetch(false);
    setToast({ type: 'success', message: '图标获取成功' });
  }, []);

  const handleAddIconSubmit = useCallback(async () => {
    if (isSubmitting) return;
    
    if (validateForm()) {
      setIsSubmitting(true);
      
      const currentIcon = newIcon;
      const iconInput = currentIcon.icon.trim();

      const urlWithoutProtocol = currentIcon.url.trim();
      let fullUrl: string;
      if (urlWithoutProtocol.startsWith('http://') || urlWithoutProtocol.startsWith('https://')) {
        fullUrl = urlWithoutProtocol;
      } else {
        fullUrl = `${protocol}${urlWithoutProtocol}`;
      }

      await preloadIconForUrl(iconManager, 'site', currentIcon.id, fullUrl, iconInput);
      
      const baseIconData: Website = {
        id: currentIcon.id,
        name: currentIcon.name.trim(),
        url: fullUrl,
      };
      if (iconInput) baseIconData.icon = iconInput;
      if (currentIcon.iconColor) baseIconData.iconColor = currentIcon.iconColor;
      if (icon?.isFolder !== undefined) baseIconData.isFolder = icon.isFolder;
      if (icon?.children !== undefined) baseIconData.children = icon.children;
      onSubmit(baseIconData);
      onClose();
      setIsSubmitting(false);
    }
  }, [isSubmitting, newIcon, protocol, icon, onSubmit, onClose, validateForm, iconManager]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddIconSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleAddIconSubmit, onClose]);

  const iconPreview = useMemo(() => {
    // 如果用户输入了自定义图标
    if (newIcon.icon && !newIcon.icon.startsWith('/api/icon') && !newIcon.icon.startsWith('/api/favicon')) {
      // 非URL格式的文本（如 "Ba"），生成透明背景的SVG预览，文字颜色由 iconColor 决定
      if (!isUrlLike(newIcon.icon) && !newIcon.icon.startsWith('data:')) {
        return generateColoredTextSvg(newIcon.icon, newIcon.iconColor);
      }
      return newIcon.icon;
    }
    
    // 如果URL有效，使用防抖后的URL生成预览（停止输入3秒后或焦点离开后更新）
    if (debouncedUrl && validateUrl(debouncedUrl)) {
      try {
        // 构建完整URL（带协议前缀）
        const urlWithoutProtocol = debouncedUrl;
        const fullPreviewUrl = urlWithoutProtocol.startsWith('http://') || urlWithoutProtocol.startsWith('https://')
          ? urlWithoutProtocol
          : `${protocol}${urlWithoutProtocol}`;
        // 内网地址无法通过服务器获取图标，不生成预览
        if (isPrivateNetworkAddress(fullPreviewUrl)) return '';
        const domain = new URL(fullPreviewUrl).hostname;
        return getFaviconUrl(domain);
      } catch {
        return '';
      }
    }
    
    // 如果有API URL，作为备用方案
    if (icon?.icon && (icon.icon.startsWith('/api/icon') || icon.icon.startsWith('/api/favicon'))) {
      return icon.icon;
    }
    
    // 如果有自定义URL，作为备用方案
    if (icon?.icon) {
      return icon.icon;
    }
    
    return '';
  }, [newIcon.icon, newIcon.iconColor, debouncedUrl, validateUrl, icon, protocol]);

  // iconPreview 变化时重置预览错误状态
  useEffect(() => {
    setPreviewError(false);
  }, [iconPreview]);

  /**
   * 将当前预览图标保存到 R2 并自动填充图标URL字段
   */
  const handleSaveToR2 = useCallback(async () => {
    if (!iconPreview || previewError) return;

    // 使用时间戳生成唯一文件名，避免图标变化后边缘缓存仍服务旧图标
    const hashInput = `save_${newIcon.id}_${Date.now()}`;

    setSavingToR2(true);
    try {
      const response = await fetch('/api/icon/cache-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({
          type: 'site',
          hashInput,
          url: iconPreview,
        }),
      });

      DataRepository.handleAuthResponse(response);

      if (response.ok) {
        const result = await response.json() as { success: boolean; iconUrl: string };
        if (result.success && result.iconUrl) {
          setNewIcon(prev => ({ ...prev, icon: result.iconUrl }));
          setToast({ type: 'success', message: '图标已保存到R2' });
        }
      } else {
        const error = await response.json().catch(() => ({ error: '保存失败' }));
        setToast({ type: 'error', message: `保存失败: ${error.error || '未知错误'}` });
      }
    } catch (error) {
      logger.error('保存图标到R2失败', error);
      setToast({ type: 'error', message: '保存失败，请重试' });
    } finally {
      setSavingToR2(false);
    }
  }, [iconPreview, previewError, newIcon.id, authService]);

  // 判断是否可以保存到R2：有预览且非错误状态，且不是data URL（data URL已在自动获取中支持缓存）
  const canSaveToR2 = !!iconPreview && !previewError && !iconPreview.startsWith('data:') && !savingToR2 && !uploading;

  useEffect(() => {
    if (icon) {
      // 当icon prop变化时，更新表单数据
      const { protocol: extractedProtocol, urlWithoutProtocol } = splitUrl(icon.url);

      setProtocol(extractedProtocol);
      setNewIcon({
        id: icon.id,
        name: icon.name,
        url: urlWithoutProtocol,
        icon: getInitialIcon(icon.icon),
        iconColor: icon.iconColor || '',
      });
      setDebouncedUrl(urlWithoutProtocol);
      setErrors({ name: '', url: '' });
    }
  }, [icon]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (urlTimeoutRef.current) {
        clearTimeout(urlTimeoutRef.current);
      }
    };
  }, []);

  // 预览图标的背景色：文字图标的 iconColor 已作为文字颜色，不再设背景；
  // URL 图片图标用 iconColor 作为 img 背景色（透明 favicon 会显示彩色底）
  const isTextIconPreview = !!newIcon.icon && !isUrlLike(newIcon.icon) && !newIcon.icon.startsWith('data:');
  const previewImgStyle = newIcon.iconColor && !isTextIconPreview ? { background: newIcon.iconColor } : undefined;

  return (
    <div className="edit-website-container">      
      <div className="edit-website-form">
        <div className="edit-website-preview">
          {iconPreview && !previewError ? (
            <img
              src={iconPreview}
              alt="图标预览"
              className="edit-website-preview-image"
              style={previewImgStyle}
              referrerPolicy="no-referrer"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <div className="edit-website-preview-placeholder">🌐</div>
          )}
        </div>

        <div className="edit-website-input-group">
          <label className="edit-website-label">网站URL</label>
          <div className={`edit-website-url-wrapper ${errors.url ? 'error' : ''}`}>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="edit-website-url-protocol"
            >
              <option value="https://">https://</option>
              <option value="http://">http://</option>
            </select>
            <input 
              ref={urlInputRef}
              type="text" 
              placeholder="例如：www.google.com"
              autoFocus
              tabIndex={1}
              value={newIcon.url}
              onPaste={handleUrlPaste}
              onCopy={handleUrlCopy}
              onChange={(e) => {
                setNewIcon({ ...newIcon, url: e.target.value });
                if (errors.url) {
                  setErrors({ ...errors, url: '' });
                }
                
                // 防抖更新debouncedUrl（停止输入3秒后更新）
                if (urlTimeoutRef.current) {
                  clearTimeout(urlTimeoutRef.current);
                }
                urlTimeoutRef.current = setTimeout(() => {
                  setDebouncedUrl(e.target.value);
                }, 3000);
              }}
              onBlur={(e) => {
                // 焦点离开时立即更新debouncedUrl
                setDebouncedUrl(e.target.value);
                // 从目标网站获取标题
                fetchTitleForUrl(e.target.value);
              }}
              onKeyDown={handleKeyPress}
              className={`edit-website-input ${errors.url ? 'error' : ''}`}
            />
          </div>
          {errors.url && <div className="edit-website-error">{errors.url}</div>}
        </div>

        <div className="edit-website-input-group">
          <label className="edit-website-label">网站名称 {isFetchingTitle && <span className="edit-website-fetching">获取中...</span>}</label>
          <input 
            type="text" 
            placeholder="例如：Google"
            tabIndex={2}
            value={newIcon.name}
            onChange={(e) => {
              setNewIcon({ ...newIcon, name: e.target.value });
              if (errors.name) {
                setErrors({ ...errors, name: '' });
              }
            }}
            onKeyDown={handleKeyPress}
            maxLength={20}
            className={`edit-website-input ${errors.name ? 'error' : ''}`}
          />
          {errors.name && <div className="edit-website-error">{errors.name}</div>}
        </div>

        <div className="edit-website-input-group">
          <label className="edit-website-label">
            图标（可选）
            <span className="edit-website-tip" tabIndex={0} aria-label="图标输入说明">?</span>
          </label>
          <input 
            type="text" 
            placeholder="留空则自动获取网站图标"
            tabIndex={3}
            value={newIcon.icon}
            onChange={(e) => setNewIcon({ ...newIcon, icon: e.target.value })}
            onKeyDown={handleKeyPress}
            className="edit-website-input"
          />
        </div>

        <div className="edit-website-upload-group">
          <label className="edit-website-label">图标操作</label>
          <div className="edit-website-upload-buttons">
            <div className="edit-website-upload-button-wrapper">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={handleFileUpload}
                className="edit-website-file-input"
                disabled={uploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                tabIndex={4}
                className="edit-website-button edit-website-button-upload"
                title="手动上传图标到R2"
              >
                {uploading ? '上传中...' : '上传'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAutoFetch(true)}
              disabled={uploading}
              tabIndex={5}
              className="edit-website-button edit-website-button-autofetch"
              title="从多种渠道尝试获取图标"
            >
            智能获取
            </button>
            <button
              type="button"
              onClick={handleSaveToR2}
              disabled={!canSaveToR2}
              tabIndex={6}
              className="edit-website-button edit-website-button-save-r2"
              title="将当前预览图标保存到R2并自动设置图标URL"
            >
              {savingToR2 ? '保存中...' : '保存到R2'}
            </button>
          </div>
          {(uploading || savingToR2) && (
            <div className="edit-website-upload-progress">
              <div className="edit-website-upload-progress-bar" />
            </div>
          )}
          <p className="edit-website-upload-hint">
            支持 PNG、JPG、GIF、WebP、SVG 格式，最大100KB
            {!canSaveToR2 && !uploading && <span className="edit-website-upload-hint-disabled">（预览图标正常显示后可保存到R2）</span>}
          </p>
        </div>

        <div className="edit-website-input-group">
          <label className="edit-website-label">图标颜色</label>
          <div className="edit-website-color-picker">
            {ICON_COLOR_PRESETS.map((color) => {
              const isActive = newIcon.iconColor === color;
              const isTransparent = color === '';
              return (
                <div
                  key={color || 'transparent'}
                  role="button"
                  tabIndex={5}
                  title={isTransparent ? '透明' : color}
                  aria-label={isTransparent ? '透明' : `颜色 ${color}`}
                  aria-pressed={isActive}
                  className={`edit-website-color-swatch ${isActive ? 'active' : ''} ${isTransparent ? 'transparent' : ''}`}
                  style={isTransparent ? undefined : { background: color }}
                  onClick={() => setNewIcon({ ...newIcon, iconColor: color })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNewIcon({ ...newIcon, iconColor: color }); } }}
                />
              );
            })}
            {/* 自定义颜色按钮：彩虹渐变背景，选中时显示对勾 */}
            <div
              role="button"
              tabIndex={6}
              className={`edit-website-color-custom ${(!!newIcon.iconColor && !ICON_COLOR_PRESETS.includes(newIcon.iconColor)) ? 'active' : ''}`}
              title="自定义颜色"
              onClick={() => colorInputRef.current?.click()}
            />
            {/* 隐藏的原生颜色选择器 */}
            <input
              ref={colorInputRef}
              type="color"
              tabIndex={-1}
              aria-label="自定义颜色"
              className="edit-website-color-hidden"
              value={newIcon.iconColor && /^#[0-9A-Fa-f]{6}$/.test(newIcon.iconColor) ? newIcon.iconColor : '#3B82F6'}
              onChange={(e) => setNewIcon({ ...newIcon, iconColor: e.target.value.toUpperCase() })}
            />
          </div>
        </div>

        <div className="edit-website-buttons">
          <button 
            onClick={handleAddIconSubmit}
            tabIndex={7}
            className="edit-website-button edit-website-button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : '确定'}
          </button>
          <button 
            onClick={onClose}
            tabIndex={8}
            className="edit-website-button edit-website-button-secondary"
            disabled={isSubmitting || uploading}
          >
            取消
          </button>
        </div>
      </div>
      
      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}

      {showAutoFetch && (() => {
        let fullUrl = newIcon.url.trim();
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
          fullUrl = `${protocol}${fullUrl}`;
        }
        if (!fullUrl || !validateUrl(fullUrl)) {
          setToast({ type: 'error', message: '请先填写有效的网站URL' });
          setShowAutoFetch(false);
          return null;
        }
        return (
          <AutoFetchDialog
            websiteUrl={fullUrl}
            websiteId={newIcon.id}
            websiteName={newIcon.name}
            onSelect={handleAutoFetchSelect}
            onClose={() => setShowAutoFetch(false)}
          />
        );
      })()}
    </div>
  );
};

export default EditWebsite;
