import { SignJWT, jwtVerify } from 'jose';
import type { Env } from '../types';

// JWT 配置常量
const JWT_ISSUER = 'harborpage-worker';
const JWT_AUDIENCE = 'harborpage-app';

export async function generateJwt(env: Env): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return await new SignJWT({
    user: 'admin',
    role: 'admin',
    // jti 在 setJti 中设置
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(crypto.randomUUID()) // 防止重放攻击
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyJwt(token: string, env: Env): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return true;
  } catch {
    return false;
  }
}

export async function authenticate(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7);
  return await verifyJwt(token, env);
}

type RouteHandler = (request: Request, url: URL, env: Env) => Promise<Response | null>;

export function requireAuth(handler: RouteHandler): RouteHandler {
  return async (request: Request, url: URL, env: Env) => {
    const isAuthenticated = await authenticate(request, env);
    if (!isAuthenticated) {
      return Response.json({ error: '未授权，请先登录' }, { status: 401 });
    }
    return await handler(request, url, env);
  };
}
