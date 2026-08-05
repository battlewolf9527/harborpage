import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../store/useSettingsStore';

export function useAutoSaveSettings() {
  const { autoSaveDuration, autoSaveEnabled, setAutoSaveDuration, setAutoSaveEnabled } = useSettingsStore(
    useShallow((s) => ({
      autoSaveDuration: s.autoSaveDuration,
      autoSaveEnabled: s.autoSaveEnabled,
      setAutoSaveDuration: s.setAutoSaveDuration,
      setAutoSaveEnabled: s.setAutoSaveEnabled,
    }))
  );

  return {
    autoSaveDuration,
    autoSaveEnabled,
    setAutoSaveDuration,
    setAutoSaveEnabled,
  };
}