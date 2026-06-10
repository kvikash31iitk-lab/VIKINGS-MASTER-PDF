/**
 * Plugin runtime — loads validated plugin entries from the main process and
 * executes them against the guarded VikingsPluginAPI. Each granted
 * permission unlocks one extension surface; everything else throws.
 */
import { create } from 'zustand';
import { commands, type CommandDefinition } from '../services/command-registry';
import { ipc, rlog } from '../services/ipc';
import { toast } from '../stores/ui-stores';
import { eventBus, type EventName, type AppEvents } from '@shared/event-bus';
import type { PluginRecord } from '@shared/types';

export interface PluginRibbonButton {
  pluginId: string;
  tabId: string;
  groupLabel: string;
  commandId: string;
  label: string;
  icon?: string;
}

export interface PluginPanel {
  pluginId: string;
  id: string;
  title: string;
  /** Renders plain DOM into the host element — framework-agnostic plugins. */
  mount: (host: HTMLElement) => void | (() => void);
}

export interface PluginExporter {
  pluginId: string;
  id: string;
  label: string;
  extension: string;
  export: (docText: string) => Promise<Uint8Array> | Uint8Array;
}

interface PluginState {
  records: PluginRecord[];
  loaded: string[];
  ribbonButtons: PluginRibbonButton[];
  panels: PluginPanel[];
  exporters: PluginExporter[];
  setRecords(records: PluginRecord[]): void;
  markLoaded(id: string): void;
  addRibbonButton(button: PluginRibbonButton): void;
  addPanel(panel: PluginPanel): void;
  addExporter(exporter: PluginExporter): void;
  removePlugin(id: string): void;
}

export const usePluginStore = create<PluginState>((set) => ({
  records: [],
  loaded: [],
  ribbonButtons: [],
  panels: [],
  exporters: [],
  setRecords: (records) => set({ records }),
  markLoaded: (id) => set((s) => ({ loaded: [...s.loaded, id] })),
  addRibbonButton: (button) => set((s) => ({ ribbonButtons: [...s.ribbonButtons, button] })),
  addPanel: (panel) => set((s) => ({ panels: [...s.panels, panel] })),
  addExporter: (exporter) => set((s) => ({ exporters: [...s.exporters, exporter] })),
  removePlugin: (id) =>
    set((s) => ({
      loaded: s.loaded.filter((l) => l !== id),
      ribbonButtons: s.ribbonButtons.filter((b) => b.pluginId !== id),
      panels: s.panels.filter((p) => p.pluginId !== id),
      exporters: s.exporters.filter((e) => e.pluginId !== id)
    }))
}));

/** API surface handed to plugin entry functions — see docs/PLUGIN-SDK.md. */
export interface VikingsPluginAPI {
  readonly pluginId: string;
  registerCommand(def: Omit<CommandDefinition, 'pluginId'>): void;
  registerRibbonButton(button: Omit<PluginRibbonButton, 'pluginId'>): void;
  registerPanel(panel: Omit<PluginPanel, 'pluginId'>): void;
  registerExporter(exporter: Omit<PluginExporter, 'pluginId'>): void;
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };
  events: {
    on<E extends EventName>(event: E, handler: (payload: AppEvents[E]) => void): () => void;
  };
  ui: {
    toast(kind: 'info' | 'success' | 'warning' | 'error', title: string, detail?: string): void;
  };
}

function buildApi(record: PluginRecord): VikingsPluginAPI {
  const { id } = record.manifest;
  const granted = new Set(record.manifest.permissions);
  const need = (perm: string): void => {
    if (!granted.has(perm as never)) {
      throw new Error(`Plugin "${id}" lacks the "${perm}" permission`);
    }
  };
  return {
    pluginId: id,
    registerCommand: (def) => {
      need('commands');
      commands.register({ ...def, id: `plugin.${id}.${def.id}`, pluginId: id });
    },
    registerRibbonButton: (button) => {
      need('ribbon');
      usePluginStore.getState().addRibbonButton({ ...button, pluginId: id });
    },
    registerPanel: (panel) => {
      need('panels');
      usePluginStore.getState().addPanel({ ...panel, pluginId: id });
    },
    registerExporter: (exporter) => {
      need('exporters');
      usePluginStore.getState().addExporter({ ...exporter, pluginId: id });
    },
    storage: {
      get: (key) => {
        need('storage');
        return ipc.plugins.dataGet(id, key);
      },
      set: (key, value) => {
        need('storage');
        return ipc.plugins.dataSet(id, key, value);
      }
    },
    events: {
      on: (event, handler) => eventBus.on(event, handler)
    },
    ui: {
      toast: (kind, title, detail) => toast[kind](title, detail)
    }
  };
}

export const pluginRuntime = {
  async loadAll(allowList: string[], enabled: boolean): Promise<void> {
    if (!enabled) return;
    const records = await ipc.plugins.list();
    usePluginStore.getState().setRecords(records);
    for (const record of records) {
      if (record.error) {
        rlog.warn('plugins', `Skipping ${record.manifest.id}: ${record.error}`);
        continue;
      }
      if (allowList.length > 0 && !allowList.includes(record.manifest.id)) continue;
      await this.load(record);
    }
  },

  async load(record: PluginRecord): Promise<void> {
    const { id } = record.manifest;
    try {
      const source = await ipc.plugins.readEntry(id);
      // Plugin entries are CommonJS-style factories: module.exports.activate(api).
      const moduleObj = { exports: {} as { activate?: (api: VikingsPluginAPI) => void } };
      const factory = new Function('module', 'exports', 'api', `${source}\n//# sourceURL=vikings-plugin:${id}`);
      const api = buildApi(record);
      factory(moduleObj, moduleObj.exports, api);
      if (typeof moduleObj.exports.activate === 'function') {
        moduleObj.exports.activate(api);
      }
      usePluginStore.getState().markLoaded(id);
      eventBus.emit('plugin:loaded', { pluginId: id });
      rlog.info('plugins', `Loaded plugin ${id}`);
    } catch (e) {
      eventBus.emit('plugin:error', { pluginId: id, error: (e as Error).message });
      rlog.error('plugins', `Plugin ${id} failed to load`, { error: (e as Error).message });
      toast.error(`Plugin "${id}" failed`, (e as Error).message);
    }
  },

  unload(pluginId: string): void {
    commands.unregisterByPlugin(pluginId);
    usePluginStore.getState().removePlugin(pluginId);
  }
};
