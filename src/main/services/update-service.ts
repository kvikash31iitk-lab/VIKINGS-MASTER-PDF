/**
 * Auto-update — electron-updater wired to the generic provider configured in
 * electron-builder.yml. Events stream to the renderer status bar / dialog.
 */
import { BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { IPC } from '../../shared/ipc-channels';
import type { UpdateEventPayload } from '../../shared/types';
import type { Logger } from './logger';

const { autoUpdater } = electronUpdater;

export class UpdateService {
  private wired = false;

  constructor(
    private logger: Logger,
    private isPackaged: boolean
  ) {}

  private broadcast(payload: UpdateEventPayload): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.UpdateEvent, payload);
    }
  }

  private wire(): void {
    if (this.wired) return;
    this.wired = true;
    autoUpdater.autoDownload = false;
    autoUpdater.logger = {
      info: (m: unknown) => this.logger.info('updater', String(m)),
      warn: (m: unknown) => this.logger.warn('updater', String(m)),
      error: (m: unknown) => this.logger.error('updater', String(m)),
      debug: (m: unknown) => this.logger.debug('updater', String(m))
    };
    autoUpdater.on('checking-for-update', () => this.broadcast({ state: 'checking' }));
    autoUpdater.on('update-available', (info) =>
      this.broadcast({ state: 'available', version: info.version })
    );
    autoUpdater.on('update-not-available', () => this.broadcast({ state: 'not-available' }));
    autoUpdater.on('download-progress', (progress) =>
      this.broadcast({ state: 'downloading', percent: Math.round(progress.percent) })
    );
    autoUpdater.on('update-downloaded', (info) =>
      this.broadcast({ state: 'downloaded', version: info.version })
    );
    autoUpdater.on('error', (e) => this.broadcast({ state: 'error', error: e.message }));
  }

  async check(): Promise<void> {
    if (!this.isPackaged) {
      this.broadcast({ state: 'not-available' });
      this.logger.info('updater', 'Skipping update check in development');
      return;
    }
    this.wire();
    await autoUpdater.checkForUpdates();
  }

  async download(): Promise<void> {
    this.wire();
    await autoUpdater.downloadUpdate();
  }

  install(): void {
    autoUpdater.quitAndInstall();
  }
}
