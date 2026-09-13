// Worker 环境变量与绑定类型
export interface Env {
  USER_DATA: KVNamespace;
  /** 天气供应商 + 天气功能开关（如 qweather / openmeteo）；不填写则不启用天气功能 */
  WEATHER_PROVIDER?: string;
  WEATHER_API_KEY: string;
  WEATHER_API_HOST: string;
  PASSWORD: string;
  JWT_SECRET: string;
  BUCKET: R2Bucket;
  R2_URL?: string;
  ENABLE_R2_CDN?: string;
}
