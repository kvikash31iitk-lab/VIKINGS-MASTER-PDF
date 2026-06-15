/**
 * Preload — the single hardened bridge between renderer and main.
 * Exposes `window.vikings`: channel-validated invoke/subscribe wrappers.
 * No Node primitives ever reach the renderer.
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { INVOKE_CHANNELS, EVENT_CHANNELS } from '../shared/ipc-channels';

export interface VikingsBridge {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
  on(channel: string, listener: (payload: unknown) => void): () => void;
  /**
   * Resolves the absolute filesystem path of a dropped/selected File.
   * Electron 32+ removed `File.path`; `webUtils.getPathForFile` is the
   * supported replacement and must be called from the preload.
   */
  getPathForFile(file: File): string;
  platform: NodeJS.Platform;
}

const bridge: VikingsBridge = {
  invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args) as Promise<T>;
  },

  on(channel: string, listener: (payload: unknown) => void): () => void {
    if (!EVENT_CHANNELS.has(channel)) {
      throw new Error(`IPC event channel not allowed: ${channel}`);
    }
    const wrapped = (_event: Electron.IpcRendererEvent, payload: unknown): void => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  getPathForFile(file: File): string {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return '';
    }
  },

  platform: process.platform
};

contextBridge.exposeInMainWorld('vikings', bridge);
