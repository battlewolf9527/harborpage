import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';

const WALLPAPER_PREFIX = 'wallpapers/';
const MAX_WALLPAPER_SIZE = 10 * 1024 * 1024;

function extractR2Path(url: string, r2BaseUrl: string): string | null {
  // 兼容旧版本带 ?t= 时间戳的 URL
  const cleanUrl = url.split('?')[0];
  if (!cleanUrl.startsWith(r2BaseUrl)) return null;
  const path = cleanUrl.slice(r2BaseUrl.length + 1);
  return path || null;
}

async function uploadHandler(request: Request, _url: URL, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  if (!env.BUCKET || !env.R2_URL) {
    return Response.json({ error: 'R2 存储不可用' }, { status: 503 });
  }

  const formData = await request.formData();
  const rawFile = formData.get('file');

  if (!(rawFile instanceof File)) {
    return Response.json({ error: '缺少文件或文件格式无效' }, { status: 400 });
  }

  if (rawFile.size > MAX_WALLPAPER_SIZE) {
    return Response.json({ error: '文件大小超过限制（最大10MB）' }, { status: 400 });
  }

  const fileData = await rawFile.arrayBuffer();
  const mimeType = rawFile.type || 'image/png';

  // 基于内容 hash 命名，相同内容自动去重，不同内容生成新文件实现缓存破坏
  const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);
  const hashHex = [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashPrefix = hashHex.slice(0, 16);
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
  const wallpaperPath = `${WALLPAPER_PREFIX}${hashPrefix}.${ext}`;

  const cleanR2Url = env.R2_URL.replace(/\/$/, '');
  const wallpaperUrl = `${cleanR2Url}/${wallpaperPath}`;

  // 内容相同则跳过重复上传
  const existing = await env.BUCKET.head(wallpaperPath);
  if (!existing) {
    await env.BUCKET.put(wallpaperPath, fileData, {
      httpMetadata: {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  // 清理上一个壁纸文件，避免 R2 累积垃圾文件
  const previousUrl = request.headers.get('X-Previous-Wallpaper');
  if (previousUrl) {
    const oldPath = extractR2Path(previousUrl, cleanR2Url);
    if (oldPath && oldPath.startsWith(WALLPAPER_PREFIX) && oldPath !== wallpaperPath) {
      await env.BUCKET.delete(oldPath).catch(() => {
        // 删除失败不阻塞上传流程
      });
    }
  }

  return Response.json({
    success: true,
    wallpaperUrl,
  });
}

const authenticatedUploadHandler = requireAuth(uploadHandler);

export async function handleWallpaperUpload(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (url.pathname !== '/api/wallpaper/upload') {
    return null;
  }
  return authenticatedUploadHandler(request, url, env);
}
