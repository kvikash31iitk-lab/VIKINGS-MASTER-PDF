/** Renderer mirror of main-process settings, kept in sync over IPC. */
import { create } from 'zustand';
import { DEFAULT_SETTINGS, setByPath, type AppSettings } from '@shared/settings-schema';
import { ipc } from '../services/ipc';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load(): Promise<void>;
  update(key: string, value: unknown): Promise<void>;
  reset(): Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: structuredClone(DEFAULT_SETTINGS),
  loaded: false,

  load: async () => {
    const settings = await ipc.settings.getAll();
    set({ settings, loaded: true });
  },

  update: async (key, value) => {
    const next = structuredClone(get().settings) as unknown as Record<string, unknown>;
    setByPath(next, key, value);
    set({ settings: next as unknown as AppSettings });
    await ipc.settings.set(key, value);
  },

  reset: async () => {
    const settings = await ipc.settings.reset();
    set({ settings });
  }
}));

/** Apply external changes (other windows / main process broadcasts). */
ipc.settings.onChanged(({ key, value }) => {
  if (key === '*') {
    void useSettingsStore.getState().load();
    return;
  }
  const state = useSettingsStore.getState();
  const next = structuredClone(state.settings) as unknown as Record<string, unknown>;
  setByPath(next, key, value);
  useSettingsStore.setState({ settings: next as unknown as AppSettings });
});
