import type { Env } from '../types';
import { readResponseBodyWithLimit, ResponseSizeError } from '../utils/streamLimit';
import { API_ERROR_CODES } from '../utils/constants';

// 壁纸代理允许的域名白名单
const ALLOWED_HOSTS = new Set([
  'www.bing.com',
  'bing.com',
  'cn.bing.com',
  's.cn.bing.net',
  's.bing.net',
  'images.unsplash.com',
  'wp.upx8.com',
  'www.yumus.cn',
]);

// 壁纸最大响应大小：10MB
const MAX_WALLPAPER_SIZE = 10 * 1024 * 1024;

// 处理壁纸代理路由：/api/wallpaper
// 通过 CSS url() 调用，无法携带 Authorization 头
// 通过域名白名单 + HTTPS 校验 + 流式大小限制防御 SSRF
// 返回 null 表示路由不匹配，交给下一个处理器
export async function handleWallpaperRoutes(request: Request, url: URL, _env: Env): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/wallpaper')) {
    return null;
  }

  if (request.method !== 'GET') {
    return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
  }

  try {
    const wallpaperUrl = url.searchParams.get('url');
    if (!wallpaperUrl) {
      return Response.json({ error: API_ERROR_CODES.MISSING_PARAM }, { status: 400 });
    }

    // URL 解析校验
    let parsed: URL;
    try {
      parsed = new URL(wallpaperUrl);
    } catch {
      return Response.json({ error: API_ERROR_CODES.INVALID_URL }, { status: 400 });
    }

    // 仅允许 HTTPS + 域名白名单
    if (parsed.protocol !== 'https:') {
      return Response.json({ error: API_ERROR_CODES.HTTPS_REQUIRED }, { status: 400 });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return Response.json({ error: API_ERROR_CODES.HOST_NOT_ALLOWED }, { status: 403 });
    }

    const response = await fetch(wallpaperUrl);
    if (!response.ok) {
      return Response.json({ error: API_ERROR_CODES.WALLPAPER_FETCH_FAILED }, { status: 502 });
    }

    let imageData: ArrayBuffer;
    try {
      imageData = await readResponseBodyWithLimit(response, MAX_WALLPAPER_SIZE);
    } catch (err) {
      if (err instanceof ResponseSizeError) {
        return Response.json({ error: API_ERROR_CODES.IMAGE_TOO_LARGE }, { status: 413 });
      }
      throw err;
    }

    return new Response(imageData, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return Response.json({ error: API_ERROR_CODES.WALLPAPER_FETCH_FAILED }, { status: 500 });
  }
}
