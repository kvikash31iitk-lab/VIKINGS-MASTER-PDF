/**
 * Single source of truth for every IPC channel.
 * Preload allow-lists exactly these values; anything else is rejected.
 */
export const IPC = {
  // App / window
  AppGetInfo: 'app:get-info',
  AppQuit: 'app:quit',
  AppRelaunch: 'app:relaunch',
  WinMinimize: 'win:minimize',
  WinToggleMaximize: 'win:toggle-maximize',
  WinIsMaximized: 'win:is-maximized',
  WinClose: 'win:close',
  WinSetFullscreen: 'win:set-fullscreen',
  WinStateChanged: 'win:state-changed', // main → renderer

  // File system (all paths validated main-side)
  FileOpenDialog: 'file:open-dialog',
  FileSaveDialog: 'file:save-dialog',
  FileRead: 'file:read',
  FileWrite: 'file:write',
  FileStat: 'file:stat',
  FileShowInFolder: 'file:show-in-folder',
  FileOpenPath: 'file:open-path',
  FileOpenedExternally: 'file:opened-externally', // main → renderer (OS double-click)

  // Recent files / pins / favorites
  RecentList: 'recent:list',
  RecentAdd: 'recent:add',
  RecentRemove: 'recent:remove',
  RecentSetPinned: 'recent:set-pinned',
  RecentSetFavorite: 'recent:set-favorite',
  RecentUpdatePosition: 'recent:update-position',
  RecentClear: 'recent:clear',

  // Settings
  SettingsGetAll: 'settings:get-all',
  SettingsSet: 'settings:set',
  SettingsReset: 'settings:reset',
  SettingsChanged: 'settings:changed', // main → renderer broadcast

  // Templates / signatures / stamps (SQLite-backed galleries)
  TemplatesList: 'templates:list',
  TemplatesGetData: 'templates:get-data',
  TemplatesSave: 'templates:save',
  TemplatesDelete: 'templates:delete',
  SignaturesList: 'signatures:list',
  SignaturesSave: 'signatures:save',
  SignaturesDelete: 'signatures:delete',
  StampsList: 'stamps:list',
  StampsSave: 'stamps:save',
  StampsDelete: 'stamps:delete',

  // History tables
  OcrHistoryAdd: 'ocr-history:add',
  OcrHistoryList: 'ocr-history:list',
  AiHistoryAdd: 'ai-history:add',
  AiHistoryList: 'ai-history:list',

  // Heavy PDF operations (main-side worker pool)
  PdfEncrypt: 'pdf:encrypt',
  PdfDecrypt: 'pdf:decrypt',
  PdfSign: 'pdf:sign',
  PdfVerifySignatures: 'pdf:verify-signatures',
  PdfMergeFiles: 'pdf:merge-files',
  PdfJobProgress: 'pdf:job-progress', // main → renderer

  // Conversion helpers that need main-process capabilities
  ConvertHtmlToPdf: 'convert:html-to-pdf',
  ConvertOfficeToPdf: 'convert:office-to-pdf',
  ConvertProbeOffice: 'convert:probe-office',
  ClipboardReadForPdf: 'clipboard:read-for-pdf',

  // Printing
  PrintPdf: 'print:pdf',

  // Batch engine
  BatchRun: 'batch:run',
  BatchCancel: 'batch:cancel',
  BatchProgress: 'batch:progress', // main → renderer

  // Autosave / versions / session
  AutosaveWrite: 'autosave:write',
  VersionsList: 'versions:list',
  VersionsRead: 'versions:read',
  VersionsDelete: 'versions:delete',
  SessionSave: 'session:save',
  SessionLoad: 'session:load',
  SessionMarkClean: 'session:mark-clean',

  // Logging / audit
  LogWrite: 'log:write',
  AuditWrite: 'audit:write',
  AuditList: 'audit:list',
  LogsExport: 'logs:export',

  // AI proxy (renderer never performs network IO)
  AiProxyRequest: 'ai:proxy-request',
  AiProxyChunk: 'ai:proxy-chunk', // main → renderer (stream)

  // Plugins
  PluginsList: 'plugins:list',
  PluginsReadEntry: 'plugins:read-entry',
  PluginsDataGet: 'plugins:data-get',
  PluginsDataSet: 'plugins:data-set',
  PluginsOpenFolder: 'plugins:open-folder',

  // Auto update
  UpdateCheck: 'update:check',
  UpdateDownload: 'update:download',
  UpdateInstall: 'update:install',
  UpdateEvent: 'update:event' // main → renderer
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

/** Channels the renderer may invoke (request/response). */
export const INVOKE_CHANNELS: ReadonlySet<string> = new Set(
  Object.values(IPC).filter(
    (c) =>
      ![
        IPC.WinStateChanged,
        IPC.FileOpenedExternally,
        IPC.SettingsChanged,
        IPC.PdfJobProgress,
        IPC.BatchProgress,
        IPC.AiProxyChunk,
        IPC.UpdateEvent
      ].includes(c as never)
  )
);

/** Channels the renderer may subscribe to (main → renderer push). */
export const EVENT_CHANNELS: ReadonlySet<string> = new Set([
  IPC.WinStateChanged,
  IPC.FileOpenedExternally,
  IPC.SettingsChanged,
  IPC.PdfJobProgress,
  IPC.BatchProgress,
  IPC.AiProxyChunk,
  IPC.UpdateEvent
]);
