import type { Env } from '../../types';
import type { WeatherProvider } from '../types';
import type { WeatherIconCode } from '../../../shared/weather';

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';

/**
 * WMO 天气现象码 → 归一化图标码（白天）
 *
 * Open-Meteo 不返回图标编号，只返回 WMO 4677 天气现象码；
 * 夜间图标由 is_day 走 WMO_NIGHT_ICON_MAP 覆盖。
 */
const WMO_ICON_MAP: Record<number, WeatherIconCode> = {
  0: 'SUNNY',
  1: 'PARTLY_CLOUDY',
  2: 'CLOUDY',
  3: 'OVERCAST',
  45: 'FOG',
  48: 'FOG',
  51: 'DRIZZLE',
  53: 'DRIZZLE',
  55: 'DRIZZLE',
  56: 'FREEZING_RAIN',
  57: 'FREEZING_RAIN',
  61: 'LIGHT_RAIN',
  63: 'RAIN',
  65: 'HEAVY_RAIN',
  66: 'FREEZING_RAIN',
  67: 'FREEZING_RAIN',
  71: 'LIGHT_SNOW',
  73: 'SNOW',
  75: 'HEAVY_SNOW',
  77: 'LIGHT_SNOW',
  80: 'SHOWER',
  81: 'SHOWER',
  82: 'RAINSTORM',
  85: 'LIGHT_SNOW',
  86: 'HEAVY_SNOW',
  95: 'THUNDERSTORM',
  96: 'THUNDERSTORM',
  99: 'THUNDERSTORM',
};

/** 仅晴朗 / 云量类现象区分昼夜，其余现象（雨雪雾等）图标本身即含夜间语义 */
const WMO_NIGHT_ICON_MAP: Record<number, WeatherIconCode> = {
  0: 'SUNNY_NIGHT',
  1: 'PARTLY_CLOUDY_NIGHT',
  2: 'CLOUDY_NIGHT',
};

/** WMO 天气现象码 → 本地化描述（Open-Meteo 只返回码值，展示文本由适配器生成） */
const WMO_TEXT_MAP: Record<number, { zh: string; en: string }> = {
  0: { zh: '晴', en: 'Clear sky' },
  1: { zh: '晴间多云', en: 'Mainly clear' },
  2: { zh: '多云', en: 'Partly cloudy' },
  3: { zh: '阴', en: 'Overcast' },
  45: { zh: '雾', en: 'Fog' },
  48: { zh: '雾凇', en: 'Depositing rime fog' },
  51: { zh: '毛毛雨', en: 'Light drizzle' },
  53: { zh: '毛毛雨', en: 'Moderate drizzle' },
  55: { zh: '毛毛雨', en: 'Dense drizzle' },
  56: { zh: '冻毛毛雨', en: 'Light freezing drizzle' },
  57: { zh: '冻毛毛雨', en: 'Dense freezing drizzle' },
  61: { zh: '小雨', en: 'Slight rain' },
  63: { zh: '中雨', en: 'Moderate rain' },
  65: { zh: '大雨', en: 'Heavy rain' },
  66: { zh: '冻雨', en: 'Light freezing rain' },
  67: { zh: '冻雨', en: 'Heavy freezing rain' },
  71: { zh: '小雪', en: 'Slight snow' },
  73: { zh: '中雪', en: 'Moderate snow' },
  75: { zh: '大雪', en: 'Heavy snow' },
  77: { zh: '雪粒', en: 'Snow grains' },
  80: { zh: '阵雨', en: 'Slight rain showers' },
  81: { zh: '阵雨', en: 'Moderate rain showers' },
  82: { zh: '暴阵雨', en: 'Violent rain showers' },
  85: { zh: '阵雪', en: 'Slight snow showers' },
  86: { zh: '阵雪', en: 'Heavy snow showers' },
  95: { zh: '雷暴', en: 'Thunderstorm' },
  96: { zh: '雷暴伴小冰雹', en: 'Thunderstorm with slight hail' },
  99: { zh: '雷暴伴大冰雹', en: 'Thunderstorm with heavy hail' },
};

/** 形如 "经度,纬度" 的坐标查询（前端按 "lon,lat" 调用 /api/geo） */
const COORDINATE_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

interface OpenMeteoGeocodingResponse {
  results?: Array<{
    name?: string;
    admin1?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

/** 调用 Open-Meteo 接口并解析 JSON，任何失败（网络错误 / 非 2xx）均返回 null */
async function requestJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
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

export const openMeteoProvider: WeatherProvider = {
  id: 'openmeteo',

  // Open-Meteo 免费额度无需密钥，配置始终齐全
  isConfigured(_env: Env) {
    return true;
  },

  // Open-Meteo 语言参数为小写语言代码；天气描述目前只覆盖中英文，其余语言回退英文
  toProviderLang(appLang) {
    return appLang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  },

  async lookupCity(query, providerLang, _env) {
    // Open-Meteo 官方 Geocoding 仅支持「名称 → 坐标」前向搜索，不具备坐标反查能力。
    // 前端目前以坐标调用本接口，此时返回空数组，由前端回退展示「未知城市」，不影响天气数据。
    if (COORDINATE_PATTERN.test(query.trim())) {
      return [];
    }

    const params = new URLSearchParams({
      name: query,
      count: '10',
      language: providerLang,
      format: 'json',
    });
    const data = await requestJson<OpenMeteoGeocodingResponse>(`${GEOCODING_API}?${params}`);
    if (!data || !Array.isArray(data.results)) {
      return null;
    }
    return data.results.map((item) => ({
      name: item.name ?? '',
      admin: item.admin1 ?? '',
      country: item.country ?? '',
      lat: item.latitude ?? 0,
      lon: item.longitude ?? 0,
    }));
  },

  async getCurrentWeather(lat, lon, providerLang, _env) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,weather_code,is_day',
    });
    const data = await requestJson<OpenMeteoForecastResponse>(`${FORECAST_API}?${params}`);
    const current = data?.current;
    if (!current) {
      return null;
    }

    const code = Number(current.weather_code);
    const text = WMO_TEXT_MAP[code];
    const dayIcon = WMO_ICON_MAP[code] ?? 'UNKNOWN';
    const icon = Number(current.is_day) === 0 ? (WMO_NIGHT_ICON_MAP[code] ?? dayIcon) : dayIcon;

    return {
      provider: 'openmeteo',
      temperature: Number(current.temperature_2m) || 0,
      weatherText: text ? (providerLang === 'zh' ? text.zh : text.en) : '',
      humidity: Number(current.relative_humidity_2m) || 0,
      icon,
    };
  },
};
