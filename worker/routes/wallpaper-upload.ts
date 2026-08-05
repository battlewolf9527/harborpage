import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';

const WALLPAPER_PATH = 'wallpaper.png';
const MAX_WALLPAPER_SIZE = 10 * 1024 * 1024;

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

  await env.BUCKET.put(WALLPAPER_PATH, fileData, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      uploadedAt: new Date().toISOString(),
    },
  });

  const cleanR2Url = env.R2_URL.replace(/\/$/, '');
  const wallpaperUrl = `${cleanR2Url}/${WALLPAPER_PATH}`;
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
