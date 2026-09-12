import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { API_ERROR_CODES } from '../utils/constants';
import type { ApiErrorCode } from '../utils/constants';

function getWeatherApiConfig(env: Env): { apiKey: string; apiHost: string } | null {
  const apiKey = env.WEATHER_API_KEY;
  const apiHost = env.WEATHER_API_HOST;
  if (!apiKey || !apiHost) {
    return null;
  }
  return { apiKey, apiHost };
}

/** 和风天气支持的语言，缺省为中文 */
const WEATHER_LANGS = ['zh', 'en'];

function resolveLang(url: URL): string {
  const lang = url.searchParams.get('lang');
  return lang && WEATHER_LANGS.includes(lang) ? lang : 'zh';
}

async function fetchWeatherApi(
  env: Env,
  path: string,
  params: Record<string, string>,
  errorCode: ApiErrorCode
): Promise<Response> {
  const config = getWeatherApiConfig(env);
  if (!config) {
    return Response.json({ error: API_ERROR_CODES.WEATHER_API_NOT_CONFIGURED }, { status: 500 });
  }

  const queryString = Object.entries({ ...params, key: config.apiKey })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const fullUrl = `https://${config.apiHost}${path}?${queryString}`;

  try {
    const response = await fetch(fullUrl, {
      headers: { 'Accept-Encoding': 'gzip' },
    });

    if (!response.ok) {
      return Response.json({ error: errorCode }, { status: 500 });
    }

    const data = await response.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: errorCode }, { status: 500 });
  }
}

async function geoHandler(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
  }

  const location = url.searchParams.get('location');
  if (!location || location.length > 100) {
    return Response.json({ error: API_ERROR_CODES.INVALID_LOCATION }, { status: 400 });
  }

  return fetchWeatherApi(env, '/geo/v2/city/lookup', { location, lang: resolveLang(url) }, API_ERROR_CODES.GEO_REQUEST_FAILED);
}

async function weatherHandler(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
  }

  const latStr = url.searchParams.get('lat');
  const lonStr = url.searchParams.get('lon');
  if (!latStr || !lonStr) {
    return Response.json({ error: API_ERROR_CODES.MISSING_PARAM }, { status: 400 });
  }

  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: API_ERROR_CODES.INVALID_COORDINATES }, { status: 400 });
  }

  return fetchWeatherApi(env, '/v7/weather/now', { location: `${lon},${lat}`, lang: resolveLang(url) }, API_ERROR_CODES.WEATHER_REQUEST_FAILED);
}

// 模块级缓存：避免每次请求都重新创建闭包
const authenticatedGeoHandler = requireAuth(geoHandler);
const authenticatedWeatherHandler = requireAuth(weatherHandler);

export async function handleWeatherRoutes(request: Request, url: URL, env: Env): Promise<Response | null> {
  if (url.pathname.startsWith('/api/geo')) {
    return authenticatedGeoHandler(request, url, env);
  }
  if (url.pathname.startsWith('/api/weather')) {
    return authenticatedWeatherHandler(request, url, env);
  }
  return null;
}
