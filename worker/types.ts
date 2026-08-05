// Worker 环境变量与绑定类型
export interface Env {
  USER_DATA: KVNamespace;
  WEATHER_API_KEY: string;
  WEATHER_API_HOST: string;
  PASSWORD: string;
  JWT_SECRET: string;
  BUCKET: R2Bucket;
  R2_URL?: string;
  ENABLE_R2_CDN?: string;
}
