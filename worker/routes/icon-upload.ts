import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { generateIconFilename, getPrefix } from '../utils/icon';
import { secureId } from '../utils/crypto';
import { API_ERROR_CODES } from '../utils/constants';

async function uploadHandler(request: Request, _url: URL, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
  }

  if (!env.BUCKET || !env.R2_URL) {
    return Response.json({ error: API_ERROR_CODES.R2_UNAVAILABLE }, { status: 503 });
  }

  const formData = await request.formData();
  const type = (formData.get('type') as string) || 'site';
  const originalId = formData.get('id') as string | null;
  const originalDomain = formData.get('domain') as string | null;
  const rawFile = formData.get('file');

  // 使用 instanceof 显式校验，避免攻击者发送字符串表单字段绕过校验
  if (!(rawFile instanceof File)) {
    return Response.json({ error: API_ERROR_CODES.MISSING_FILE }, { status: 400 });
  }
  const file = rawFile;

  const maxSize = 100 * 1024;
  if (file.size > maxSize) {
    return Response.json(
      { error: API_ERROR_CODES.ICON_FILE_TOO_LARGE, maxSize: maxSize / 1024 },
      { status: 400 }
    );
  }

  const id = originalId ?? secureId('temp_');
  const domain = originalDomain ?? 'uploaded';

  const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

  if (!allowedExtensions.includes(fileExtension)) {
    return Response.json({ error: API_ERROR_CODES.UNSUPPORTED_FILE_FORMAT }, { status: 400 });
  }

  const timestampInput = `${type}_${id}_${domain}_${Date.now()}`;
  const filename = generateIconFilename(timestampInput, fileExtension);
  const prefix = getPrefix(type);
  const iconPath = `${prefix}/${filename}`;
  const fileData = await file.arrayBuffer();

  const mimeType = file.type || `image/${fileExtension}`;

  await env.BUCKET.put(iconPath, fileData, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      id,
      domain,
      type,
      createdAt: new Date().toISOString(),
      uploadedByUser: 'true',
      isTemp: (!originalId || !originalDomain) ? 'true' : 'false',
    },
  });

  const cleanR2Url = env.R2_URL.replace(/\/$/, '');
  const iconUrl = `${cleanR2Url}/${prefix}/${filename}`;
  return Response.json({
    success: true,
    path: iconPath,
    iconUrl,
  });
}

// 静态包装：避免每次请求都重新创建闭包
const authenticatedUploadHandler = requireAuth(uploadHandler);

export async function handleIconUpload(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (url.pathname !== '/api/icon/upload') {
    return null;
  }
  return authenticatedUploadHandler(request, url, env);
}
