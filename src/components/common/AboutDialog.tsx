import React, { useEffect } from 'react';
import './AboutDialog.css';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  // 监听ESC键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="about-dialog-overlay" onClick={handleOverlayClick}>
      <div className="about-dialog">
        <button className="about-dialog-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
        <div className="about-dialog-header">
          <img src="/favicon.png" alt="HarborPage" className="about-dialog-logo" />
          <h2 className="about-dialog-title">HarborPage</h2>
          <p className="about-dialog-subtitle">个人导航页面</p>
        </div>
        <div className="about-dialog-body">
          <p className="about-dialog-desc">
            一个基于 React + Vite + Cloudflare Workers 构建的现代化个人导航页面，支持网站图标管理、文件夹分类、搜索引擎切换、天气显示、待办事项、笔记、数据导入导出等功能。
          </p>
          <div className="about-dialog-features">
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">🌐</span>
              <span>网站图标管理</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">📁</span>
              <span>文件夹分类</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">🔍</span>
              <span>搜索引擎切换</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">🌤️</span>
              <span>天气显示</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">✅</span>
              <span>待办事项</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">📝</span>
              <span>笔记功能</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">📤</span>
              <span>数据导入导出</span>
            </div>
            <div className="about-dialog-feature-item">
              <span className="about-dialog-feature-icon">🎨</span>
              <span>壁纸管理</span>
            </div>
          </div>
          <div className="about-dialog-tech">
            <h4 className="about-dialog-section-title">技术栈</h4>
            <div className="about-dialog-tech-tags">
              <span className="about-dialog-tag">React 19</span>
              <span className="about-dialog-tag">TypeScript</span>
              <span className="about-dialog-tag">Vite 7</span>
              <span className="about-dialog-tag">Zustand 5</span>
              <span className="about-dialog-tag">Cloudflare Workers</span>
              <span className="about-dialog-tag">Cloudflare KV</span>
              <span className="about-dialog-tag">Cloudflare R2</span>
            </div>
          </div>
        </div>
        <div className="about-dialog-footer">
          <a
            href="https://github.com/battlewolf9527/harborpage"
            target="_blank"
            rel="noopener noreferrer"
            className="about-dialog-github-link"
            aria-label="GitHub 仓库"
            title="GitHub 仓库"
          >
            <svg className="about-dialog-github-icon" viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <span className="about-dialog-license">MIT License</span>
        </div>
        <div className="about-dialog-buttons">
          <button
            type="button"
            className="about-dialog-button about-dialog-button-primary"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog;
