import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import 'qweather-icons/font/qweather-icons.css';
import { getServices } from '../services/serviceContainer';
import DataRepository from '../services/DataRepository';
import { useWeatherLunar } from './useWeatherLunar';
import { useWeatherLocation } from './useWeatherLocation';
import createLogger from '../utils/logger';

const logger = createLogger('useWeather');

const WEATHER_CACHE_EXPIRY = 60 * 60 * 1000; // 1小时缓存

/** 和风天气只区分中英两种返回语言 */
function toWeatherLang(language: string): 'zh' | 'en' {
  return language.startsWith('en') ? 'en' : 'zh';
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

export function useWeather() {
  const { t, i18n } = useTranslation('weather');
  const lang = toWeatherLang(i18n.language);
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
      const geoUrl = `/api/geo?location=${longitude},${latitude}&lang=${lang}`;
      const response = await fetch(geoUrl, {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (!response.ok) {
        throw new Error(t('errors.citySearchRequestFailed', { status: response.status, statusText: response.statusText }));
      }
      const data = await response.json();
      if (data.code === '200' && data.location && data.location.length > 0) {
        const location = data.location[0];
        const cityName = `${location.adm2 || ''}${location.adm2 && location.name ? ' - ' : ''}${location.name || ''}`;
        return cityName;
      } else {
        throw new Error(t('errors.citySearchCodeFailed', { code: data.code }));
      }
    } catch (error) {
      logger.error('Failed to get city name', error);
      return null;
    }
  }, [t, lang]);

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
      // 缓存键包含语言：天气现象与城市名由 API 按语言返回，换语言后必须重新获取
      const cacheKey = `weather_${lang}_${lat}_${lon}`;
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

      const url = `/api/weather?lat=${latitude}&lon=${longitude}&lang=${lang}`;
      const response = await fetch(url, {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (!response.ok) {
        throw new Error(t('errors.weatherRequestFailed', { status: response.status, statusText: response.statusText }));
      }
      const data = await response.json();
      if (data.code === '200') {
        const weatherData: WeatherData = {
          temperature: parseInt(data.now.temp, 10) || 0,
          weather: data.now.text,
          icon: getWeatherIcon(data.now.icon),
          city: displayCity,
          humidity: parseInt(data.now.humidity, 10) || 0,
        };
        setWeather(weatherData);

        // 仅在城市名获取成功时缓存，避免占位符"未知城市"被缓存 1 小时
        if (city !== null) {
          DataRepository.saveCache<WeatherCacheEntry>(cacheKey, {
            weatherData,
            timestamp: Date.now()
          });
        }
      } else {
        throw new Error(`Weather API error: ${data.code}`);
      }
      setWeatherLoading(false);
    } catch (error) {
      setWeatherError(t('errors.fetchWeatherFailed', { detail: error instanceof Error ? error.message : String(error) }));
      setWeatherLoading(false);
    }
  }, [fetchCityName, t, lang]);

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

function getWeatherIcon(iconCode: string): string {
  return `qi-${iconCode}`;
}