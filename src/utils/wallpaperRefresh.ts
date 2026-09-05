import AuthService from '../services/AuthService';
import createLogger from './logger';

const logger = createLogger('wallpaperRefresh');

const FALLBACK_WALLPAPER =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&q=80';

/**
 * 获取 Bing 每日壁纸 URL（从近 8 张中随机挑一张）。
 * @param excludeUrl 尽量避开上次使用的壁纸，避免连续重复
 */
export async function fetchBingWallpaperUrl(excludeUrl?: string | null): Promise<string> {
  try {
    const response = await fetch(
      '/api/bing/HPImageArchive.aspx?format=json&idx=0&n=8&mkt=zh-CN',
      { headers: AuthService.getAuthHeaders(), cache: 'no-store' },
    );
    if (!response.ok) throw new Error(`Bing API请求失败: ${response.status}`);
    const data = await response.json();
    if (data?.images?.length > 0) {
      const images: Array<{ url: string }> = data.images;
      // 从 url 字段构造图片地址，去掉 & 后的附加参数
      // 例如 /th?id=XXX_UHD.jpg&rf=... -> /th?id=XXX_UHD.jpg
      const toFullUrl = (img: { url: string }) => `https://cn.bing.com${img.url.split('&')[0]}`;
      const fullUrls = images.map(toFullUrl);
      const pool = fullUrls.filter((url) => url !== excludeUrl);
      const candidates = pool.length > 0 ? pool : fullUrls;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    throw new Error('Bing API返回数据格式异常');
  } catch (error) {
    logger.error('获取Bing壁纸失败', error);
    return FALLBACK_WALLPAPER;
  }
}

/** 生成随机壁纸 URL（随机参数保证每次不同） */
export function getRandomBingWallpaperUrl(): string {
  return `https://wp.upx8.com/api.php?r=${Date.now().toString(36)}`;
}

/**
 * 给自定义 URL 追加缓存破坏参数（覆盖旧参数），
 * 让指向动态图片源的地址（如 picsum）能换出新图。
 */
export function addCacheBustToUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('_t');
    parsed.searchParams.set('_t', Date.now().toString(36));
    return parsed.toString();
  } catch {
    return url;
  }
}
