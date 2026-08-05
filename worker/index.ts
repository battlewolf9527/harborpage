import type { Env } from './types';
import { handleAuthRoutes } from './routes/auth';
import { handleDataRoutes } from './routes/data';
import { handleIconRoutes } from './routes/icon';
import { handleIconUpload } from './routes/icon-upload';
import { handleWeatherRoutes } from './routes/weather';
import { handleWallpaperRoutes } from './routes/wallpaper';
import { handleWallpaperUpload } from './routes/wallpaper-upload';
import { handleBingRoutes } from './routes/bing';
import { handleTitleRoutes } from './routes/title';

// 统一错误处理中间件
function withErrorHandler(
  handler: (request: Request, url: URL, env: Env) => Promise<Response | null>
): (request: Request, url: URL, env: Env) => Promise<Response | null> {
  return async (request: Request, url: URL, env: Env): Promise<Response | null> => {
    try {
      return await handler(request, url, env);
    } catch (error) {
      console.error(`[ERROR] ${request.method} ${url.pathname}:`, error);
      return Response.json(
        { error: `服务器内部错误: ${error instanceof Error ? error.message : String(error)}` },
        { status: 500 }
      );
    }
  };
}

// 模块初始化时一次性包装所有 handler，避免每次请求都创建包装函数
const handlers = [
  handleIconUpload,
  handleWallpaperUpload,
  handleAuthRoutes,
  handleDataRoutes,
  handleIconRoutes,
  handleWeatherRoutes,
  handleBingRoutes,
  handleWallpaperRoutes,
  handleTitleRoutes,
].map(withErrorHandler);

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 路由分发：按顺序尝试各路由处理器，返回第一个匹配的响应
    // 图标上传路由放在最前面，因为 /api/icon/upload 以 /api/icon 开头
    // 顺序：icon-upload → auth → data → icon → weather → bing → wallpaper
    for (const handler of handlers) {
      const response = await handler(request, url, env);
      if (response !== null) {
        return response;
      }
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
