/**
 * MD5 哈希函数 - 使用 crypto-js（与前端保持一致）
 *
 * 必须与前端 src/services/IconManager.ts 中的 MD5 实现完全一致，
 * 否则前后端生成的图标 R2 路径不匹配，导致图标 404。
 */
import MD5 from 'crypto-js/md5';

/**
 * 计算 MD5 哈希值
 * @param input 输入字符串
 * @returns 32 字符的十六进制 MD5 哈希
 */
export function md5(input: string): string {
  return MD5(input).toString();
}
