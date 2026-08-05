import { md5 } from './md5';

export function getPrefix(type: string): string {
  return type === 'search' ? 'SearchEngines' : 'WebSites';
}

export function generateIconFilename(
  hashInput: string,
  ext: string = 'png'
): string {
  const normalizedInput = hashInput.toLowerCase();
  const hash = md5(normalizedInput);
  return `${hash}.${ext}`;
}

export function getIconPath(type: string, hashInput: string): string {
  const filename = generateIconFilename(hashInput);
  return `${getPrefix(type)}/${filename}`;
}

export function getIconUrl(type: string, hashInput: string, r2Url?: string): string {
  if (!r2Url) {
    return '';
  }
  const filename = generateIconFilename(hashInput);
  const cleanR2Url = r2Url.replace(/\/$/, '');
  return `${cleanR2Url}/${getPrefix(type)}/${filename}`;
}