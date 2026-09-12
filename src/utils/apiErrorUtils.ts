import i18n from '../i18n';
import { isApiErrorCode, isIconSourceCode } from '../constants';

/**
 * 把后端返回的错误码翻译为当前界面语言的文案。
 * 非错误码（如网络异常、结构缺失）时返回调用方提供的兜底文案。
 */
export function translateApiError(code: unknown, fallback: string): string {
  if (isApiErrorCode(code)) {
    return i18n.t(`icons:apiErrors.${code}`);
  }
  return fallback;
}

/**
 * 把图标候选来源码翻译为当前界面语言的文案。
 * 非来源码时原样返回，便于排查未知来源。
 */
export function translateIconSource(source: unknown): string {
  if (isIconSourceCode(source)) {
    return i18n.t(`icons:iconSource.${source}`);
  }
  return typeof source === 'string' ? source : '';
}
