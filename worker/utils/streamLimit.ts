import type { Env } from '../types';
import { API_ERROR_CODES } from './constants';

/**
 * 安全地读取响应体为 ArrayBuffer，实时计数字节，超限立即取消
 * 先检查 Content-Length 预检（服务器声明值），再使用 ReadableStream.getReader()
 * 分块读取，实时累加 totalBytes，超限抛错。
 * 适用于代理/下载类 Worker 路由，防止通过分块传输绕过大小限制导致 OOM
 */
export async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number
): Promise<ArrayBuffer> {
  const contentLengthStr = response.headers.get('Content-Length');
  if (contentLengthStr) {
    const contentLength = parseInt(contentLengthStr, 10);
    if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
      throw new ResponseSizeError(API_ERROR_CODES.IMAGE_TOO_LARGE);
    }
  }

  if (!response.body) {
    const data = await response.arrayBuffer();
    if (data.byteLength > maxBytes) {
      throw new ResponseSizeError(API_ERROR_CODES.IMAGE_TOO_LARGE);
    }
    return data;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new ResponseSizeError(API_ERROR_CODES.IMAGE_TOO_LARGE);
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

/**
 * 响应体大小超限时抛出的专用错误
 * Worker 端 catch 后通过 err instanceof ResponseSizeError 判断并映射为对应的错误码
 */
export class ResponseSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResponseSizeError';
  }
}

// Re-export Env type for convenience
export type { Env };
