/**
 * Auto-update — electron-updater pointed at this repo's GitHub Releases
 * (configured in electron-builder.yml). New versions download automatically in
 * the background; the user is then offered a one-click restart to apply them.
 * Events also stream to the renderer status bar.
 */
import { BrowserWindow, dialog } from 'electron';
import electronUpdater from 'electron-updater';
import { IPC } from '../../shared/ipc-channels';
import { APP_NAME } from '../../shared/constants';
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
    // Download new versions automatically; if the user defers the restart,
    // apply on next quit so they never have to fetch anything manually.
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
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
    autoUpdater.on('update-downloaded', (info) => {
      this.broadcast({ state: 'downloaded', version: info.version });
      void this.promptInstall(info.version);
    });
    autoUpdater.on('error', (e) => this.broadcast({ state: 'error', error: e.message }));
  }

  /** Offers a one-click restart once an update has finished downloading. */
  private async promptInstall(version: string): Promise<void> {
    const win = BrowserWindow.getAllWindows()[0];
    const options: Electron.MessageBoxOptions = {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `${APP_NAME} ${version} is ready to install.`,
      detail:
        'The update has been downloaded. Restart now to apply it, or it will be installed automatically the next time you close the app.'
    };
    const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (result.response === 0) {
      // Defer to the next tick so the dialog fully closes before relaunch.
      setImmediate(() => autoUpdater.quitAndInstall());
    }
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
