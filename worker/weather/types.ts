import type { Env } from '../types';
import type { NormalizedLocation, NormalizedWeather, WeatherProviderId } from '../../shared/weather';

/**
 * 天气供应商适配器
 *
 * 新增供应商只需实现本接口并在 registry 中注册，路由与前端无需改动。
 * 约定：上游失败 / 未配置时返回 null，由路由层统一转换为错误码响应。
 */
export interface WeatherProvider {
  id: WeatherProviderId;
  /** 密钥 / Host 等配置是否齐全 */
  isConfigured(env: Env): boolean;
  /** 应用语言（如 zh-CN / en-US）→ 供应商支持的语言参数 */
  toProviderLang(appLang: string): string;
  /** 城市搜索 / 坐标反查；无匹配时返回空数组 */
  lookupCity(query: string, providerLang: string, env: Env): Promise<NormalizedLocation[] | null>;
  /** 实时天气 */
  getCurrentWeather(lat: number, lon: number, providerLang: string, env: Env): Promise<NormalizedWeather | null>;
}
