import React, { useEffect, useRef, useState, memo } from 'react';
import './Weather.css';
import { useWeather } from '../../hooks/useWeather';

const Clock = memo(() => {
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const update = () => {
      const now = new Date();
      if (timeRef.current) {
        timeRef.current.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="time-text" ref={timeRef} />;
});

const Weather: React.FC = () => {
  const {
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
  } = useWeather();

  // 点击城市定位信息时，将附加信息（IP/经纬度）复制到剪贴板
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyLocationDetail = async () => {
    if (!locationDetail || copied) return;
    try {
      await navigator.clipboard.writeText(locationDetail);
    } catch (error) {
      // 剪贴板 API 不可用时（非安全上下文等）静默失败
      console.warn('复制定位信息失败:', error);
      return;
    }
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`weather-info${weatherApiAvailable ? '' : ' weather-info--compact'}`}>
      <div className="weather-header">
        <div
          className="date"
          onClick={handleDateClick}
          style={{ cursor: 'pointer' }}
        >
          {showLunar ? lunarInfo : currentDate}
        </div>
        {weatherApiAvailable && (
          <div
            className={`city${locationDetail ? ' city--clickable' : ''}`}
            title={locationDetail ? `${locationMethod}：${locationDetail}` : locationMethod}
            onClick={locationDetail ? copyLocationDetail : undefined}
          >
            {copied ? '已复制' : cityName || '定位中...'}
          </div>
        )}
      </div>

      <div className="time-weather-row">
        <div className="time">
          <Clock />
        </div>

        {weatherApiAvailable && (weatherLoading ? (
          <div className="weather-content">
            <i className="weather-icon qi-999"></i>
            <div className="weather-details">
              <span className="temperature">加载中...</span>
              <span className="weather-desc">请稍候</span>
            </div>
          </div>
        ) : weatherError ? (
          <div className="weather-content" title={weatherError}>
            <i className="weather-icon qi-999"></i>
            <div className="weather-details">
              <span className="temperature">天气</span>
              <span className="weather-desc">不可用</span>
            </div>
          </div>
        ) : weather ? (
          <div className="weather-content">
            <div className="weather-section">
              <i className={`weather-icon ${weather.icon}`}></i>
              <span className="weather-desc">{weather.weather}</span>
            </div>
            <div className="temperature-section">
              <span className="temperature">{weather.temperature}°</span>
            </div>
          </div>
        ) : (
          <div className="weather-content">
            <i className="weather-icon qi-999"></i>
            <div className="weather-details">
              <span className="temperature">未知</span>
              <span className="weather-desc">无法获取天气</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Weather;
