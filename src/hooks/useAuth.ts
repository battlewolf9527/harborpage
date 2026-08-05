import { useState, useEffect, useCallback } from 'react';
import { getServices } from '../services/serviceContainer';
import createLogger from '../utils/logger';

const logger = createLogger('useAuth');

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { authService, configService } = getServices();
      const authenticated = await authService.checkAuthStatus();
      setIsAuthenticated(authenticated);
      if (authenticated) {
        try {
          await configService.fetchConfig();
        } catch (error) {
          logger.error('获取配置失败', error);
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthLogout = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('authLogout', handleAuthLogout);

    return () => {
      window.removeEventListener('authLogout', handleAuthLogout);
    };
  }, []);

  const handleLogin = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  return {
    isAuthenticated,
    isCheckingAuth,
    handleLogin,
  };
}
