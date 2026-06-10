/**
 * Shared DTOs crossing the IPC boundary. Keep these JSON-serializable
 * (binary payloads travel as Uint8Array, which structured clone supports).
 */

// ───────────────────────────── App / window ─────────────────────────────

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: NodeJS.Platform;
  userDataPath: string;
  logsPath: string;
}

export interface WindowState {
  maximized: boolean;
  fullscreen: boolean;
  focused: boolean;
}

// ───────────────────────────── Files ─────────────────────────────

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenDialogRequest {
  title?: string;
  filters?: FileFilter[];
  multi?: boolean;
  defaultPath?: string;
}

export interface SaveDialogRequest {
  title?: string;
  filters?: FileFilter[];
  defaultPath?: string;
}

export interface FileStatInfo {
  path: string;
  size: number;
  mtimeMs: number;
  isFile: boolean;
}

export interface RecentFileEntry {
  path: string;
  title: string;
  pageCount: number;
  fileSize: number;
  pinned: boolean;
  favorite: boolean;
  lastPage: number;
  lastZoom: number;
  openedAt: number;
}

// ───────────────────────────── Security ─────────────────────────────

export type EncryptionAlgorithm = 'aes-256' | 'aes-128';

export interface PdfPermissionFlags {
  printing: boolean;
  copying: boolean;
  modifying: boolean;
  annotating: boolean;
  formFilling: boolean;
}

export interface EncryptRequest {
  bytes: Uint8Array;
  algorithm: EncryptionAlgorithm;
  userPassword: string;
  ownerPassword: string;
  permissions: PdfPermissionFlags;
}

export interface DecryptRequest {
  bytes: Uint8Array;
  password: string;
}

export interface SignRequest {
  bytes: Uint8Array;
  /** PKCS#12 container (certificate + private key). */
  p12: Uint8Array;
  passphrase: string;
  reason?: string;
  location?: string;
  contactInfo?: string;
  /** Optional visible signature placement. */
  visible?: {
    pageIndex: number;
    rect: { x: number; y: number; width: number; height: number };
    imagePng?: Uint8Array;
    label?: string;
  };
}

export interface SignatureVerificationResult {
  fieldName: string;
  signerName: string;
  signedAt?: string;
  reason?: string;
  location?: string;
  intact: boolean;
  coversWholeDocument: boolean;
  certificateSubject: string;
  certificateIssuer: string;
  certificateValidFrom: string;
  certificateValidTo: string;
  errors: string[];
}

// ───────────────────────────── Conversion / print ─────────────────────────────

export interface HtmlToPdfRequest {
  html?: string;
  url?: string;
  landscape?: boolean;
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'A3';
  marginsMm?: number;
}

export interface OfficeToPdfRequest {
  inputPath: string;
  outputDir: string;
}

export interface ClipboardPdfContent {
  text?: string;
  imagePng?: Uint8Array;
}

export interface PrintRequest {
  /** Path of the PDF to print; if absent, bytes are written to a temp file. */
  path?: string;
  bytes?: Uint8Array;
  silent?: boolean;
  copies?: number;
}

// ───────────────────────────── Batch ─────────────────────────────

export type BatchStepKind =
  | 'watermark'
  | 'header-footer'
  | 'bates'
  | 'encrypt'
  | 'compress'
  | 'merge-into'
  | 'rename';

export interface BatchStep {
  kind: BatchStepKind;
  options: Record<string, unknown>;
}

export interface BatchJobRequest {
  id: string;
  inputPaths: string[];
  outputDir: string;
  steps: BatchStep[];
  /** rename pattern tokens: {name} {n} {date} */
  renamePattern?: string;
}

export interface BatchProgressEvent {
  jobId: string;
  filePath: string;
  fileIndex: number;
  fileCount: number;
  stepKind?: BatchStepKind;
  status: 'running' | 'file-done' | 'file-error' | 'done' | 'cancelled';
  message?: string;
}

// ───────────────────────────── Versions / session ─────────────────────────────

export interface VersionEntry {
  id: number;
  docPath: string;
  versionFile: string;
  reason: 'autosave' | 'manual' | 'pre-destructive';
  fileSize: number;
  createdAt: number;
}

export interface SessionDocState {
  path: string;
  page: number;
  zoom: number;
  viewMode: string;
  /** autosave snapshot to recover unsaved changes after a crash */
  recoveryFile?: string;
  dirty: boolean;
}

export interface SessionState {
  openDocs: SessionDocState[];
  activePath?: string;
}

// ───────────────────────────── Galleries ─────────────────────────────

export interface TemplateMeta {
  id: string;
  name: string;
  category: 'blank' | 'letterhead' | 'invoice' | 'form' | 'custom';
  description?: string;
  createdAt: number;
}

export interface SavedSignature {
  id: string;
  name: string;
  kind: 'draw' | 'type' | 'upload';
  imagePng: Uint8Array;
  createdAt: number;
}

export interface StampDefinition {
  id: string;
  name: string;
  text: string;
  color: string;
  borderStyle: 'solid' | 'double' | 'none';
  fontSize: number;
  createdAt: number;
}

// ───────────────────────────── History / audit ─────────────────────────────

export interface OcrHistoryEntry {
  id?: number;
  filePath: string;
  languages: string[];
  mode: 'fast' | 'balanced' | 'accurate';
  pageCount: number;
  durationMs: number;
  meanConfidence?: number;
  createdAt?: number;
}

export interface AiHistoryEntry {
  id?: number;
  docPath?: string;
  provider: string;
  action: 'summarize' | 'keypoints' | 'actions' | 'faq' | 'chat';
  prompt: string;
  response: string;
  createdAt?: number;
}

export interface AuditEntry {
  id?: number;
  event: string;
  detail?: Record<string, unknown>;
  createdAt?: number;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ───────────────────────────── AI proxy ─────────────────────────────

export interface AiProxyRequest {
  /** Correlation id; chunks stream back tagged with it. */
  requestId: string;
  url: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: string;
  stream: boolean;
  timeoutMs?: number;
}

export interface AiProxyChunk {
  requestId: string;
  kind: 'chunk' | 'done' | 'error';
  data?: string;
  status?: number;
  error?: string;
}

// ───────────────────────────── Plugins ─────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;
  permissions: Array<'commands' | 'ribbon' | 'panels' | 'exporters' | 'tools' | 'ocr' | 'ai' | 'storage'>;
  enabled?: boolean;
}

export interface PluginRecord {
  manifest: PluginManifest;
  directory: string;
  error?: string;
}

// ───────────────────────────── Updates ─────────────────────────────

export interface UpdateEventPayload {
  state: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

// ───────────────────────────── Worker job envelope ─────────────────────────────

export type PdfWorkerJob =
  | { kind: 'encrypt'; payload: EncryptRequest }
  | { kind: 'decrypt'; payload: DecryptRequest }
  | { kind: 'sign'; payload: SignRequest }
  | { kind: 'verify'; payload: { bytes: Uint8Array } }
  | { kind: 'merge'; payload: { files: Uint8Array[] } };

export interface PdfWorkerResult {
  jobId: string;
  ok: boolean;
  bytes?: Uint8Array;
  verifications?: SignatureVerificationResult[];
  error?: string;
}
