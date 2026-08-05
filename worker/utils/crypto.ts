// Web Crypto API 工具 - 兼容 Cloudflare Workers
// 使用全局 crypto.subtle (Web Crypto API) 而非 Node.js crypto 模块

// SHA-256 哈希函数（使用 Web Crypto API）
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 生成加密安全随机字符串（Worker 环境）
 * 替代 Math.random()，使用 crypto.getRandomValues
 * 直接映射字节到字符集，避免低效的 base36 转换
 */
export function secureRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const result = new Uint8Array(length);
  crypto.getRandomValues(result);
  
  let output = '';
  for (let i = 0; i < length; i++) {
    output += chars[result[i] % chars.length];
  }
  return output;
}

/**
 * 生成唯一 ID（时间戳 + 加密随机）
 */
export function secureId(prefix: string = ''): string {
  const rand = secureRandomString(9);
  return `${prefix}${Date.now()}_${rand}`;
}

/**
 * Worker 运行时安全的恒定时间字符串比较
 *
 * Cloudflare Workers 虽然在部分版本提供 crypto.subtle，但兼容性不稳定。
 * 这里使用逐字节 XOR + 累加差异的方式实现恒定时间比较。
 * 对两个 SHA-256 哈希（hex 字符串）做 XOR 逐字节比较，
 * 确保无论是否匹配，都执行相同量级的操作，不泄露时间信息。
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);

  // 长度不等：仍执行完整 XOR 扫描一个 dummy buf 的操作，隐藏长度差异
  if (bufA.byteLength !== bufB.byteLength) {
    const dummy = new Uint8Array(bufA.byteLength);
    let _diff = 0;
    for (let i = 0; i < bufA.byteLength; i++) {
      _diff |= bufA[i] ^ dummy[i];
    }
    // _diff 总是非零，但计算逻辑保证恒定时间
    return false;
  }

  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}