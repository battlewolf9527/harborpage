import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';

// 从 hostname 提取第二级域名并转大写作为兜底标题
// www.qq.com → QQ；youku.com → YOUKU；aaa.bbb.ccc.com → CCC
function extractDomainTitle(hostname: string): string {
  const parts = hostname.split('.');
  // 去掉顶级域名（最后一段），取剩余的最后一段
  if (parts.length >= 2) {
    return parts[parts.length - 2].toUpperCase();
  }
  return hostname.toUpperCase();
}

async function fetchTitleHandler(request: Request, url: URL, _env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) {
    return Response.json({ error: '缺少 url 参数' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return Response.json({ error: '无效的 URL' }, { status: 400 });
  }

  let title = '';

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
        try {
          title = decodeURIComponent(title);
        } catch {
          // 标题不是 URL 编码，直接使用
        }
        // 去除 HTML 标签
        title = title.replace(/<[^>]*>/g, '').trim();
      }
    }
  } catch {
    // fetch 失败时静默处理，使用域名兜底
  }

  // 获取不到标题或标题为空时，用第二级域名大写作为兜底
  if (!title) {
    title = extractDomainTitle(parsedUrl.hostname);
  }

  return Response.json({ title });
}

const authenticatedTitleHandler = requireAuth(fetchTitleHandler);

export async function handleTitleRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/title')) {
    return null;
  }
  return authenticatedTitleHandler(request, url, env);
}