import { defineConfig, normalizePath, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 客户端静态资源根目录（wrangler.jsonc 的 assets.directory 指向此处）。
 * @cloudflare/vite-plugin 会把浏览器构建产物落到 dist/client/client，
 * 而不是根配置的 build.outDir（dist/client）。
 */
const CLIENT_ASSET_DIR = "dist/client/client";

/**
 * 解析构建对应的提交短 ID，供 About 弹窗展示当前部署版本。
 *
 * 优先取本机 git（即工作树当前提交）；无 .git 的环境（产物目录内构建、
 * 部分 CI 的浅克隆）回退到平台注入的环境变量；仍取不到则返回空串，
 * 由 UI 自行省略该段，不影响构建。
 */
function resolveBuildCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString().trim();
  } catch {
    const fromEnv =
      process.env.WORKERS_CI_COMMIT_SHA ??
      process.env.CF_PAGES_COMMIT_SHA ??
      process.env.GITHUB_SHA ??
      "";
    return fromEnv.slice(0, 7);
  }
}

/** 读取 package.json 的版本号（直接读文件，不依赖 npm 脚本注入的环境变量） */
function resolveAppVersion(): string {
  try {
    const raw = readFileSync(new URL("./package.json", import.meta.url), "utf8");
    return (JSON.parse(raw) as { version?: string }).version ?? "";
  } catch {
    return "";
  }
}

// 构建期常量：构建一次固定，随产物打进前端（类型声明见 AboutDialog.tsx）
const APP_VERSION = resolveAppVersion();
const BUILD_COMMIT = resolveBuildCommit();
const BUILD_TIME = new Date().toISOString();

/**
 * 从构建产物中移除 .dev.vars 文件。
 *
 * 【问题根因】
 * @cloudflare/vite-plugin 在 build 阶段只要检测到 wrangler 配置和本地
 * .dev.vars 存在，就会把 .dev.vars 作为 asset 写入每个 Worker 环境的输出
 * 目录（dist/client/harborpage/）。由于该目录嵌套在静态资产根（dist/client）
 * 内部，机密文件有泄露风险。
 *
 * 【plugin 1.50.0 的原生保护】
 * 升级到 1.50.0 后，plugin 会在 assets directory 根目录生成 .assetsignore
 * 文件，其中包含 ".dev.vars"，使 wrangler 部署时不上传该文件。但这仅保护
 * 部署路径，文件仍会被写入本地磁盘。
 *
 * 【本插件的额外防护（双层）】
 * 1) generateBundle：利用 hook 执行顺序，cloudflare() 插件先 emit .dev.vars，
 *    本插件随后从 bundle 对象中删除对应条目，使其永远不会被写入磁盘。
 * 2) closeBundle：扫描整个 dist/ 目录，递归删除任何遗留的 .dev.vars 文件
 *    （清理旧构建目录或第三方写入的残留）。
 *
 * 本地 wrangler dev 直接读取项目根目录的 .dev.vars，不依赖构建产物中的拷贝。
 */
function collectDevVarsFiles(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectDevVarsFiles(full));
    } else if (entry === ".dev.vars" || entry.endsWith(".dev.vars")) {
      found.push(full);
    }
  }
  return found;
}

function devVarsCleanup(): Plugin {
  let resolvedRoot: string | undefined;

  return {
    name: "dev-vars-cleanup",
    configResolved(config) {
      resolvedRoot = config.root;
    },
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith(".dev.vars") || fileName.includes(".dev.vars")) {
          this.warn(
            `[dev-vars-cleanup] 从 bundle 中移除机密文件: ${fileName} ` +
              `（.dev.vars 仅用于本地开发，不应出现在生产构建产物中）`,
          );
          delete bundle[fileName];
        }
      }
    },
    closeBundle() {
      if (!resolvedRoot) return;
      const distRoot = join(resolvedRoot, "dist");
      const leaked = collectDevVarsFiles(distRoot);
      for (const path of leaked) {
        try {
          rmSync(path);
          this.warn(
            `[dev-vars-cleanup] 删除 dist 下遗留的机密文件: ${path}`,
          );
        } catch (err) {
          this.error(
            `[dev-vars-cleanup] 删除泄露文件失败: ${path} - ` +
              `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },
  };
}

/**
 * 精简 qweather-icons 字体产物：仅保留 woff2。
 *
 * 【问题根因】
 * qweather-icons 的 CSS 在同一个 @font-face 中按优先级声明了三个 src：
 *   woff2 → woff → truetype(ttf)，总计约 326 kB。
 * 现代浏览器一律优先取 woff2（53.7 kB），woff/ttf 实际不会下载，
 * 但 Vite 仍会把三份字体全部 emit 到产物目录。
 *
 * 【为何不能在配置层解决】
 * 三份字体是「同一 @font-face 的备选 src」，不是独立声明，
 * 没有 Vite 原生选项可以裁剪其中某个 src，故在 generateBundle 阶段：
 *   1) 从 bundle 中删除 .woff / .ttf 字体资产（.woff2 保留）；
 *   2) 同时从 CSS 资产里剥离对应 url()+format() 片段，
 *      避免浏览器尝试请求已不存在的文件。
 *
 * enforce: 'post' 保证本插件的 generateBundle 晚于 Vite 的 CSS 资产 emit。
 */
function stripLegacyFonts(): Plugin {
  const FONT_FALLBACK_RE =
    /,\s*url\([^)]*?\.(?:woff|ttf)(?:\?[^)]*)?\)\s*format\(\s*["']?(?:woff|truetype)["']?\s*\)/g;

  return {
    name: "strip-legacy-fonts",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      // 1) 删除 woff / ttf 字体资产（保留 .woff2）
      for (const fileName of Object.keys(bundle)) {
        if (!/qweather-icons[^/\\]*\.(woff|ttf)$/.test(fileName)) continue;
        this.warn(`[strip-legacy-fonts] 移除冗余字体资产: ${fileName}`);
        delete bundle[fileName];
      }

      // 2) 从 CSS 中剥离对应 src
      for (const fileName of Object.keys(bundle)) {
        const item = bundle[fileName];
        if (item.type !== "asset" || !fileName.endsWith(".css")) continue;
        const source = typeof item.source === "string"
          ? item.source
          : Buffer.from(item.source).toString("utf8");
        item.source = source.replace(FONT_FALLBACK_RE, "");
      }
    },
  };
}

/**
 * PWA / 离线支持。
 *
 * 【缓存策略分层】
 * 1) 预缓存（precache）：构建产物（index.html、各 chunk、CSS、字体、图标）
 *    全部按 revision 打进 sw.js，离线时可完整启动应用，包括 Settings / Weather
 *    等懒加载分包。
 * 2) 运行时缓存：仅图片走 StaleWhileRevalidate。壁纸与图标分属 R2 CDN、
 *    cn.bing.com、unsplash 等跨域主机（无 CORS 头时为 opaque 响应），
 *    因此 cacheableResponse 必须放行 status 0。
 * 3) 刻意不缓存 /api/*：数据离线由 localStorage 镜像承担，
 *    缓存 API 响应会导致换用户或删除后读到陈旧内容。
 *
 * 【outDir 必须显式指定】
 * 插件默认用根配置 build.outDir（dist/client），但客户端产物实际在
 * dist/client/client。不覆盖会同时踩两个坑：sw.js 被写到静态资源根之外
 * （永远请求不到），且 glob 会扫到同级 Worker 产物目录 dist/client/harborpage。
 */
function pwaPlugin(): Plugin[] {
  return VitePWA({
    outDir: CLIENT_ASSET_DIR,
    // 新 SW 就绪后直接接管并刷新，避免用户停留在旧版本
    registerType: "autoUpdate",
    injectRegister: "auto",
    includeAssets: ["favicon.png"],
    manifest: {
      name: "HarborPage",
      short_name: "HarborPage",
      description: "Personal start page with bookmarks, notes, todos and weather.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#050814",
      theme_color: "#6366f1",
      // 192/512 是 Chrome 判定「可安装」的硬性门槛：只声明 favicon.png（128×128）
      // 时浏览器不会给出安装入口。两个尺寸由 favicon.png 用 lanczos3 放大生成，
      // 与原图同一套视觉（源图内容为平滑渐变，放大后几乎没有损失）。
      icons: [
        {
          src: "/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    workbox: {
      globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico,webmanifest}"],
      // 防御性排除：机密文件不应进入预缓存清单（正常情况下 devVarsCleanup 已删除）
      globIgnores: ["**/.dev.vars", "**/*.dev.vars"],
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ request }) => request.destination === "image",
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "harbor-images",
            cacheableResponse: { statuses: [0, 200] },
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        },
      ],
    },
    // 本地 wrangler dev 不做 SW 拦截，避免开发时被缓存干扰
    devOptions: { enabled: false },
  });
}

/**
 * 让 PWA 产物只落在客户端资源目录。
 *
 * 【问题根因】
 * vite-plugin-pwa 的 generateBundle 对每个构建环境都会执行 emitFile，
 * 于是 manifest.webmanifest / registerSW.js 会被同时写进 Worker 产物目录
 * （dist/client/harborpage）。该目录在静态资源根之外，这两个文件永远请求不到，
 * 只会污染 Worker 输出。
 *
 * 处理方式与 devVarsCleanup 一致：在 generateBundle 阶段从 bundle 对象里删除条目，
 * 使其永不落盘。只对「输出目录 ≠ 客户端资源根」的环境生效。
 *
 * 【为何必须是 enforce: 'post' 且排在最后】
 * vite-plugin-pwa 的构建插件自带 enforce: 'post'，其 generateBundle 在 post 阶段执行。
 * 本插件若停留在 normal 阶段，会在 emit 之前跑完、什么都删不到；
 * 同为 post 时按数组顺序执行，因此必须排在 pwaPlugin 之后。
 */
function pwaClientOnly(): Plugin {
  let resolvedRoot = "";

  return {
    name: "pwa-client-only",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      resolvedRoot = config.root;
    },
    generateBundle(_options, bundle) {
      // 环境级 build.outDir 是相对于项目根的路径（如 dist\client\client），
      // 而 config.root 可能是带正斜杠的形式，故先 resolve 再用 normalizePath 统一分隔符
      const envOutDir = normalizePath(resolve(resolvedRoot, this.environment.config.build.outDir));
      const clientOutDir = normalizePath(join(resolvedRoot, CLIENT_ASSET_DIR));
      if (envOutDir === clientOutDir) return;
      for (const fileName of Object.keys(bundle)) {
        if (fileName === "manifest.webmanifest" || fileName === "registerSW.js") {
          delete bundle[fileName];
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), devVarsCleanup(), stripLegacyFonts(), pwaPlugin(), pwaClientOnly()],
  define: {
    // About 弹窗展示的构建版本信息
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  server: {
    port: 5173,
    proxy: {
      '/api/bing': {
        target: 'https://www.bing.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bing/, ''),
      },
    },
  },
  build: {
    outDir: 'dist/client',
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          output: {
            /**
             * 第三方依赖分包：把体积大、更新频率低的运行时单独拆出，
             * 使其可被浏览器长期缓存，且避免单个 chunk 超过 500 kB 告警。
             *
             * 注意：分区必须「包边界精确匹配」且互不重叠。
             * react 与 react-dom、scheduler 必须进同一 chunk，
             * 否则会出现 vendor -> vendor-react -> vendor 的循环 chunk。
             */
            manualChunks(id) {
              if (!id.includes('node_modules')) return;
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
                return 'vendor-react';
              }
              if (/[\\/]node_modules[\\/](i18next|react-i18next)[\\/]/.test(id)) {
                return 'vendor-i18n';
              }
              return;
            },
          },
        },
      },
    },
  },
})