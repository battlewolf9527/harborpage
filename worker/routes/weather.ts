import type { Env } from '../types';
import { requireAuth } from '../middleware/auth';

function getWeatherApiConfig(env: Env): { apiKey: string; apiHost: string } | null {
  const apiKey = env.WEATHER_API_KEY;
  const apiHost = env.WEATHER_API_HOST;
  if (!apiKey || !apiHost) {
    return null;
  }
  return { apiKey, apiHost };
}

async function fetchWeatherApi(
  env: Env,
  path: string,
  params: Record<string, string>,
  errorContext: string
): Promise<Response> {
  const config = getWeatherApiConfig(env);
  if (!config) {
    return Response.json({ error: '缺少天气API配置' }, { status: 500 });
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
      return Response.json({ error: `${errorContext}请求失败: ${response.status} ${response.statusText}` }, { status: 500 });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: `${errorContext}失败: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}

async function geoHandler(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  const location = url.searchParams.get('location');
  if (!location || location.length > 100) {
    return Response.json({ error: '缺少或无效的location参数' }, { status: 400 });
  }

  return fetchWeatherApi(env, '/geo/v2/city/lookup', { location }, '城市搜索');
}

async function weatherHandler(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return Response.json({ error: '方法不支持' }, { status: 405 });
  }

  const latStr = url.searchParams.get('lat');
  const lonStr = url.searchParams.get('lon');
  if (!latStr || !lonStr) {
    return Response.json({ error: '缺少必要参数' }, { status: 400 });
  }

  const lat = Number(latStr);
  const lon = Number(lonStr);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return Response.json({ error: '无效的经纬度参数' }, { status: 400 });
  }

  return fetchWeatherApi(env, '/v7/weather/now', { location: `${lon},${lat}` }, '天气数据');
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
