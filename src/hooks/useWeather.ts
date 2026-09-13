import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import 'qweather-icons/font/qweather-icons.css';
import { getServices } from '../services/serviceContainer';
import DataRepository from '../services/DataRepository';
import { useWeatherLunar } from './useWeatherLunar';
import { useWeatherLocation } from './useWeatherLocation';
import { translateApiError } from '../utils/apiErrorUtils';
import type { NormalizedLocation, NormalizedWeather, WeatherIconCode } from '../../shared/weather';
import createLogger from '../utils/logger';

const logger = createLogger('useWeather');

const WEATHER_CACHE_EXPIRY = 60 * 60 * 1000; // 1小时缓存

/** 归一化图标码 → qweather-icons 字体类名（前端不再感知任何单一供应商的图标编号） */
const WEATHER_ICON_CLASS_MAP: Record<WeatherIconCode, string> = {
  SUNNY: 'qi-sunny',
  SUNNY_NIGHT: 'qi-clear-night',
  PARTLY_CLOUDY: 'qi-few-clouds',
  PARTLY_CLOUDY_NIGHT: 'qi-few-clouds-night',
  CLOUDY: 'qi-cloudy',
  CLOUDY_NIGHT: 'qi-cloudy-night',
  OVERCAST: 'qi-overcast',
  SHOWER: 'qi-shower-rain',
  THUNDERSTORM: 'qi-thundershower',
  DRIZZLE: 'qi-drizzle-rain',
  LIGHT_RAIN: 'qi-light-rain',
  RAIN: 'qi-moderate-rain',
  HEAVY_RAIN: 'qi-heavy-rain',
  RAINSTORM: 'qi-extreme-rain',
  FREEZING_RAIN: 'qi-freezing-rain',
  LIGHT_SNOW: 'qi-light-snow',
  SNOW: 'qi-moderate-snow',
  HEAVY_SNOW: 'qi-heavy-snow',
  SNOWSTORM: 'qi-snowstorm',
  SLEET: 'qi-sleet',
  RAIN_SNOW: 'qi-rain-and-snow',
  MIST: 'qi-mist',
  FOG: 'qi-foggy',
  HAZE: 'qi-haze',
  SAND: 'qi-sand',
  DUST: 'qi-dust',
  DUSTSTORM: 'qi-duststorm',
  HOT: 'qi-hot',
  COLD: 'qi-cold',
  UNKNOWN: 'qi-unknown',
};

function getWeatherIconClass(icon: WeatherIconCode): string {
  return WEATHER_ICON_CLASS_MAP[icon] ?? WEATHER_ICON_CLASS_MAP.UNKNOWN;
}

/** 归一化地点 → "上级行政区 - 地点名" 展示文本 */
function formatCityName(location: NormalizedLocation): string {
  const { admin, name } = location;
  return `${admin || ''}${admin && name ? ' - ' : ''}${name || ''}`;
}

export interface WeatherData {
  temperature: number;
  weather: string;
  icon: string;
  city: string;
  humidity: number;
}

interface WeatherCacheEntry {
  weatherData: WeatherData;
  timestamp: number;
}

/** /api/geo 响应（成功时为 locations，失败时为 error 错误码） */
interface GeoResponse {
  locations?: NormalizedLocation[];
  error?: unknown;
}

export function useWeather() {
  const { t, i18n } = useTranslation('weather');
  // 直接传应用语言（如 zh-CN / en-US），由后端供应商适配器决定映射为哪种上游语言
  const appLang = i18n.language;
  const { configService } = getServices();
  const weatherApiAvailable = configService.isWeatherApiAvailable();

  const [weather, setWeather] = useState<WeatherData | null>(null);
  // 未配置天气API时，直接跳过所有 loading/定位/API 调用
  const [weatherLoading, setWeatherLoading] = useState<boolean>(weatherApiAvailable);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);

  const fetchCityName = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const { authService } = getServices();
      const geoUrl = `/api/geo?location=${longitude},${latitude}&lang=${encodeURIComponent(appLang)}`;
      const response = await fetch(geoUrl, {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      const data = await response.json() as GeoResponse;
      if (!response.ok) {
        throw new Error(translateApiError(
          data?.error,
          t('errors.citySearchRequestFailed', { status: response.status, statusText: response.statusText }),
        ));
      }
      if (data.locations && data.locations.length > 0) {
        return formatCityName(data.locations[0]);
      }
      throw new Error(t('errors.cityNotFound'));
    } catch (error) {
      logger.error('Failed to get city name', error);
      return null;
    }
  }, [t, appLang]);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number) => {
    const { configService } = getServices();

    if (!configService.isWeatherApiAvailable()) {
      setWeatherError(t('errors.apiNotConfigured'));
      setWeatherLoading(false);
      setCityName(t('location.unknownCity'));
      return;
    }

    try {
      const { authService } = getServices();
      const lat = latitude.toFixed(2);
      const lon = longitude.toFixed(2);
      // 缓存键包含供应商与语言：天气现象、城市名与图标均随二者变化，换任一项后必须重新获取
      const cacheKey = `weather_${configService.getWeatherProviderId()}_${appLang}_${lat}_${lon}`;
      const cachedData = DataRepository.loadCache<WeatherCacheEntry>(cacheKey);

      if (cachedData) {
        const now = Date.now();
        const cacheTime = cachedData.timestamp;
        const cacheExpiry = WEATHER_CACHE_EXPIRY;

        if (now - cacheTime < cacheExpiry) {
          setWeather(cachedData.weatherData);
          setCityName(cachedData.weatherData.city);
          setWeatherLoading(false);
          return;
        }
      }

      setWeatherLoading(true);
      setWeatherError(null);

      const city = await fetchCityName(latitude, longitude);
      const displayCity = city ?? t('location.unknownCity');
      setCityName(displayCity);

      const url = `/api/weather?lat=${latitude}&lon=${longitude}&lang=${encodeURIComponent(appLang)}`;
      const response = await fetch(url, {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      const data = await response.json() as (NormalizedWeather & { error?: unknown });
      if (!response.ok) {
        throw new Error(translateApiError(
          data?.error,
          t('errors.weatherRequestFailed', { status: response.status, statusText: response.statusText }),
        ));
      }
      const weatherData: WeatherData = {
        temperature: data.temperature,
        weather: data.weatherText,
        icon: getWeatherIconClass(data.icon),
        city: displayCity,
        humidity: data.humidity,
      };
      setWeather(weatherData);

      // 仅在城市名获取成功时缓存，避免占位符"未知城市"被缓存 1 小时
      if (city !== null) {
        DataRepository.saveCache<WeatherCacheEntry>(cacheKey, {
          weatherData,
          timestamp: Date.now()
        });
      }
      setWeatherLoading(false);
    } catch (error) {
      setWeatherError(t('errors.fetchWeatherFailed', { detail: error instanceof Error ? error.message : String(error) }));
      setWeatherLoading(false);
    }
  }, [fetchCityName, t, appLang]);

  const { locationMethod, locationDetail } = useWeatherLocation({
    fetchWeatherData,
    enabled: weatherApiAvailable,
  });

  const {
    showLunar,
    lunarInfo,
    currentDate,
    handleDateClick,
  } = useWeatherLunar();

  return {
    weather,
    weatherLoading,
    weatherError,
    cityName,
    locationMethod,
    locationDetail,
    showLunar,
    lunarInfo,
    currentDate,
    handleDateClick,
    weatherApiAvailable,
  };
}
