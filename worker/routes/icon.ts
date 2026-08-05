import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { getIconPath, getIconUrl } from '../utils/icon';
import { readResponseBodyWithLimit, ResponseSizeError } from '../utils/streamLimit';
import { handleCleanup } from './icon-cleanup';

// 图标最大允许大小：2MB（favicon 一般 < 50KB）
const MAX_ICON_SIZE = 2 * 1024 * 1024;

/**
 * 默认 favicon 源配置（唯一权威定义，前端通过 GET /api/icon/sources/defaults 获取）
 */
interface FaviconSourceConfig {
  id: string;
  name: string;
  urlTemplate: string;
  enabled: boolean;
}

const DEFAULT_FAVICON_SOURCE_CONFIGS: FaviconSourceConfig[] = [
  {
    id: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com/s2/favicons?domain={domain}&sz=64',
    enabled: true,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    urlTemplate: 'https://icons.duckduckgo.com/ip3/{domain}.ico',
    enabled: true,
  },
  {
    id: 'favicon',
    name: 'Favicon',
    urlTemplate: 'https://www.favicon.vip/get.php?url={domain}',
    enabled: true,
  },
];

/**
 * 默认 favicon 多源 URL 列表（基于 DEFAULT_FAVICON_SOURCE_CONFIGS 生成）
 */
function getDefaultFaviconSources(domain: string): string[] {
  return DEFAULT_FAVICON_SOURCE_CONFIGS
    .filter((s) => s.enabled)
    .map((s) => s.urlTemplate.replace('{domain}', encodeURIComponent(domain)));
}

/**
 * 从 KV 读取用户配置的 favicon 源 URL 列表
 * 如果用户未配置或读取失败，回退到默认源
 */
async function getEffectiveFaviconSources(env: Env, domain: string): Promise<string[]> {
  try {
    const settingsRaw = await env.USER_DATA.get('settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      if (settings.faviconSources && Array.isArray(settings.faviconSources)) {
        const enabledUrls = settings.faviconSources
          .filter((s: { enabled?: boolean; urlTemplate?: string }) => s.enabled && s.urlTemplate)
          .map((s: { urlTemplate: string }) => s.urlTemplate.replace('{domain}', encodeURIComponent(domain)));
        if (enabledUrls.length > 0) return enabledUrls;
      }
    }
  } catch {
    // KV 读取或解析失败，使用默认源
  }
  return getDefaultFaviconSources(domain);
}

/**
 * 校验 URL 是否合法
 */
function isValidUrl(urlStr: string): boolean {
  try {
    new URL(urlStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * 共享的图标下载辅助函数：fetch + Content-Type 验证 + 流式大小限制
 * 检查 Content-Type 不是明显的错误页面类型（text/html, text/plain, application/json 等），
 * 再通过文件头检测（detectMimeType）做最终验证
 */
const BLOCKED_CONTENT_TYPES = ['text/', 'application/json', 'application/xml', 'text/html', 'text/plain'];

async function fetchIconWithLimit(
  downloadUrl: string,
  timeoutMs: number = 5000
): Promise<{ data: ArrayBuffer; contentType: string } | { response: Response }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': new URL(downloadUrl).origin + '/',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      return { response: Response.json({ error: `下载图标失败: ${response.status}` }, { status: 502 }) };
    }

    // 检查 Content-Type 是否为明显的非图片类型（HTML错误页等）
    const contentType = response.headers.get('content-type') || '';
    const isBlockedType = BLOCKED_CONTENT_TYPES.some(
      (blocked) => contentType.toLowerCase().startsWith(blocked)
    );
    if (isBlockedType) {
      return { response: Response.json({ error: `返回了非图片内容: ${contentType}` }, { status: 502 }) };
    }

    const data = await readResponseBodyWithLimit(response, MAX_ICON_SIZE);
    return { data, contentType };
  } catch (err) {
    if (err instanceof ResponseSizeError) {
      return { response: Response.json({ error: '图标过大' }, { status: 413 }) };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { response: Response.json({ error: '下载超时' }, { status: 504 }) };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { response: Response.json({ error: `下载图标网络错误: ${msg}` }, { status: 502 }) };
  }
}

/**
 * 共享的 R2 缓存写入逻辑（供多个缓存入口复用）
 */
async function cacheIconToR2(
  env: Env,
  type: string,
  hashInput: string,
  downloadUrl: string,
  data: ArrayBuffer,
  contentType: string = 'image/png'
): Promise<void> {
  const iconPath = getIconPath(type, hashInput);
  await env.BUCKET.put(iconPath, data, {
    httpMetadata: { contentType },
    customMetadata: {
      hashInput,
      downloadUrl,
      type,
      createdAt: new Date().toISOString(),
    },
  });
}

/**
 * 构建下载源列表
 * 自动 favicon 模式下用 domain 从 KV 读取用户配置，未配置则使用默认源
 * 用户自定义模式直接使用 downloadUrl
 */
async function buildSources(
  env: Env,
  hashInput: string,
  downloadUrl: string,
  domain?: string
): Promise<string[]> {
  const isAutoFavicon = !hashInput.startsWith('http');

  if (isAutoFavicon) {
    // 自动 favicon 模式：hashInput 是 websiteId，需要用 domain 构建 favicon 源 URL
    const effectiveDomain = domain || hashInput;
    return getEffectiveFaviconSources(env, effectiveDomain);
  }

  return [downloadUrl];
}

/**
 * 下载并缓存图标（从 KV 读取用户配置的 favicon 源）
 */
async function downloadAndCacheIcon(
  env: Env,
  type: string,
  hashInput: string,
  downloadUrl: string,
  domain?: string
): Promise<Response> {
  const sources = await buildSources(env, hashInput, downloadUrl, domain);

  // 校验所有源的 URL 合法性
  for (const url of sources) {
    if (!isValidUrl(url)) {
      return Response.json({ error: '下载URL格式无效' }, { status: 400 });
    }
  }

  const iconPath = getIconPath(type, hashInput);
  const iconUrl = getIconUrl(type, hashInput, env.R2_URL);

  try {
    const existing = await env.BUCKET.get(iconPath);
    if (existing) {
      return Response.json({ success: true, message: '图标已存在', iconUrl });
    }
  } catch {
    // R2获取失败，继续下载
  }

  // 按优先级依次尝试每个源
  for (const sourceUrl of sources) {
    const result = await fetchIconWithLimit(sourceUrl);
    if ('data' in result) {
      try {
        await cacheIconToR2(env, type, hashInput, sourceUrl, result.data, result.contentType);
      } catch (r2Error) {
        console.error(`R2存储失败: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`);
        return Response.json({ error: '图标保存失败' }, { status: 500 });
      }
      return Response.json({ success: true, message: '图标下载成功', iconUrl });
    }
  }

  return Response.json({ error: '所有图标源均下载失败' }, { status: 502 });
}

async function handlePostIcon(request: Request, _url: URL, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      type?: string;
      hashInput?: string;
      downloadUrl?: string;
      domain?: string;
    };
    const { type = 'site', hashInput, downloadUrl, domain } = body;

    if (!env.BUCKET || !env.R2_URL) {
      return Response.json({ error: 'R2 存储不可用，无法保存图标' }, { status: 503 });
    }

    if (!hashInput || !downloadUrl) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    return downloadAndCacheIcon(env, type, hashInput, downloadUrl, domain);
  } catch (error) {
    return Response.json({ error: `创建图标失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}

async function handleDeleteIcon(_request: Request, url: URL, env: Env): Promise<Response> {
  try {
    const action = url.searchParams.get('action');
    const type = url.searchParams.get('type') || 'site';

    if (action === 'cleanup') {
      if (!env.BUCKET || !env.R2_URL) {
        return Response.json({ error: 'R2 存储不可用，无法清理图标' }, { status: 503 });
      }
      const cursor = url.searchParams.get('cursor') || undefined;
      const prefix = url.searchParams.get('prefix') || undefined;
      return await handleCleanup(env, cursor, prefix);
    }

    let hashInput = url.searchParams.get('hashInput');
    if (!hashInput) {
      const id = url.searchParams.get('id');
      const domain = url.searchParams.get('domain');
      if (domain) {
        if (domain.length > 253 || !/^[a-zA-Z0-9.-]+$/.test(domain)) {
          return Response.json({ error: '无效的域名参数' }, { status: 400 });
        }
        hashInput = domain;
      } else if (id) {
        if (id.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
          return Response.json({ error: '无效的ID参数' }, { status: 400 });
        }
        hashInput = id;
      }
    } else {
      if (hashInput.length > 200 || hashInput.includes('..') || hashInput.includes('/')) {
        return Response.json({ error: '无效的hashInput参数' }, { status: 400 });
      }
    }

    if (!hashInput) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!env.BUCKET || !env.R2_URL) {
      return Response.json({ error: 'R2 存储不可用，无法删除图标' }, { status: 503 });
    }

    const iconPath = getIconPath(type, hashInput);
    await env.BUCKET.delete(iconPath);

    return Response.json({ success: true, message: '图标删除成功' });
  } catch (error) {
    return Response.json({ error: `操作失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}

const authenticatedHandlePostIcon = requireAuth(handlePostIcon);
const authenticatedHandleDeleteIcon = requireAuth(handleDeleteIcon);
const authenticatedHandleCacheSelectedIcon = requireAuth(handleCacheSelectedIcon);
const authenticatedHandleDownloadIcon = requireAuth(async (request: Request): Promise<Response> => {
  return handleDownloadIcon(request);
});

/**
 * 将二进制数据转换为 data:image URL
 */
function arrayBufferToDataUrl(data: ArrayBuffer, contentType: string): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as number[]);
  }
  const base64 = btoa(binary);
  const mimeType = contentType.split(';')[0].trim();
  return `data:${mimeType};base64,${base64}`;
}

/**
 * 从 HTML 中提取图标链接（支持 rel="icon", rel="shortcut icon", rel="apple-touch-icon" 等）
 */
function extractIconLinksFromHtml(html: string, baseUrl: string): string[] {
  const results: string[] = [];
  const base = new URL(baseUrl);

  // 匹配所有 <link ... rel="...icon..." ... href="..." ...> 标签
  const linkRegex = /<link\s+[^>]*rel\s*=\s*["']([^"']*icon[^"']*)["'][^>]*>/gi;
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/i;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const relValue = match[1].toLowerCase();
    // 只提取 icon 相关的 rel
    if (relValue.includes('icon')) {
      const hrefMatch = match[0].match(hrefRegex);
      if (hrefMatch) {
        try {
          const absoluteUrl = new URL(hrefMatch[1], base.href).href;
          results.push(absoluteUrl);
        } catch {
          // 无效 URL，跳过
        }
      }
    }
  }

  // 也尝试匹配 rel 在 href 之后的情况
  const linkRegex2 = /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']([^"']*icon[^"']*)["'][^>]*>/gi;
  while ((match = linkRegex2.exec(html)) !== null) {
    const relValue = match[2].toLowerCase();
    if (relValue.includes('icon')) {
      try {
        const absoluteUrl = new URL(match[1], base.href).href;
        if (!results.includes(absoluteUrl)) {
          results.push(absoluteUrl);
        }
      } catch {
        // 无效 URL，跳过
      }
    }
  }

  // 也提取 <meta property="og:image"> 作为备选
  const ogImageRegex = /<meta\s+[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let ogMatch;
  while ((ogMatch = ogImageRegex.exec(html)) !== null) {
    try {
      const absoluteUrl = new URL(ogMatch[1], base.href).href;
      if (!results.includes(absoluteUrl)) {
        results.push(absoluteUrl);
      }
    } catch {
      // 跳过
    }
  }
  const ogImageRegex2 = /<meta\s+[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["'][^>]*>/gi;
  while ((ogMatch = ogImageRegex2.exec(html)) !== null) {
    try {
      const absoluteUrl = new URL(ogMatch[1], base.href).href;
      if (!results.includes(absoluteUrl)) {
        results.push(absoluteUrl);
      }
    } catch {
      // 跳过
    }
  }

  return results;
}

/**
 * 自动获取网站图标候选列表：仅分析页面结构，不下载图标
 * 下载由前端通过 /api/icon/download 并发完成，避免 Worker 超时
 */
async function handleAutoFetchIcons(_request: Request, url: URL, env: Env): Promise<Response> {
  const debug: string[] = [];
  const log = (msg: string) => {
    console.log(`[autoFetch] ${msg}`);
    debug.push(msg);
  };

  try {
    const targetUrl = url.searchParams.get('url');

    log(`=== 开始分析页面结构 ===`);
    log(`目标URL: ${targetUrl}`);

    if (!targetUrl) {
      return Response.json({ error: '缺少目标URL参数', debug }, { status: 400 });
    }

    if (!isValidUrl(targetUrl)) {
      return Response.json({ error: 'URL格式无效', debug }, { status: 400 });
    }

    const parsedUrl = new URL(targetUrl);
    let host = parsedUrl.host;
    let domain = parsedUrl.hostname;
    let rootUrl = `${parsedUrl.protocol}//${host}`;
    let sitePathRoot = '';
    let htmlBaseUrl = '';

    const candidates: { url: string; source: string }[] = [];

    // 来源 1：HTML页面中的图标链接
    try {
      log(`正在获取HTML页面...`);
      const htmlResponse = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });
      log(`HTML响应状态: ${htmlResponse.status}`);

      const finalUrl = htmlResponse.url || targetUrl;
      if (finalUrl !== targetUrl) {
        log(`⚠️ URL发生跳转: ${targetUrl} → ${finalUrl}`);
      }

      const finalParsedUrl = new URL(finalUrl);
      host = finalParsedUrl.host;
      domain = finalParsedUrl.hostname;
      rootUrl = `${finalParsedUrl.protocol}//${host}`;

      const finalPathname = finalParsedUrl.pathname;
      sitePathRoot = finalPathname === '/'
        ? rootUrl + '/'
        : (finalPathname.endsWith('/') ? finalUrl.replace(/\/[^/]*$/, '/') : rootUrl + finalPathname.substring(0, finalPathname.lastIndexOf('/') + 1));

      const finalPageUrl = new URL(finalUrl);
      finalPageUrl.search = '';
      finalPageUrl.hash = '';
      htmlBaseUrl = finalPageUrl.href.endsWith('/') ? finalPageUrl.href : finalPageUrl.href + '/';

      log(`最终URL: ${finalUrl}`);
      log(`根URL: ${rootUrl}`);
      log(`站点路径根: ${sitePathRoot}`);

      if (htmlResponse.ok) {
        const htmlText = await htmlResponse.text();
        log(`HTML长度: ${htmlText.length} 字节`);

        const headEndTag = htmlText.indexOf('</head>');
        const parseRange = headEndTag > 0 ? htmlText.substring(0, headEndTag + 7) : htmlText;

        const iconLinks = extractIconLinksFromHtml(parseRange, htmlBaseUrl);
        log(`从HTML提取到 ${iconLinks.length} 个图标链接`);
        for (const link of iconLinks) {
          candidates.push({ url: link, source: 'HTML' });
        }
      } else {
        log(`HTML获取失败: HTTP ${htmlResponse.status}`);
      }
    } catch (err) {
      log(`HTML获取异常: ${err instanceof Error ? err.message : String(err)}`);
      sitePathRoot = sitePathRoot || (parsedUrl.pathname === '/'
        ? rootUrl + '/'
        : (parsedUrl.pathname.endsWith('/') ? parsedUrl.href : rootUrl + parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf('/') + 1)));
      htmlBaseUrl = htmlBaseUrl || (parsedUrl.href.endsWith('/') ? parsedUrl.href : parsedUrl.href + '/');
    }

    // 来源 2：常见favicon路径
    const rootFaviconPaths = [
      '/favicon.png',
      '/favicon.jpg',
      '/favicon.ico',
      '/favicon.svg',
      '/images/favicon.png',
      '/images/favicon.jpg',
      '/images/favicon.ico',
      '/images/favicon.svg',
    ];
    for (const path of rootFaviconPaths) {
      candidates.push({ url: `${rootUrl}${path}`, source: '常见路径' });
    }
    if (sitePathRoot !== rootUrl + '/') {
      for (const path of rootFaviconPaths) {
        candidates.push({ url: `${sitePathRoot}${path.substring(1)}`, source: '路径常见路径' });
      }
    }

    // 来源 3：系统配置的图标源
    const faviconSourceUrls = (await getEffectiveFaviconSources(env, domain)).map((s) => ({ url: s, source: '图标源' }));
    candidates.push(...faviconSourceUrls);

    // 去重
    const seen = new Set<string>();
    const uniqueCandidates = candidates.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
    log(`候选去重后共 ${uniqueCandidates.length} 个`);

    return Response.json({
      success: true,
      total: uniqueCandidates.length,
      candidates: uniqueCandidates,
      debug,
    });
  } catch (error) {
    log(`致命错误: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: `分析页面结构失败: ${error instanceof Error ? error.message : String(error)}`, debug }, { status: 500 });
  }
}

/**
 * 下载单个图标并返回 data URL（供前端并发调用）
 */
async function handleDownloadIcon(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { url?: string };
    const { url: downloadUrl } = body;

    if (!downloadUrl) {
      return Response.json({ error: '缺少URL参数' }, { status: 400 });
    }

    if (!isValidUrl(downloadUrl)) {
      return Response.json({ error: 'URL格式无效' }, { status: 400 });
    }

    const result = await fetchIconWithLimit(downloadUrl);
    if ('response' in result) {
      return result.response;
    }

    const { data, contentType } = result;

    // 优先使用响应 Content-Type，回退到文件头检测
    const headerCt = contentType.split(';')[0].trim();
    let mimeType = headerCt;

    if (!mimeType.startsWith('image/')) {
      const detected = detectMimeType(data, downloadUrl);
      mimeType = detected;
    }

    if (!mimeType || !mimeType.startsWith('image/')) {
      return Response.json({ error: '非图片内容' }, { status: 422 });
    }

    const dataUrl = arrayBufferToDataUrl(data, mimeType);
    return Response.json({
      success: true,
      dataUrl,
      size: data.byteLength,
      mimeType,
    });
  } catch (error) {
    return Response.json({ error: `下载图标失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}

/**
 * 根据文件扩展名或数据内容检测 MIME 类型
 */
function detectMimeType(data: ArrayBuffer, url: string): string {
  // 先根据 URL 扩展名判断
  const urlLower = url.toLowerCase();
  if (urlLower.endsWith('.svg')) return 'image/svg+xml';
  if (urlLower.endsWith('.ico')) return 'image/x-icon';
  if (urlLower.endsWith('.png')) return 'image/png';
  if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) return 'image/jpeg';
  if (urlLower.endsWith('.gif')) return 'image/gif';
  if (urlLower.endsWith('.webp')) return 'image/webp';
  if (urlLower.endsWith('.bmp')) return 'image/bmp';

  // 根据文件头判断
  const bytes = new Uint8Array(data, 0, 12);
  if (bytes.length >= 4) {
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'image/jpeg';
    }
    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return 'image/gif';
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
      return 'image/webp';
    }
    // ICO: 00 00 01 00
    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
      return 'image/x-icon';
    }
    // SVG: 3C 3F 78 6D 6C (<?xml) or 3C 73 76 67 (<svg)
    if (bytes.length >= 5) {
      const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
      if (header === '<?xml' || header.startsWith('<svg')) {
        return 'image/svg+xml';
      }
    }
  }

  // 默认返回空字符串（无法识别则不通过）
  return '';
}

/**
 * 缓存选中的图标（data URL）到 R2（供 AutoFetchDialog 使用）
 */
async function handleCacheSelectedIcon(request: Request, _url: URL, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as {
      type?: string;
      hashInput?: string;
      iconDataUrl?: string;
    };
    const { type = 'site', hashInput, iconDataUrl } = body;

    if (!hashInput || !iconDataUrl) {
      return Response.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (!env.BUCKET || !env.R2_URL) {
      return Response.json({ error: 'R2 存储不可用' }, { status: 503 });
    }

    // 从 data URL 解码
    const dataMatch = iconDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataMatch) {
      return Response.json({ error: '无效的图标数据' }, { status: 400 });
    }

    const mimeType = dataMatch[1];
    const base64Data = dataMatch[2];
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 复用公共缓存逻辑
    await cacheIconToR2(env, type, hashInput, '', bytes.buffer, mimeType);

    const iconUrl = getIconUrl(type, hashInput, env.R2_URL);
    return Response.json({ success: true, iconUrl });
  } catch (error) {
    return Response.json({ error: `保存图标失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}

/**
 * 返回默认 favicon 源配置（前端通过此 API 获取，不再前端硬编码）
 */
function handleGetDefaultSources(): Response {
  return Response.json({
    sources: DEFAULT_FAVICON_SOURCE_CONFIGS.map((s) => ({ ...s })),
  });
}

/**
 * 直接下载指定 URL 的图标并缓存到 R2（用于 EditWebsite「保存到R2」功能）
 * 与 downloadAndCacheIcon 不同，此函数直接从指定 URL 下载，不尝试 favicon 源列表
 */
async function cacheUrlToR2(
  env: Env,
  type: string,
  hashInput: string,
  targetUrl: string
): Promise<Response> {
  if (!env.BUCKET || !env.R2_URL) {
    return Response.json({ error: 'R2 存储不可用' }, { status: 503 });
  }

  if (!isValidUrl(targetUrl)) {
    return Response.json({ error: 'URL格式无效' }, { status: 400 });
  }

  const result = await fetchIconWithLimit(targetUrl);
  if ('response' in result) {
    return result.response;
  }

  const { data, contentType } = result;

  try {
    await cacheIconToR2(env, type, hashInput, targetUrl, data, contentType);
  } catch (r2Error) {
    console.error(`R2存储失败: ${r2Error instanceof Error ? r2Error.message : String(r2Error)}`);
    return Response.json({ error: '图标保存到R2失败' }, { status: 500 });
  }

  const iconUrl = getIconUrl(type, hashInput, env.R2_URL);
  return Response.json({ success: true, iconUrl, message: '图标已保存到R2' });
}

const authenticatedHandleCacheUrlToR2 = requireAuth(async (request: Request, _url: URL, env: Env): Promise<Response> => {
  try {
    const body = (await request.json()) as {
      type?: string;
      hashInput?: string;
      url?: string;
    };
    const { type = 'site', hashInput, url: targetUrl } = body;

    if (!hashInput || !targetUrl) {
      return Response.json({ error: '缺少必要参数（hashInput, url）' }, { status: 400 });
    }

    return cacheUrlToR2(env, type, hashInput, targetUrl);
  } catch (error) {
    return Response.json({ error: `保存图标失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
});

export async function handleIconRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  // 默认 favicon 源配置（前端查询用，无需认证）
  if (url.pathname === '/api/icon/sources/defaults') {
    if (request.method === 'GET') {
      return handleGetDefaultSources();
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 直接缓存指定URL的图标到R2（EditWebsite「保存到R2」功能）
  if (url.pathname === '/api/icon/cache-url') {
    if (request.method === 'POST') {
      return authenticatedHandleCacheUrlToR2(request, url, env);
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 自动获取图标候选列表
  if (url.pathname === '/api/icon/autofetch') {
    if (request.method === 'GET') {
      return handleAutoFetchIcons(request, url, env);
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 下载单个图标并返回 data URL（供前端并发调用）
  if (url.pathname === '/api/icon/download') {
    if (request.method === 'POST') {
      return authenticatedHandleDownloadIcon(request, url, env);
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 缓存选中的图标（data URL）到R2
  if (url.pathname === '/api/icon/autofetch/cache') {
    if (request.method === 'POST') {
      return authenticatedHandleCacheSelectedIcon(request, url, env);
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (url.pathname === '/api/icon') {
    if (request.method === 'POST') {
      return authenticatedHandlePostIcon(request, url, env);
    }

    if (request.method === 'DELETE') {
      return authenticatedHandleDeleteIcon(request, url, env);
    }

    return new Response('Method Not Allowed', { status: 405 });
  }

  return null;
}
