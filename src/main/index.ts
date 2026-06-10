/**
 * Vikings Master PDF — main process entry point.
 * Boot order: lock single instance → harden sessions → init services →
 * run migrations → register IPC → create window → wire lifecycle.
 */
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { IPC } from '../shared/ipc-channels';
import { APP_ID, AUTOSAVE_DIR, LOGS_DIR, PLUGINS_DIR, TESSDATA_DIR } from '../shared/constants';
import { container, TOKENS } from './container';
import { Logger } from './services/logger';
import { createDriver } from './database/driver';
import { runMigrations } from './database/migrations';
import {
  SettingsRepository,
  RecentFilesRepository,
  OcrHistoryRepository,
  TemplatesRepository,
  AiHistoryRepository,
  SignaturesRepository,
  StampsRepository,
  PluginDataRepository,
  VersionsRepository,
  SessionRepository,
  AuditRepository
} from './database/repositories';
import { SettingsService } from './services/settings-service';
import { FileService } from './services/file-service';
import { AutosaveService } from './services/autosave-service';
import { ConvertService } from './services/convert-service';
import { PrintService } from './services/print-service';
import { AiProxyService } from './services/ai-proxy-service';
import { UpdateService } from './services/update-service';
import { PluginService } from './services/plugin-service';
import { OcrMainService } from './services/ocr-main-service';
import { WorkerPool } from './workers/worker-pool';
import { WindowManager } from './window-manager';
import { hardenSessions } from './security';
import { registerIpcHandlers, type Repositories } from './ipc/register-handlers';

app.setAppUserModelId(APP_ID);

let windowManager: WindowManager | null = null;
let sessionRepo: SessionRepository | null = null;
/** Files queued from OS open events before the renderer is ready. */
const pendingOpenFiles: string[] = [];

function collectFileArgs(argv: string[]): string[] {
  return argv.filter((a) => a.toLowerCase().endsWith('.pdf'));
}

// ── Single instance ─────────────────────────────────────────────
// Declared after module-level state so bootstrap() can reference it safely.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  bootstrap();
}

function bootstrap(): void {
  pendingOpenFiles.push(...collectFileArgs(process.argv.slice(1)));

  app.on('second-instance', (_event, argv) => {
    const win = windowManager?.window;
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      for (const file of collectFileArgs(argv.slice(1))) {
        win.webContents.send(IPC.FileOpenedExternally, file);
      }
    }
  });

  // macOS file association.
  app.on('open-file', (event, path) => {
    event.preventDefault();
    const win = windowManager?.window;
    if (win) win.webContents.send(IPC.FileOpenedExternally, path);
    else pendingOpenFiles.push(path);
  });

  void app.whenReady().then(onReady);
}

function onReady(): void {
  const userData = app.getPath('userData');
  const logsDir = join(userData, LOGS_DIR);
  const versionsDir = join(userData, AUTOSAVE_DIR);
  const pluginsDir = join(userData, PLUGINS_DIR);
  mkdirSync(versionsDir, { recursive: true });

  // ── Services ──────────────────────────────────────────────────
  const logger = new Logger(logsDir, {
    minLevel: app.isPackaged ? 'info' : 'debug',
    mirrorToConsole: !app.isPackaged
  });
  container.register(TOKENS.Logger, () => logger);
  logger.info('app', `Vikings Master PDF ${app.getVersion()} starting (electron ${process.versions.electron})`);

  const db = createDriver(join(userData, 'vikings.db'), logger);
  container.register(TOKENS.Database, () => db);
  runMigrations(db, logger);

  const repos: Repositories & { settings: SettingsRepository; versions: VersionsRepository } = {
    settings: new SettingsRepository(db),
    recents: new RecentFilesRepository(db),
    ocrHistory: new OcrHistoryRepository(db),
    templates: new TemplatesRepository(db),
    aiHistory: new AiHistoryRepository(db),
    signatures: new SignaturesRepository(db),
    stamps: new StampsRepository(db),
    pluginData: new PluginDataRepository(db),
    versions: new VersionsRepository(db),
    session: new SessionRepository(db),
    audit: new AuditRepository(db)
  };
  sessionRepo = repos.session;

  const settings = new SettingsService(repos.settings, logger);
  container.register(TOKENS.Settings, () => settings);

  if (!settings.get<boolean>('performance.hardwareAcceleration')) {
    // Takes effect on next launch; Chromium is already initialized here.
    logger.info('app', 'Hardware acceleration disabled by settings (applies after relaunch)');
  }

  container.register(TOKENS.Files, () => new FileService(logger));
  container.register(
    TOKENS.Autosave,
    () => new AutosaveService(versionsDir, repos.versions, settings, logger)
  );
  container.register(TOKENS.Convert, () => new ConvertService(logger));
  container.register(TOKENS.Print, () => new PrintService(logger));
  container.register(TOKENS.AiProxy, () => new AiProxyService(logger));
  container.register(TOKENS.Updates, () => new UpdateService(logger, app.isPackaged));
  container.register(TOKENS.Plugins, () => new PluginService(pluginsDir, logger));
  container.register('ocr-main-service', () => new OcrMainService(join(userData, TESSDATA_DIR), logger));
  container.register(
    TOKENS.WorkerPool,
    () => new WorkerPool(logger, settings.get<number>('performance.workerThreads'))
  );

  hardenSessions();
  registerIpcHandlers(container, repos);

  // ── Window ────────────────────────────────────────────────────
  windowManager = new WindowManager(settings, logger);
  const win = windowManager.createMainWindow();

  win.webContents.once('did-finish-load', () => {
    for (const file of pendingOpenFiles.splice(0)) {
      win.webContents.send(IPC.FileOpenedExternally, file);
    }
  });

  // Crash recovery flag: dirty until a clean quit.
  try {
    const previous = repos.session.load();
    if (previous && !previous.cleanExit) {
      logger.warn('session', 'Previous session did not exit cleanly — recovery available');
    }
    repos.session.markClean(false);
  } catch {
    /* no persistence */
  }

  if (settings.get<boolean>('general.checkUpdatesAutomatically') && app.isPackaged) {
    setTimeout(() => {
      void container.resolve<UpdateService>(TOKENS.Updates).check();
    }, 15000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager?.createMainWindow();
    }
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    sessionRepo?.markClean(true);
  } catch {
    /* no persistence */
  }
});

app.on('quit', () => {
  void container.disposeAll();
});

process.on('uncaughtException', (e) => {
  try {
    container.resolve<Logger>(TOKENS.Logger).fatal('process', 'Uncaught exception', {
      error: e.message,
      stack: e.stack
    });
  } catch {
    console.error('Uncaught exception before logger init:', e);
  }
});
