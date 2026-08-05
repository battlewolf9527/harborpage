import { useState, useCallback } from 'react';
import 'qweather-icons/font/qweather-icons.css';
import { getServices } from '../services/serviceContainer';
import DataRepository from '../services/DataRepository';
import { useWeatherLunar } from './useWeatherLunar';
import { useWeatherLocation } from './useWeatherLocation';
import createLogger from '../utils/logger';

const logger = createLogger('useWeather');

const WEATHER_CACHE_EXPIRY = 60 * 60 * 1000; // 1小时缓存

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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);

  const fetchCityName = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const { authService } = getServices();
      const geoUrl = `/api/geo?location=${longitude},${latitude}`;
      const response = await fetch(geoUrl, {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (!response.ok) {
        throw new Error(`城市搜索API请求失败: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data.code === '200' && data.location && data.location.length > 0) {
        const location = data.location[0];
        const cityName = `${location.adm2 || ''}${location.adm2 && location.name ? ' - ' : ''}${location.name || ''}`;
        return cityName;
      } else {
        throw new Error(`城市搜索API错误: ${data.code}`);
      }
    } catch (error) {
      logger.error('获取城市名称失败', error);
      return null;
    }
  }, []);

  const fetchWeatherData = useCallback(async (latitude: number, longitude: number) => {
    try {
      const { authService } = getServices();
      const lat = latitude.toFixed(2);
      const lon = longitude.toFixed(2);
      const cacheKey = `weather_${lat}_${lon}`;
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
      const displayCity = city ?? '未知城市';
      setCityName(displayCity);

      const url = `/api/weather?lat=${latitude}&lon=${longitude}`;
      const response = await fetch(url, {
        headers: authService.getAuthHeaders(),
      });
      DataRepository.handleAuthResponse(response);
      if (!response.ok) {
        throw new Error(`天气API请求失败: ${response.status} ${response.statusText}`);
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
      setWeatherError(`获取天气数据失败: ${error instanceof Error ? error.message : String(error)}`);
      setWeatherLoading(false);
    }
  }, [fetchCityName]);

  const { locationMethod } = useWeatherLocation({
    fetchWeatherData,
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
    showLunar,
    lunarInfo,
    currentDate,
    handleDateClick,
  };
}

function getWeatherIcon(iconCode: string): string {
  return `qi-${iconCode}`;
}