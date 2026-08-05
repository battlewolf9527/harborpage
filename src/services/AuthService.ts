// 认证服务
import { STORAGE_KEYS } from '../constants';
import ConfigService from './ConfigService';
import createLogger from '../utils/logger';

const logger = createLogger('AuthService');

class AuthService {
  private static instance: AuthService;
  private token: string | null = null;

  private constructor() {
    // 从 localStorage 加载 token（同一域名下所有标签页共享，7天后由JWT自动过期）
    this.token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // 获取当前 token
  public getToken(): string | null {
    return this.token;
  }

  // SHA-256 哈希函数
  private async sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // 登录 - 发送密码的 SHA-256 哈希值
  public async login(password: string): Promise<boolean> {
    try {
      const passwordHash = await this.sha256(password);
      
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passwordHash }),
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.token;
        if (this.token) {
          localStorage.setItem(STORAGE_KEYS.TOKEN, this.token);
        }
        // 登录成功后获取系统配置（需认证）
        try {
          await ConfigService.fetchConfig();
        } catch (configError) {
          logger.error('获取配置失败', configError);
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.error('登录失败', error);
      return false;
    }
  }

  // 登出
  public logout(): void {
    this.token = null;
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    // 触发登出事件，通知应用跳转到登录界面
    window.dispatchEvent(new CustomEvent('authLogout'));
  }

  // 处理认证失败（401错误）- 自动登出并跳转登录
  public handleAuthFailure(): void {
    this.logout();
  }

  // 检查认证状态
  public async checkAuthStatus(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/status', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.authenticated;
      }
      // 401 等非 OK 响应统一触发认证失败处理，与其他 API 调用保持一致
      if (response.status === 401) {
        this.handleAuthFailure();
      }
      return false;
    } catch (error) {
      logger.error('检查认证状态失败', error);
      return false;
    }
  }

  // 获取带认证头的请求配置
  public getAuthHeaders(): HeadersInit {
    return this.token ? {
      'Authorization': `Bearer ${this.token}`,
    } : {};
  }
}

export default AuthService.getInstance();
