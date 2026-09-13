import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';
import { API_ERROR_CODES } from '../utils/constants';
import { getWeatherProvider } from '../weather/registry';

/** 未指定语言时的兜底（前端传 i18n 语言，如 zh-CN / en-US） */
const DEFAULT_APP_LANG = 'zh-CN';

function resolveAppLang(url: URL): string {
  const lang = url.searchParams.get('lang');
  return lang && lang.length <= 20 ? lang : DEFAULT_APP_LANG;
}

async function geoHandler(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: API_ERROR_CODES.METHOD_NOT_ALLOWED }, { status: 405 });
  }

  const location = url.searchParams.get('location');
  if (!location || location.length > 100) {
    return Response.json({ error: API_ERROR_CODES.INVALID_LOCATION }, { status: 400 });
  }

  const provider = getWeatherProvider(env);
  if (!provider) {
    return Response.json({ error: API_ERROR_CODES.WEATHER_API_NOT_CONFIGURED }, { status: 500 });
  }

  const locations = await provider.lookupCity(location, provider.toProviderLang(resolveAppLang(url)), env);
  if (locations === null) {
    return Response.json({ error: API_ERROR_CODES.GEO_REQUEST_FAILED }, { status: 500 });
  }
  return Response.json({ locations });
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

  const provider = getWeatherProvider(env);
  if (!provider) {
    return Response.json({ error: API_ERROR_CODES.WEATHER_API_NOT_CONFIGURED }, { status: 500 });
  }

  const weather = await provider.getCurrentWeather(lat, lon, provider.toProviderLang(resolveAppLang(url)), env);
  if (weather === null) {
    return Response.json({ error: API_ERROR_CODES.WEATHER_REQUEST_FAILED }, { status: 500 });
  }
  return Response.json(weather);
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
