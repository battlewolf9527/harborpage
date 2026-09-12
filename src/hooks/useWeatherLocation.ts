import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

const DEFAULT_LOCATION = { lat: 39.9042, lon: 116.4074 };

interface UseWeatherLocationParams {
  fetchWeatherData: (lat: number, lon: number) => Promise<void>;
  enabled?: boolean;
}

/** 将经纬度格式化为"东经 xx.xxxxxx，北纬 xx.xxxxxx"（西经/南纬时自动切换前缀） */
function formatCoords(latitude: number, longitude: number, t: TFunction<'weather'>): string {
  const lonDir = longitude >= 0 ? t('location.east') : t('location.west');
  const latDir = latitude >= 0 ? t('location.north') : t('location.south');
  const trim = (n: number) => String(+n.toFixed(6));
  return t('location.coords', { lonDir, lon: trim(longitude), latDir, lat: trim(latitude) });
}

export function useWeatherLocation({ fetchWeatherData, enabled = true }: UseWeatherLocationParams) {
  const { t } = useTranslation('weather');
  const [locationMethod, setLocationMethod] = useState(enabled ? t('location.locating') : '');
  const [locationDetail, setLocationDetail] = useState<string | null>(null);

  const fetchWeatherDataRef = useRef(fetchWeatherData);
  useEffect(() => {
    fetchWeatherDataRef.current = fetchWeatherData;
  });

  const getIPLocation = useCallback(async () => {
    if (!enabled) return;
    setLocationMethod(t('location.ip'));
    setLocationDetail(null);
    try {
      const ipInfoResponse = await fetch('https://ipinfo.io/json');
      if (!ipInfoResponse.ok) {
        throw new Error(t('errors.ipLocationRequestFailed'));
      }
      const ipInfoData = await ipInfoResponse.json();

      if (ipInfoData.ip) {
        setLocationDetail(String(ipInfoData.ip));
      }
      if (ipInfoData.loc) {
        const [lat, lon] = ipInfoData.loc.split(',').map(Number);
        await fetchWeatherDataRef.current(lat, lon);
      } else {
        await fetchWeatherDataRef.current(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
      }
    } catch (error) {
      console.warn(t('errors.ipLocationFallback'), error);
      await fetchWeatherDataRef.current(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lon);
    }
  }, [enabled, t]);

  const initLocation = useCallback(() => {
    if (!enabled) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocationMethod(t('location.browser'));
          setLocationDetail(formatCoords(latitude, longitude, t));
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
  }, [getIPLocation, enabled, t]);

  useEffect(() => {
    initLocation();
  }, [initLocation]);

  return { locationMethod, locationDetail };
}
