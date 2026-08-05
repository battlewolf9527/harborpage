import { useState, useEffect, useCallback } from 'react';
import lunisolar from 'lunisolar';

export function useWeatherLunar() {
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
      const day = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
      setCurrentDate(`${month}月${date}日 ${day}`);
    };

    updateDate();
    const interval = setInterval(updateDate, 60000);
    return () => clearInterval(interval);
  }, []);

  return {
    showLunar,
    lunarInfo,
    currentDate,
    handleDateClick,
  };
}