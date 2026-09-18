// 认证服务
import { STORAGE_KEYS } from '../constants';
import ConfigService from './ConfigService';
import createLogger from '../utils/logger';
import i18n from '../i18n';

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
    if (!crypto?.subtle) {
      throw new Error('CRYPTO_SUBTLE_UNAVAILABLE');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // 登录 - 发送密码的 SHA-256 哈希值
  public async login(password: string): Promise<{ success: boolean; error?: string }> {
    let passwordHash: string;
    try {
      passwordHash = await this.sha256(password);
    } catch (error) {
      logger.error('Password hashing failed', error);
      if (error instanceof Error && error.message === 'CRYPTO_SUBTLE_UNAVAILABLE') {
        return {
          success: false,
          error: i18n.t('system:auth.cryptoSubtleUnavailable'),
        };
      }
      return { success: false, error: i18n.t('system:auth.passwordEncryptFailed') };
    }

    try {
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
          logger.error('Failed to fetch config', configError);
        }
        return { success: true };
      }
      // 密码错误（401）或其他非 OK 状态，统一显示默认错误
      return { success: false };
    } catch (error) {
      logger.error('Login failed', error);
      return { success: false, error: i18n.t('system:auth.networkRequestFailed') };
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
      // 请求未能发出（离线）时回落到本地 token 判断：
      // 否则已登录设备一断网就被踢回登录页，而登录本身依赖服务端校验、离线不可能成功，
      // 用户会被彻底挡在应用外——离线可用也就无从谈起。
      logger.warn('Auth status check failed, falling back to local token', error);
      return this.isTokenUsableOffline();
    }
  }

  /**
   * 离线时判断本地 token 是否仍可放行（只校验有效期，不验签）。
   *
   * 【为何不验签】
   * 该结果只用于决定「离线时是否放行到本机镜像数据」，而本机镜像本来就在这台设备的
   * localStorage 里，伪造 token 读不到任何额外内容；真正的鉴权仍由服务端 JWT 校验负责。
   *
   * 【为何不用 jose】
   * jose 目前只被 Worker 端使用，引入客户端会把整包打进首屏 chunk；
   * 这里只需要 exp，手工解 base64url 即可。
   */
  private isTokenUsableOffline(): boolean {
    if (!this.token) return false;
    try {
      const payloadSegment = this.token.split('.')[1];
      if (!payloadSegment) return false;
      const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
      const exp = (payload as { exp?: unknown }).exp;
      // 无 exp 视为不可用，避免离线状态下无限期放行
      if (typeof exp !== 'number') return false;
      return exp * 1000 > Date.now();
    } catch (error) {
      logger.error('Failed to decode token payload', error);
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
