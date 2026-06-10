/**
 * IPC routing — every channel from shared/ipc-channels is handled here.
 * All handlers return Result<T>; no exception ever crosses the bridge raw.
 */
import { app, ipcMain, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { IPC } from '../../shared/ipc-channels';
import { ok, err, wrapError, ErrorCodes, type Result } from '../../shared/result';
import { PDF_FILTERS } from '../../shared/constants';
import type { Container } from '../container';
import { TOKENS } from '../container';
import type { Logger } from '../services/logger';
import type { SettingsService } from '../services/settings-service';
import type { FileService } from '../services/file-service';
import type { AutosaveService } from '../services/autosave-service';
import type { ConvertService } from '../services/convert-service';
import type { PrintService } from '../services/print-service';
import type { AiProxyService } from '../services/ai-proxy-service';
import type { UpdateService } from '../services/update-service';
import type { PluginService } from '../services/plugin-service';
import type { WorkerPool } from '../workers/worker-pool';
import type {
  RecentFilesRepository,
  OcrHistoryRepository,
  TemplatesRepository,
  AiHistoryRepository,
  SignaturesRepository,
  StampsRepository,
  PluginDataRepository,
  SessionRepository,
  AuditRepository
} from '../database/repositories';
import type {
  EncryptRequest,
  DecryptRequest,
  SignRequest,
  HtmlToPdfRequest,
  OfficeToPdfRequest,
  PrintRequest,
  BatchJobRequest,
  AiProxyRequest,
  SessionState,
  OcrHistoryEntry,
  AiHistoryEntry,
  AuditEntry,
  LogLevel,
  TemplateMeta,
  SavedSignature,
  StampDefinition,
  OpenDialogRequest,
  SaveDialogRequest
} from '../../shared/types';

export interface Repositories {
  recents: RecentFilesRepository;
  ocrHistory: OcrHistoryRepository;
  templates: TemplatesRepository;
  aiHistory: AiHistoryRepository;
  signatures: SignaturesRepository;
  stamps: StampsRepository;
  pluginData: PluginDataRepository;
  session: SessionRepository;
  audit: AuditRepository;
}

/** Wraps a handler so failures become structured Result errors. */
function handle<T>(channel: string, fn: (...args: never[]) => Promise<T> | T): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<Result<T>> => {
    try {
      return ok(await fn(...(args as never[])));
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'E_WRONG_PASSWORD') return err(ErrorCodes.WRONG_PASSWORD, (e as Error).message);
      if ((e as Error).name === 'WrongPasswordError') {
        return err(ErrorCodes.WRONG_PASSWORD, (e as Error).message);
      }
      return wrapError(e);
    }
  });
}

export function registerIpcHandlers(container: Container, repos: Repositories): void {
  const logger = container.resolve<Logger>(TOKENS.Logger);
  const settings = container.resolve<SettingsService>(TOKENS.Settings);
  const files = container.resolve<FileService>(TOKENS.Files);
  const autosave = container.resolve<AutosaveService>(TOKENS.Autosave);
  const convert = container.resolve<ConvertService>(TOKENS.Convert);
  const printer = container.resolve<PrintService>(TOKENS.Print);
  const aiProxy = container.resolve<AiProxyService>(TOKENS.AiProxy);
  const updates = container.resolve<UpdateService>(TOKENS.Updates);
  const plugins = container.resolve<PluginService>(TOKENS.Plugins);
  const pool = container.resolve<WorkerPool>(TOKENS.WorkerPool);

  // ── App / window ───────────────────────────────────────────────
  handle(IPC.AppGetInfo, () => ({
    version: app.getVersion(),
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? '',
    platform: process.platform,
    userDataPath: app.getPath('userData'),
    logsPath: join(app.getPath('userData'), 'logs')
  }));
  handle(IPC.AppQuit, () => {
    app.quit();
  });
  handle(IPC.AppRelaunch, () => {
    app.relaunch();
    app.quit();
  });

  const focused = (): BrowserWindow | null => BrowserWindow.getFocusedWindow();
  handle(IPC.WinMinimize, () => focused()?.minimize());
  handle(IPC.WinToggleMaximize, () => {
    const win = focused();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  handle(IPC.WinIsMaximized, () => focused()?.isMaximized() ?? false);
  handle(IPC.WinClose, () => focused()?.close());
  handle(IPC.WinSetFullscreen, (flag: boolean) => focused()?.setFullScreen(flag));

  // ── Files ──────────────────────────────────────────────────────
  handle(IPC.FileOpenDialog, (req: OpenDialogRequest) => files.showOpenDialog(req ?? {}));
  handle(IPC.FileSaveDialog, (req: SaveDialogRequest) =>
    files.showSaveDialog(req ?? { filters: PDF_FILTERS })
  );
  handle(IPC.FileRead, (path: string) => files.read(path));
  handle(IPC.FileWrite, async (path: string, bytes: Uint8Array) => {
    await files.write(path, bytes);
    logger.audit('doc.save', { path, size: bytes.length });
  });
  handle(IPC.FileStat, (path: string) => files.statInfo(path));
  handle(IPC.FileShowInFolder, (path: string) => files.showInFolder(path));
  handle(IPC.FileOpenPath, (path: string) => files.openPath(path));

  // ── Recents ────────────────────────────────────────────────────
  handle(IPC.RecentList, () => repos.recents.list());
  handle(IPC.RecentAdd, (entry: { path: string; title: string; pageCount: number; fileSize: number }) => {
    repos.recents.add(entry);
    app.addRecentDocument(entry.path);
  });
  handle(IPC.RecentRemove, (path: string) => repos.recents.remove(path));
  handle(IPC.RecentSetPinned, (path: string, pinned: boolean) => repos.recents.setPinned(path, pinned));
  handle(IPC.RecentSetFavorite, (path: string, favorite: boolean) =>
    repos.recents.setFavorite(path, favorite)
  );
  handle(IPC.RecentUpdatePosition, (path: string, page: number, zoom: number) =>
    repos.recents.updatePosition(path, page, zoom)
  );
  handle(IPC.RecentClear, () => repos.recents.clear());

  // ── Settings ───────────────────────────────────────────────────
  handle(IPC.SettingsGetAll, () => settings.getAll());
  handle(IPC.SettingsSet, (key: string, value: unknown) => settings.set(key, value));
  handle(IPC.SettingsReset, () => settings.reset());

  // ── Galleries ──────────────────────────────────────────────────
  handle(IPC.TemplatesList, () => repos.templates.list());
  handle(IPC.TemplatesGetData, (id: string) => {
    const data = repos.templates.getData(id);
    if (!data) throw new Error(`Template ${id} not found`);
    return data;
  });
  handle(IPC.TemplatesSave, (meta: Omit<TemplateMeta, 'createdAt'>, data: Uint8Array) =>
    repos.templates.save(meta, data)
  );
  handle(IPC.TemplatesDelete, (id: string) => repos.templates.delete(id));
  handle(IPC.SignaturesList, () => repos.signatures.list());
  handle(IPC.SignaturesSave, (sig: Omit<SavedSignature, 'createdAt'>) => repos.signatures.save(sig));
  handle(IPC.SignaturesDelete, (id: string) => repos.signatures.delete(id));
  handle(IPC.StampsList, () => repos.stamps.list());
  handle(IPC.StampsSave, (stamp: Omit<StampDefinition, 'createdAt'>) => repos.stamps.save(stamp));
  handle(IPC.StampsDelete, (id: string) => repos.stamps.delete(id));

  // ── History ────────────────────────────────────────────────────
  handle(IPC.OcrHistoryAdd, (entry: OcrHistoryEntry) => repos.ocrHistory.add(entry));
  handle(IPC.OcrHistoryList, () => repos.ocrHistory.list());
  handle(IPC.AiHistoryAdd, (entry: AiHistoryEntry) => repos.aiHistory.add(entry));
  handle(IPC.AiHistoryList, () => repos.aiHistory.list());

  // ── Heavy PDF ops (worker pool) ────────────────────────────────
  handle(IPC.PdfEncrypt, async (req: EncryptRequest) => {
    const result = await pool.run({ kind: 'encrypt', payload: req });
    logger.audit('sec.encrypt', { algorithm: req.algorithm });
    return result.bytes!;
  });
  handle(IPC.PdfDecrypt, async (req: DecryptRequest) => {
    const result = await pool.run({ kind: 'decrypt', payload: req });
    logger.audit('sec.decrypt', {});
    return result.bytes!;
  });
  handle(IPC.PdfSign, async (req: SignRequest) => {
    const result = await pool.run({ kind: 'sign', payload: req });
    logger.audit('sec.sign', { reason: req.reason });
    return result.bytes!;
  });
  handle(IPC.PdfVerifySignatures, async (bytes: Uint8Array) => {
    const result = await pool.run({ kind: 'verify', payload: { bytes } });
    return result.verifications ?? [];
  });
  handle(IPC.PdfMergeFiles, async (files_: Uint8Array[]) => {
    const result = await pool.run({ kind: 'merge', payload: { files: files_ } });
    return result.bytes!;
  });

  // ── Conversion / clipboard / print ─────────────────────────────
  handle(IPC.ConvertHtmlToPdf, (req: HtmlToPdfRequest) => convert.htmlToPdf(req));
  handle(IPC.ConvertOfficeToPdf, async (req: OfficeToPdfRequest) => {
    const producedPath = await convert.officeToPdf(req);
    return { path: producedPath, bytes: await convert.readProducedFile(producedPath) };
  });
  handle(IPC.ConvertProbeOffice, () => convert.probeOffice());
  handle(IPC.ClipboardReadForPdf, () => convert.readClipboardForPdf());
  handle(IPC.PrintPdf, (req: PrintRequest) => printer.print(req));

  // ── Batch ──────────────────────────────────────────────────────
  handle(IPC.BatchRun, async (job: BatchJobRequest) => {
    const win = BrowserWindow.getAllWindows()[0];
    await pool.run({ kind: 'batch', payload: job, jobId: job.id }, (event) => {
      win?.webContents.send(IPC.BatchProgress, event);
    });
    logger.audit('batch.run', { files: job.inputPaths.length, steps: job.steps.map((s) => s.kind) });
  });
  handle(IPC.BatchCancel, (jobId: string) => pool.cancel(jobId));

  // ── Autosave / versions / session ──────────────────────────────
  handle(
    IPC.AutosaveWrite,
    (docPath: string, bytes: Uint8Array, reason: 'autosave' | 'manual' | 'pre-destructive') =>
      autosave.writeSnapshot(docPath, bytes, reason)
  );
  handle(IPC.VersionsList, (docPath: string) => autosave.list(docPath));
  handle(IPC.VersionsRead, (versionFile: string) => autosave.readVersion(versionFile));
  handle(IPC.VersionsDelete, (id: number) => autosave.deleteVersion(id));
  handle(IPC.SessionSave, (state: SessionState) => repos.session.save(state, false));
  handle(IPC.SessionLoad, () => repos.session.load() ?? null);
  handle(IPC.SessionMarkClean, (clean: boolean) => repos.session.markClean(clean));

  // ── Logging / audit ────────────────────────────────────────────
  handle(IPC.LogWrite, (level: LogLevel, scope: string, message: string, meta?: unknown) =>
    logger.write(level, `renderer:${scope}`, message, meta)
  );
  handle(IPC.AuditWrite, (entry: AuditEntry) => {
    logger.audit(entry.event, entry.detail);
    repos.audit.add(entry);
  });
  handle(IPC.AuditList, () => repos.audit.list());
  handle(IPC.LogsExport, async () => {
    const target = await files.showSaveDialog({
      title: 'Export Logs',
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      defaultPath: `vikings-logs-${new Date().toISOString().slice(0, 10)}.zip`
    });
    if (!target) return null;
    await logger.exportLogs(target);
    return target;
  });

  // ── AI proxy ───────────────────────────────────────────────────
  ipcMain.handle(IPC.AiProxyRequest, async (event, req: AiProxyRequest): Promise<Result<string>> => {
    try {
      const requestId = req.requestId || randomUUID();
      void aiProxy.request(event.sender, { ...req, requestId });
      return ok(requestId);
    } catch (e) {
      return wrapError(e);
    }
  });

  // ── Plugins ────────────────────────────────────────────────────
  handle(IPC.PluginsList, () => plugins.list());
  handle(IPC.PluginsReadEntry, (pluginId: string) => plugins.readEntry(pluginId));
  handle(IPC.PluginsDataGet, (pluginId: string, key: string) => repos.pluginData.get(pluginId, key));
  handle(IPC.PluginsDataSet, (pluginId: string, key: string, value: unknown) =>
    repos.pluginData.set(pluginId, key, value)
  );
  handle(IPC.PluginsOpenFolder, () => plugins.openFolder());

  // ── Updates ────────────────────────────────────────────────────
  handle(IPC.UpdateCheck, () => updates.check());
  handle(IPC.UpdateDownload, () => updates.download());
  handle(IPC.UpdateInstall, () => updates.install());

  logger.info('ipc', 'All IPC handlers registered');
}
