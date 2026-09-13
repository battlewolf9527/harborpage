import type { Env } from '../types';
import type { WeatherProvider } from './types';
import { qweatherProvider } from './providers/qweather';
import { openMeteoProvider } from './providers/openmeteo';

/** 已注册的天气供应商适配器（新增供应商在此追加即可） */
const PROVIDERS: readonly WeatherProvider[] = [qweatherProvider, openMeteoProvider];

/**
 * 解析当前生效的供应商。
 *
 * WEATHER_PROVIDER 是启用天气功能的唯一开关：
 * - 未设置（或为空）时不启用天气；
 * - 设置了则使用对应且已配置的供应商，未知 / 未配置一律视为不可用。
 */
export function getWeatherProvider(env: Env): WeatherProvider | null {
  const requested = env.WEATHER_PROVIDER?.trim().toLowerCase();
  if (!requested) {
    return null;
  }
  const provider = PROVIDERS.find((item) => item.id === requested);
  return provider && provider.isConfigured(env) ? provider : null;
}
