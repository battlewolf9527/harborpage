/**
 * 前后端共享的天气归一化模型
 *
 * 各天气供应商（和风天气、Open-Meteo …）的响应结构差异全部收敛在后端适配器中，
 * API 路由与前端只消费下面这套与供应商无关的契约，从而可以无缝切换 / 扩展供应商。
 */

/** 已支持的天气供应商标识，对应 WEATHER_PROVIDER 环境变量取值 */
export const WEATHER_PROVIDER_IDS = ['qweather', 'openmeteo'] as const;

export type WeatherProviderId = typeof WEATHER_PROVIDER_IDS[number];

/**
 * 归一化天气图标码
 *
 * 供应商各自的图标编号（如和风的 100 / 305）由适配器映射到这里，
 * 前端再统一映射到图标字体，避免与任何单一供应商绑定。
 */
export const WEATHER_ICON_CODES = [
  'SUNNY', 'SUNNY_NIGHT',
  'PARTLY_CLOUDY', 'PARTLY_CLOUDY_NIGHT',
  'CLOUDY', 'CLOUDY_NIGHT',
  'OVERCAST',
  'SHOWER', 'THUNDERSTORM', 'DRIZZLE',
  'LIGHT_RAIN', 'RAIN', 'HEAVY_RAIN', 'RAINSTORM', 'FREEZING_RAIN',
  'LIGHT_SNOW', 'SNOW', 'HEAVY_SNOW', 'SNOWSTORM', 'SLEET', 'RAIN_SNOW',
  'MIST', 'FOG', 'HAZE', 'SAND', 'DUST', 'DUSTSTORM',
  'HOT', 'COLD', 'UNKNOWN',
] as const;

export type WeatherIconCode = typeof WEATHER_ICON_CODES[number];

/** 实时天气（归一化） */
export interface NormalizedWeather {
  provider: WeatherProviderId;
  /** 摄氏度 */
  temperature: number;
  /** 已按请求语言本地化的天气现象描述 */
  weatherText: string;
  /** 相对湿度（百分比） */
  humidity: number;
  icon: WeatherIconCode;
}

/** 城市 / 地点（归一化） */
export interface NormalizedLocation {
  /** 地点名 */
  name: string;
  /** 上级行政区（省 / 市），可能为空 */
  admin: string;
  /** 国家 */
  country: string;
  lat: number;
  lon: number;
}
