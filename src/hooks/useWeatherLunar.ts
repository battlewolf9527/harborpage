import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import lunisolar from 'lunisolar';
import localeEn from 'lunisolar/locale/en';

// 注册英文语言包，第二个参数为 true 时只注册、不切换当前语言（默认内置 zh）。
// 内置英文包的农历月名形如 "8st month"，英文下改用纯数字月。
// 这里覆盖月名而不是改用数字占位符 lMn：lM 会还原闰月的 +100 偏移，lMn 不会。
lunisolar.locale(
  { ...localeEn, lunarMonths: Array.from({ length: 12 }, (_, i) => String(i + 1)) },
  true
);

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** 农历文案随界面语言切换；格式串中的 [...] 为 lunisolar 的字面量转义，避免字母被当作格式占位符 */
function formatLunar(language: string, format: string): string {
  lunisolar.config({ lang: language.startsWith('en') ? 'en' : 'zh' });
  return lunisolar(new Date()).format(format);
}

export function useWeatherLunar() {
  const { t, i18n } = useTranslation('weather');
  const [showLunar, setShowLunar] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

  const handleDateClick = useCallback(() => {
    setShowLunar(prev => !prev);
  }, []);

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

  // 直接派生而非存 state：语言变化时农历文案随之更新
  const lunarInfo = showLunar ? formatLunar(i18n.language, t('date.lunarFormat')) : '';

  return {
    showLunar,
    lunarInfo,
    currentDate,
    handleDateClick,
  };
}
