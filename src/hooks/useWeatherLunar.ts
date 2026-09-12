import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import lunisolar from 'lunisolar';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function useWeatherLunar() {
  const { t } = useTranslation('weather');
  const [showLunar, setShowLunar] = useState(false);
  const [lunarInfo, setLunarInfo] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const handleDateClick = useCallback(() => {
    if (!showLunar) {
      // 即将显示农历，提前计算
      const now = new Date();
      const lunarDate = lunisolar(now);
      setLunarInfo(lunarDate.format('cY cZ年 lMlD T'));
    }
    setShowLunar(prev => !prev);
  }, [showLunar]);

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const date = now.getDate();
      const day = t(`date.weekdays.${WEEKDAY_KEYS[now.getDay()]}`);
      setCurrentDate(t('date.current', { month, date, day }));
    };

    updateDate();
    const interval = setInterval(updateDate, 60000);
    return () => clearInterval(interval);
  }, [t]);

  return {
    showLunar,
    lunarInfo,
    currentDate,
    handleDateClick,
  };
}