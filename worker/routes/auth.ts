import type { Env } from '../types';
import { sha256, timingSafeEqual } from '../utils/crypto';
import { authenticate, generateJwt, requireAuth } from '../middleware/auth';

async function configHandler(_request: Request, _url: URL, env: Env): Promise<Response> {
  const hasBucket = !!env.BUCKET;
  const hasR2Url = !!env.R2_URL;
  const r2StorageAvailable = hasBucket && hasR2Url;
  const enableR2Cdn = r2StorageAvailable && env.ENABLE_R2_CDN === 'true';

  return Response.json({
    r2Url: env.R2_URL || '',
    enableR2Cdn,
    r2StorageAvailable,
  });
}

// 模块级缓存：避免每次请求都重新创建闭包
const authenticatedConfigHandler = requireAuth(configHandler);

// 密码哈希缓存：避免时间攻击
const passwordHashCache = new Map<string, string>();

async function getStoredPasswordHash(env: Env): Promise<string> {
  const cached = passwordHashCache.get(env.PASSWORD);
  if (cached) return cached;
  const hash = await sha256(env.PASSWORD);
  passwordHashCache.set(env.PASSWORD, hash);
  return hash;
}

export async function handleAuthRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (url.pathname === '/api/login') {
    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as { passwordHash: string };
        if (!body.passwordHash) {
          return Response.json({ error: '缺少密码参数' }, { status: 400 });
        }
        const storedPasswordHash = await getStoredPasswordHash(env);
        // 使用 Worker 安全的 XOR 逐字节恒定时间比较（非 crypto.subtle）
        const passwordMatches = timingSafeEqual(body.passwordHash, storedPasswordHash);
        if (!passwordMatches) {
          return Response.json({ error: '认证失败' }, { status: 401 });
        }
        const token = await generateJwt(env);
        return Response.json({ success: true, token });
      } catch {
        return Response.json({ error: '登录失败' }, { status: 500 });
      }
    }
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  if (url.pathname === '/api/auth/status') {
    if (request.method === 'GET') {
      const isAuthenticated = await authenticate(request, env);
      return Response.json({ authenticated: isAuthenticated });
    }
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  if (url.pathname === '/api/config') {
    if (request.method === 'GET') {
      return authenticatedConfigHandler(request, url, env);
    }
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  return null;
}
