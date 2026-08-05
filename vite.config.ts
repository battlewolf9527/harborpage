import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react-swc'

import { cloudflare } from "@cloudflare/vite-plugin";
import { existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare(), devVarsCleanup()],
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
})