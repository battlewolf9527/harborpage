import React, { useState, useEffect, useRef } from 'react';
import { getServices } from '../../services/serviceContainer';
import './LoginModal.css';

interface LoginModalProps {
  onLogin: () => void;
}

function LoginModal({ onLogin }: LoginModalProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 自动聚焦到密码输入框
    passwordInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await getServices().authService.login(password);
    
    if (success) {
      onLogin();
    } else {
      setError('密码错误，请重试');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <div className="login-header">
          <div className="login-icon">🔐</div>
          <h2 className="login-title">欢迎回来</h2>
          <p className="login-subtitle">请输入密码以访问您的个人主页</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="login-label" htmlFor="password">密码</label>
            <input
              id="password"
              ref={passwordInputRef}
              className="login-input"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          
          {error && <p className="login-error">{error}</p>}
          
          <button type="submit" className="login-button" disabled={isLoading || !password.trim()}>
            {isLoading ? (
              <span className="login-loading">
                <span className="login-spinner"></span>
                登录中...
              </span>
            ) : (
              '登录'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
