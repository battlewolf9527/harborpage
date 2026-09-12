import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getServices } from '../../services/serviceContainer';
import './LoginModal.css';

interface LoginModalProps {
  onLogin: () => void;
}

function LoginModal({ onLogin }: LoginModalProps) {
  const { t } = useTranslation('auth');
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

    const result = await getServices().authService.login(password);

    if (result.success) {
      onLogin();
    } else {
      setError(result.error || t('defaultError'));
    }

    setIsLoading(false);
  };

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <div className="login-header">
          <div className="login-icon">🔐</div>
          <h2 className="login-title">{t('welcome')}</h2>
          <p className="login-subtitle">{t('subtitle')}</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-input-group">
            <label className="login-label" htmlFor="password">{t('passwordLabel')}</label>
            <input
              id="password"
              ref={passwordInputRef}
              className="login-input"
              type="password"
              placeholder={t('passwordPlaceholder')}
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
                {t('loggingIn')}
              </span>
            ) : (
              t('login')
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;
