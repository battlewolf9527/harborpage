import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { API_ERROR_CODES } from '../utils/constants';

async function bingHandler(request: Request, url: URL, _env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
  }

  try {
    const bingPath = url.pathname.slice('/api/bing'.length);

    // 从原始查询字符串构建新参数，去掉可能的 ? 前缀
    const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : url.search;
    const params = new URLSearchParams(rawQuery);
    params.set('format', 'js');
    params.set('nc', Date.now().toString());
    params.set('pid', 'hp');
    params.set('FORM', 'BEHPTB');
    params.set('uhd', '1');
    params.set('uhdwidth', '3840');
    params.set('uhdheight', '2160');

    const bingUrl = `https://cn.bing.com${bingPath}?${params.toString()}`;

    const response = await fetch(bingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://cn.bing.com/',
      },
    });

    if (!response.ok) {
      return Response.json(
        { error: API_ERROR_CODES.BING_REQUEST_FAILED },
        { status: 502 }
      );
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return Response.json(data, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return Response.json(
        { error: API_ERROR_CODES.BING_INVALID_RESPONSE, raw: text.slice(0, 200) },
        { status: 502 }
      );
    }
  } catch {
    return Response.json({ error: API_ERROR_CODES.BING_PROXY_ERROR }, { status: 500 });
  }
}

// 模块级缓存：避免每次请求都重新创建闭包
const authenticatedBingHandler = requireAuth(bingHandler);

export async function handleBingRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  // 精确匹配 '/api/bing' 或以 '/api/bing/' 开头，避免误匹配 '/api/bingapi' 等
  if (url.pathname !== '/api/bing' && !url.pathname.startsWith('/api/bing/')) {
    return null;
  }
  return authenticatedBingHandler(request, url, env);
}
