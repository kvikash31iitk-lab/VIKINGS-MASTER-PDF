/**
 * Typed IPC client — wraps window.vikings, unwraps Result envelopes into
 * resolved values or thrown AppErrors. The only renderer module that talks
 * to the bridge directly.
 */
import { IPC } from '@shared/ipc-channels';
import type { Result } from '@shared/result';
import type {
  AppInfo,
  WindowState,
  OpenDialogRequest,
  SaveDialogRequest,
  FileStatInfo,
  RecentFileEntry,
  EncryptRequest,
  DecryptRequest,
  SignRequest,
  SignatureVerificationResult,
  HtmlToPdfRequest,
  OfficeToPdfRequest,
  ClipboardPdfContent,
  PrintRequest,
  BatchJobRequest,
  BatchProgressEvent,
  VersionEntry,
  SessionState,
  TemplateMeta,
  SavedSignature,
  StampDefinition,
  OcrHistoryEntry,
  AiHistoryEntry,
  AuditEntry,
  LogLevel,
  AiProxyRequest,
  AiProxyChunk,
  PluginRecord,
  UpdateEventPayload
} from '@shared/types';
import type { AppSettings } from '@shared/settings-schema';

export class IpcError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'IpcError';
  }
}

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await window.vikings.invoke(channel, ...args)) as Result<T>;
  if (result.ok) return result.value;
  throw new IpcError(result.error.code, result.error.message, result.error.detail);
}

function on<T>(channel: string, listener: (payload: T) => void): () => void {
  return window.vikings.on(channel, listener as (payload: unknown) => void);
}

interface OcrRecognizeResponse {
  words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; confidence: number }>;
  text: string;
  confidence: number;
}

export const ipc = {
  app: {
    getInfo: () => call<AppInfo>(IPC.AppGetInfo),
    quit: () => call<void>(IPC.AppQuit),
    relaunch: () => call<void>(IPC.AppRelaunch)
  },
  win: {
    minimize: () => call<void>(IPC.WinMinimize),
    toggleMaximize: () => call<void>(IPC.WinToggleMaximize),
    isMaximized: () => call<boolean>(IPC.WinIsMaximized),
    close: () => call<void>(IPC.WinClose),
    setFullscreen: (flag: boolean) => call<void>(IPC.WinSetFullscreen, flag),
    onStateChanged: (fn: (s: WindowState) => void) => on(IPC.WinStateChanged, fn)
  },
  files: {
    openDialog: (req: OpenDialogRequest = {}) => call<string[] | null>(IPC.FileOpenDialog, req),
    saveDialog: (req: SaveDialogRequest = {}) => call<string | null>(IPC.FileSaveDialog, req),
    read: (path: string) => call<Uint8Array>(IPC.FileRead, path),
    write: (path: string, bytes: Uint8Array) => call<void>(IPC.FileWrite, path, bytes),
    stat: (path: string) => call<FileStatInfo | null>(IPC.FileStat, path),
    showInFolder: (path: string) => call<void>(IPC.FileShowInFolder, path),
    openPath: (path: string) => call<string>(IPC.FileOpenPath, path),
    onOpenedExternally: (fn: (path: string) => void) => on(IPC.FileOpenedExternally, fn)
  },
  recents: {
    list: () => call<RecentFileEntry[]>(IPC.RecentList),
    add: (entry: { path: string; title: string; pageCount: number; fileSize: number }) =>
      call<void>(IPC.RecentAdd, entry),
    remove: (path: string) => call<void>(IPC.RecentRemove, path),
    setPinned: (path: string, pinned: boolean) => call<void>(IPC.RecentSetPinned, path, pinned),
    setFavorite: (path: string, favorite: boolean) => call<void>(IPC.RecentSetFavorite, path, favorite),
    updatePosition: (path: string, page: number, zoom: number) =>
      call<void>(IPC.RecentUpdatePosition, path, page, zoom),
    clear: () => call<void>(IPC.RecentClear)
  },
  settings: {
    getAll: () => call<AppSettings>(IPC.SettingsGetAll),
    set: (key: string, value: unknown) => call<void>(IPC.SettingsSet, key, value),
    reset: () => call<AppSettings>(IPC.SettingsReset),
    onChanged: (fn: (e: { key: string; value: unknown }) => void) => on(IPC.SettingsChanged, fn)
  },
  galleries: {
    templates: {
      list: () => call<TemplateMeta[]>(IPC.TemplatesList),
      getData: (id: string) => call<Uint8Array>(IPC.TemplatesGetData, id),
      save: (meta: Omit<TemplateMeta, 'createdAt'>, data: Uint8Array) =>
        call<void>(IPC.TemplatesSave, meta, data),
      remove: (id: string) => call<void>(IPC.TemplatesDelete, id)
    },
    signatures: {
      list: () => call<SavedSignature[]>(IPC.SignaturesList),
      save: (sig: Omit<SavedSignature, 'createdAt'>) => call<void>(IPC.SignaturesSave, sig),
      remove: (id: string) => call<void>(IPC.SignaturesDelete, id)
    },
    stamps: {
      list: () => call<StampDefinition[]>(IPC.StampsList),
      save: (stamp: Omit<StampDefinition, 'createdAt'>) => call<void>(IPC.StampsSave, stamp),
      remove: (id: string) => call<void>(IPC.StampsDelete, id)
    }
  },
  history: {
    addOcr: (entry: OcrHistoryEntry) => call<void>(IPC.OcrHistoryAdd, entry),
    listOcr: () => call<OcrHistoryEntry[]>(IPC.OcrHistoryList),
    addAi: (entry: AiHistoryEntry) => call<void>(IPC.AiHistoryAdd, entry),
    listAi: () => call<AiHistoryEntry[]>(IPC.AiHistoryList)
  },
  ocr: {
    recognize: (imagePng: Uint8Array, languages: string[], mode: 'fast' | 'balanced' | 'accurate') =>
      call<OcrRecognizeResponse>(IPC.OcrRecognize, { imagePng, languages, mode }),
    listCachedLanguages: () => call<string[]>(IPC.OcrListCachedLanguages)
  },
  pdf: {
    encrypt: (req: EncryptRequest) => call<Uint8Array>(IPC.PdfEncrypt, req),
    decrypt: (req: DecryptRequest) => call<Uint8Array>(IPC.PdfDecrypt, req),
    sign: (req: SignRequest) => call<Uint8Array>(IPC.PdfSign, req),
    verifySignatures: (bytes: Uint8Array) =>
      call<SignatureVerificationResult[]>(IPC.PdfVerifySignatures, bytes),
    mergeFiles: (files: Uint8Array[]) => call<Uint8Array>(IPC.PdfMergeFiles, files)
  },
  convert: {
    htmlToPdf: (req: HtmlToPdfRequest) => call<Uint8Array>(IPC.ConvertHtmlToPdf, req),
    officeToPdf: (req: OfficeToPdfRequest) =>
      call<{ path: string; bytes: Uint8Array }>(IPC.ConvertOfficeToPdf, req),
    probeOffice: () => call<{ available: boolean; path?: string }>(IPC.ConvertProbeOffice),
    readClipboard: () => call<ClipboardPdfContent>(IPC.ClipboardReadForPdf)
  },
  print: (req: PrintRequest) => call<void>(IPC.PrintPdf, req),
  batch: {
    run: (job: BatchJobRequest) => call<void>(IPC.BatchRun, job),
    cancel: (jobId: string) => call<void>(IPC.BatchCancel, jobId),
    onProgress: (fn: (e: BatchProgressEvent) => void) => on(IPC.BatchProgress, fn)
  },
  versions: {
    write: (docPath: string, bytes: Uint8Array, reason: VersionEntry['reason']) =>
      call<string>(IPC.AutosaveWrite, docPath, bytes, reason),
    list: (docPath: string) => call<VersionEntry[]>(IPC.VersionsList, docPath),
    read: (versionFile: string) => call<Uint8Array>(IPC.VersionsRead, versionFile),
    remove: (id: number) => call<void>(IPC.VersionsDelete, id)
  },
  session: {
    save: (state: SessionState) => call<void>(IPC.SessionSave, state),
    load: () => call<{ state: SessionState; cleanExit: boolean } | null>(IPC.SessionLoad),
    markClean: (clean: boolean) => call<void>(IPC.SessionMarkClean, clean)
  },
  log: {
    write: (level: LogLevel, scope: string, message: string, meta?: unknown) =>
      call<void>(IPC.LogWrite, level, scope, message, meta),
    audit: (entry: AuditEntry) => call<void>(IPC.AuditWrite, entry),
    listAudit: () => call<AuditEntry[]>(IPC.AuditList),
    exportLogs: () => call<string | null>(IPC.LogsExport)
  },
  ai: {
    request: (req: AiProxyRequest) => call<string>(IPC.AiProxyRequest, req),
    onChunk: (fn: (chunk: AiProxyChunk) => void) => on(IPC.AiProxyChunk, fn)
  },
  plugins: {
    list: () => call<PluginRecord[]>(IPC.PluginsList),
    readEntry: (pluginId: string) => call<string>(IPC.PluginsReadEntry, pluginId),
    dataGet: (pluginId: string, key: string) => call<unknown>(IPC.PluginsDataGet, pluginId, key),
    dataSet: (pluginId: string, key: string, value: unknown) =>
      call<void>(IPC.PluginsDataSet, pluginId, key, value),
    openFolder: () => call<void>(IPC.PluginsOpenFolder)
  },
  updates: {
    check: () => call<void>(IPC.UpdateCheck),
    download: () => call<void>(IPC.UpdateDownload),
    install: () => call<void>(IPC.UpdateInstall),
    onEvent: (fn: (e: UpdateEventPayload) => void) => on(IPC.UpdateEvent, fn)
  }
};

/** Renderer logger that forwards to the main rotating logs (fire-and-forget). */
export const rlog = {
  info: (scope: string, msg: string, meta?: unknown) => void ipc.log.write('info', scope, msg, meta).catch(() => undefined),
  warn: (scope: string, msg: string, meta?: unknown) => void ipc.log.write('warn', scope, msg, meta).catch(() => undefined),
  error: (scope: string, msg: string, meta?: unknown) => void ipc.log.write('error', scope, msg, meta).catch(() => undefined)
};
