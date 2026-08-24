import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_LOCATION = { lat: 39.9042, lon: 116.4074 };

interface UseWeatherLocationParams {
  fetchWeatherData: (lat: number, lon: number) => Promise<void>;
  enabled?: boolean;
}

export function useWeatherLocation({ fetchWeatherData, enabled = true }: UseWeatherLocationParams) {
  const [locationMethod, setLocationMethod] = useState(enabled ? '定位中...' : '');

  const fetchWeatherDataRef = useRef(fetchWeatherData);
  useEffect(() => {
    fetchWeatherDataRef.current = fetchWeatherData;
  });

  const getIPLocation = useCallback(async () => {
    if (!enabled) return;
    setLocationMethod('IP定位');
    try {
      const ipInfoResponse = await fetch('https://ipinfo.io/json');
      if (!ipInfoResponse.ok) {
        throw new Error('IP定位API请求失败');
      }
      const ipInfoData = await ipInfoResponse.json();

      if (ipInfoData.loc) {
        const [lat, lon] = ipInfoData.loc.split(',').map(Number);
        await fetchWeatherDataRef.current(lat, lon);
      } else {
        await fetchWeatherDataRef.current(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      }
    } catch (error) {
      console.warn('IP定位失败，使用默认位置:', error);
      await fetchWeatherDataRef.current(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
  }, [enabled]);

  const initLocation = useCallback(() => {
    if (!enabled) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationMethod('浏览器定位');
          fetchWeatherDataRef.current(latitude, longitude);
        },
        () => {
          getIPLocation();
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    } else {
      getIPLocation();
    }
  }, [getIPLocation, enabled]);

  useEffect(() => {
    initLocation();
  }, [initLocation]);

  return { locationMethod };
}
