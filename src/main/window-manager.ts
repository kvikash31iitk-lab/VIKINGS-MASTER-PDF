/**
 * Window manager — frameless main window with persisted bounds, state-change
 * broadcasting for the custom title bar, and dev/prod load paths.
 */
import { BrowserWindow, shell, screen } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc-channels';
import { APP_NAME } from '../shared/constants';
import type { SettingsService } from './services/settings-service';
import type { Logger } from './logger-types';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  constructor(
    private settings: SettingsService,
    private logger: Logger
  ) {}

  get window(): BrowserWindow | null {
    return this.mainWindow;
  }

  createMainWindow(): BrowserWindow {
    const saved = this.settings.get<{ x?: number; y?: number; width?: number; height?: number } | undefined>(
      'window.bounds' as never
    );
    const display = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.min(saved?.width ?? 1440, display.width);
    const height = Math.min(saved?.height ?? 900, display.height);

    const win = new BrowserWindow({
      title: APP_NAME,
      width,
      height,
      ...(saved?.x !== undefined && saved?.y !== undefined ? { x: saved.x, y: saved.y } : {}),
      minWidth: 980,
      minHeight: 640,
      frame: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
      backgroundColor: '#1b1d22',
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // preload uses structured clone of binary payloads
        webSecurity: true,
        spellcheck: false
      }
    });
    this.mainWindow = win;

    win.once('ready-to-show', () => win.show());

    const broadcastState = (): void => {
      if (win.isDestroyed()) return;
      win.webContents.send(IPC.WinStateChanged, {
        maximized: win.isMaximized(),
        fullscreen: win.isFullScreen(),
        focused: win.isFocused()
      });
    };
    win.on('maximize', broadcastState);
    win.on('unmaximize', broadcastState);
    win.on('enter-full-screen', broadcastState);
    win.on('leave-full-screen', broadcastState);
    win.on('focus', broadcastState);
    win.on('blur', broadcastState);

    const persistBounds = (): void => {
      if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;
      this.settings.set('window.bounds', win.getBounds());
    };
    win.on('resized', persistBounds);
    win.on('moved', persistBounds);

    // External links open in the system browser, never inside the app.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://') || url.startsWith('http://')) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    if (process.env.ELECTRON_RENDERER_URL) {
      void win.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      void win.loadFile(join(__dirname, '../renderer/index.html'));
    }

    this.logger.info('window', 'Main window created');
    return win;
  }

  send(channel: string, payload: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }
}
