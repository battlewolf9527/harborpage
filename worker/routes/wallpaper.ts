import type { Env } from '../types';
import { readResponseBodyWithLimit, ResponseSizeError } from '../utils/streamLimit';

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
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  try {
    const wallpaperUrl = url.searchParams.get('url');
    if (!wallpaperUrl) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // URL 解析校验
    let parsed: URL;
    try {
      parsed = new URL(wallpaperUrl);
    } catch {
      return Response.json({ error: '无效的 URL' }, { status: 400 });
    }

    // 仅允许 HTTPS + 域名白名单
    if (parsed.protocol !== 'https:') {
      return Response.json({ error: '仅允许 HTTPS 协议' }, { status: 400 });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return Response.json({ error: '域名不被允许' }, { status: 403 });
    }

    const response = await fetch(wallpaperUrl);
    if (!response.ok) {
      return Response.json({ error: `获取壁纸失败: ${response.status} ${response.statusText}` }, { status: 502 });
    }

    let imageData: ArrayBuffer;
    try {
      imageData = await readResponseBodyWithLimit(response, MAX_WALLPAPER_SIZE);
    } catch (err) {
      if (err instanceof ResponseSizeError) {
        return Response.json({ error: '图片过大' }, { status: 413 });
      }
      throw err;
    }

    return new Response(imageData, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return Response.json({ error: `获取壁纸失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
