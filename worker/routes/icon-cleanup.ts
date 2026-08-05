import type { Env } from '../types';
import { generateIconFilename } from '../utils/icon';

type IconItem = { url: string; icon?: string };

// 收集被使用的图标文件名
function collectUsedIconFilenames(
  items: IconItem[],
  r2Url: string | undefined
): Set<string> {
  const usedFilenames = new Set<string>();

  for (const item of items) {
    if (item.icon && r2Url && item.icon.startsWith(r2Url)) {
      const filename = item.icon.split('/').pop();
      if (filename) {
        usedFilenames.add(filename);
      }
    } else if (item.icon && item.icon.trim()) {
      usedFilenames.add(generateIconFilename(item.icon.trim()));
    } else if (item.url) {
      try {
        const domain = new URL(item.url).hostname.toLowerCase();
        usedFilenames.add(generateIconFilename(domain));
      } catch {
        // URL解析失败，跳过
      }
    }
  }

  return usedFilenames;
}

function safeParseJson(data: string | null): IconItem[] {
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 清理未使用的图标：扫描 R2，删除不被任何 website/searchEngine 引用的图标
// 支持分批清理和断点续传，避免超过 Cloudflare Workers 的执行时间限制
export async function handleCleanup(env: Env, cursor?: string, prefix?: string): Promise<Response> {
  const startTime = Date.now();
  const MAX_EXECUTION_TIME = 20000; // 最大执行时间：20秒
  const MAX_DELETES_PER_BATCH = 100; // 每批最多删除数量

  // 获取用户的所有网站数据
  const websiteData = await env.USER_DATA.get('websites');
  const websites = safeParseJson(websiteData);

  // 获取用户的搜索引擎数据
  const searchEngineData = await env.USER_DATA.get('searchEngines');
  const searchEngines = safeParseJson(searchEngineData);

  // 收集所有被使用的图标文件名
  const usedIconFilenames = new Set<string>([
    ...collectUsedIconFilenames(websites, env.R2_URL),
    ...collectUsedIconFilenames(searchEngines, env.R2_URL),
  ]);

  let deletedCount = 0;
  const errors: string[] = [];
  let hasMore = false;
  let nextCursor: string | undefined = cursor;
  let nextPrefix: string | undefined = prefix || 'WebSites/';
  let batchUnusedCount = 0;

  // 定义要处理的前缀列表
  const prefixes = ['WebSites/', 'SearchEngines/'];
  let currentPrefixIndex = prefixes.indexOf(nextPrefix);

  // 如果 prefix 非法（不在白名单中），回退到第一个默认前缀
  if (currentPrefixIndex === -1) {
    nextPrefix = 'WebSites/';
    currentPrefixIndex = 0;
  }

  // 如果 cursor 不为空但 prefix 为空，从 WebSites 开始
  // （nextPrefix 已通过上面的逻辑保证非空，此处为安全兜底）
  if (cursor && !prefix) {
    nextPrefix = 'WebSites/';
    currentPrefixIndex = 0;
  }

  // 主循环：处理所有前缀下的图标
  while (currentPrefixIndex < prefixes.length) {
    const currentPrefix = prefixes[currentPrefixIndex];
    
    // 检查是否超过执行时间
    if (Date.now() - startTime > MAX_EXECUTION_TIME) {
      hasMore = true;
      break;
    }

    const listResult = await env.BUCKET.list({ prefix: currentPrefix, cursor: nextCursor });
    
    // 找出需要删除的对象
    const toDelete = listResult.objects.filter(obj => {
      const filename = obj.key.split('/').pop();
      return filename && !usedIconFilenames.has(filename);
    });

    // 计算当前批次有多少未使用的图标（用于估计剩余数量）
    batchUnusedCount = toDelete.length;

    // 分批并发删除（每批最多 MAX_DELETES_PER_BATCH 个）
    for (let i = 0; i < toDelete.length; i += MAX_DELETES_PER_BATCH) {
      // 检查是否超过执行时间
      if (Date.now() - startTime > MAX_EXECUTION_TIME) {
        hasMore = true;
        break;
      }

      const batch = toDelete.slice(i, i + MAX_DELETES_PER_BATCH);
      const deletePromises = batch.map(async (obj) => {
        try {
          await env.BUCKET.delete(obj.key);
          deletedCount++;
        } catch (error) {
          errors.push(`${obj.key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      await Promise.all(deletePromises);
    }

    if (hasMore) {
      // 超时中断：不前进游标到下一页，而是重新列出当前前缀
      // 这样未删除的项会在下次调用时重新出现，不会被永久跳过
      // 已删除的项不在 R2 中，list 不会返回，所以不会重复删除
      nextCursor = undefined;
      nextPrefix = currentPrefix;
      break;
    }

    if (listResult.truncated) {
      // 当前前缀还有更多对象，继续处理
      nextCursor = listResult.cursor;
      nextPrefix = currentPrefix;
    } else {
      // 当前前缀处理完毕，切换到下一个前缀
      currentPrefixIndex++;
      nextCursor = undefined;
      nextPrefix = currentPrefixIndex < prefixes.length ? prefixes[currentPrefixIndex] : undefined;
    }
  }

  // 估计剩余数量（基于当前批次的未使用率）
  let estimatedRemaining = 0;
  if (hasMore && nextCursor) {
    // 粗略估计：假设后续批次的未使用率与当前批次相似
    // 每个 list 最多返回 1000 个对象
    estimatedRemaining = Math.floor(batchUnusedCount * 1.5);
  }

  return Response.json({
    success: true,
    message: `清理完成，共删除 ${deletedCount} 个未使用的图标${hasMore ? `，还有约 ${estimatedRemaining} 个图标未清理，请再次点击继续清理` : ''}`,
    deletedCount,
    errors,
    hasMore,
    cursor: nextCursor,
    prefix: nextPrefix,
    estimatedRemaining,
  });
}
