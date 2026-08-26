export const TRACKED_KEYS = ['settings', 'websites', 'searchEngines', 'todos', 'todoList', 'notes', 'wallpaper', 'pages'] as const;

export type TrackedKey = typeof TRACKED_KEYS[number];

export function isTrackedKey(key: string): key is TrackedKey {
  return (TRACKED_KEYS as readonly string[]).includes(key);
}