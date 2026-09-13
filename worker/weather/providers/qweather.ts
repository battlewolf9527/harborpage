import type { Env } from '../../types';
import type { WeatherProvider } from '../types';
import type { WeatherIconCode } from '../../../shared/weather';

/** 和风天气图标编号 → 归一化图标码 */
const QWEATHER_ICON_MAP: Record<string, WeatherIconCode> = {
  '100': 'SUNNY', '101': 'CLOUDY', '102': 'PARTLY_CLOUDY', '103': 'PARTLY_CLOUDY', '104': 'OVERCAST',
  '150': 'SUNNY_NIGHT', '151': 'CLOUDY_NIGHT', '152': 'PARTLY_CLOUDY_NIGHT', '153': 'PARTLY_CLOUDY_NIGHT',
  '300': 'SHOWER', '301': 'SHOWER', '302': 'THUNDERSTORM', '303': 'THUNDERSTORM', '304': 'THUNDERSTORM',
  '305': 'LIGHT_RAIN', '306': 'RAIN', '307': 'HEAVY_RAIN', '308': 'RAINSTORM', '309': 'DRIZZLE',
  '310': 'RAINSTORM', '311': 'RAINSTORM', '312': 'RAINSTORM', '313': 'FREEZING_RAIN',
  '314': 'LIGHT_RAIN', '315': 'RAIN', '316': 'HEAVY_RAIN', '317': 'RAINSTORM', '318': 'RAINSTORM',
  '350': 'SHOWER', '351': 'SHOWER', '399': 'RAIN',
  '400': 'LIGHT_SNOW', '401': 'SNOW', '402': 'HEAVY_SNOW', '403': 'SNOWSTORM', '404': 'SLEET', '405': 'RAIN_SNOW',
  '406': 'SLEET', '407': 'LIGHT_SNOW', '408': 'LIGHT_SNOW', '409': 'SNOW', '410': 'HEAVY_SNOW',
  '456': 'SLEET', '457': 'LIGHT_SNOW', '499': 'SNOW',
  '500': 'MIST', '501': 'FOG', '502': 'HAZE', '503': 'SAND', '504': 'DUST', '507': 'DUSTSTORM', '508': 'DUSTSTORM',
  '509': 'FOG', '510': 'FOG', '511': 'HAZE', '512': 'HAZE', '513': 'HAZE', '514': 'FOG', '515': 'FOG',
  '900': 'HOT', '901': 'COLD', '999': 'UNKNOWN',
};

interface QWeatherGeoResponse {
  code?: string;
  location?: Array<{
    name?: string;
    adm2?: string;
    country?: string;
    lat?: string;
    lon?: string;
  }>;
}

interface QWeatherNowResponse {
  code?: string;
  now?: {
    temp?: string;
    text?: string;
    icon?: string;
    humidity?: string;
  };
}

function getConfig(env: Env): { apiKey: string; apiHost: string } | null {
  const apiKey = env.WEATHER_API_KEY;
  const apiHost = env.WEATHER_API_HOST;
  if (!apiKey || !apiHost) {
    return null;
  }
  return { apiKey, apiHost };
}

/** 调用和风接口并解析 JSON，任何失败（未配置 / 网络错误 / 非 2xx）均返回 null */
async function requestJson<T>(env: Env, path: string, params: Record<string, string>): Promise<T | null> {
  const config = getConfig(env);
  if (!config) {
    return null;
  }

  const queryString = Object.entries({ ...params, key: config.apiKey })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  try {
    const response = await fetch(`https://${config.apiHost}${path}?${queryString}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const qweatherProvider: WeatherProvider = {
  id: 'qweather',

  isConfigured(env) {
    return getConfig(env) !== null;
  },

  // 和风仅区分中英文，其余语言回退中文
  toProviderLang(appLang) {
    return appLang.toLowerCase().startsWith('en') ? 'en' : 'zh';
  },

  async lookupCity(query, providerLang, env) {
    const data = await requestJson<QWeatherGeoResponse>(env, '/geo/v2/city/lookup', {
      location: query,
      lang: providerLang,
    });
    if (!data || data.code !== '200' || !Array.isArray(data.location)) {
      return null;
    }
    return data.location.map((item) => ({
      name: item.name ?? '',
      admin: item.adm2 ?? '',
      country: item.country ?? '',
      lat: Number(item.lat) || 0,
      lon: Number(item.lon) || 0,
    }));
  },

  async getCurrentWeather(lat, lon, providerLang, env) {
    const data = await requestJson<QWeatherNowResponse>(env, '/v7/weather/now', {
      location: `${lon},${lat}`,
      lang: providerLang,
    });
    if (!data || data.code !== '200' || !data.now) {
      return null;
    }
    const now = data.now;
    return {
      provider: 'qweather',
      temperature: Number(now.temp) || 0,
      weatherText: now.text ?? '',
      humidity: Number(now.humidity) || 0,
      icon: QWEATHER_ICON_MAP[now.icon ?? ''] ?? 'UNKNOWN',
    };
  },
};
