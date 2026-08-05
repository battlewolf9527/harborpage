import { getServices } from '../services/serviceContainer';

type SubscribableStore<T> = {
  getState: () => T;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
};

type PersistSelector<T> = {
  key: keyof T;
  persist: (value: T[keyof T]) => void;
};

export function setupAutoPersist<T extends object>(
  store: SubscribableStore<T>,
  configs: PersistSelector<T>[]
): () => void {
  return store.subscribe((state, prevState) => {
    const dataManager = getServices().dataManager;
    if (dataManager.isInitializing()) return;

    for (const { key, persist } of configs) {
      const current = state[key];
      const prev = prevState[key];
      if (current !== prev) {
        persist(current);
      }
    }
  });
}