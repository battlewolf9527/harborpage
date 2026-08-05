export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 11);
  return prefix ? `${prefix}${timestamp}-${random}` : `${timestamp}-${random}`;
}
