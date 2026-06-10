/**
 * Settings service — typed settings over the repository with in-memory cache,
 * change broadcast to all windows, and graceful defaults when persistence
 * is unavailable.
 */
import { BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import {
  DEFAULT_SETTINGS,
  mergeWithDefaults,
  getByPath,
  setByPath,
  type AppSettings
} from '../../shared/settings-schema';
import type { SettingsRepository } from '../database/repositories';
import type { Logger } from './logger';

export class SettingsService {
  private cache: AppSettings;

  constructor(
    private repo: SettingsRepository,
    private logger: Logger
  ) {
    try {
      this.cache = mergeWithDefaults(this.repo.getAll());
    } catch (e) {
      this.logger.error('settings', 'Failed to load settings; using defaults', {
        error: (e as Error).message
      });
      this.cache = structuredClone(DEFAULT_SETTINGS);
    }
  }

  getAll(): AppSettings {
    return this.cache;
  }

  get<T>(path: string): T {
    return getByPath(this.cache as unknown as Record<string, unknown>, path) as T;
  }

  set(path: string, value: unknown): void {
    setByPath(this.cache as unknown as Record<string, unknown>, path, value);
    try {
      this.repo.set(path, value);
    } catch (e) {
      this.logger.warn('settings', `Persist failed for ${path}`, { error: (e as Error).message });
    }
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.SettingsChanged, { key: path, value });
    }
  }

  reset(): AppSettings {
    try {
      this.repo.reset();
    } catch {
      /* tolerated */
    }
    this.cache = structuredClone(DEFAULT_SETTINGS);
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.SettingsChanged, { key: '*', value: null });
    }
    return this.cache;
  }
}
