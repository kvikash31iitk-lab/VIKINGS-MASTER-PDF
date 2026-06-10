/** Renderer domain types. */

export type ViewMode = 'continuous' | 'single' | 'facing' | 'book';

export type WorkspaceMode = 'view' | 'organize' | 'forms' | 'redact';

export type ToolId =
  | 'hand'
  | 'select'
  | 'text-select'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'squiggly'
  | 'note'
  | 'pencil'
  | 'marker'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'cloud'
  | 'callout'
  | 'textbox'
  | 'edit-text'
  | 'add-text'
  | 'add-image'
  | 'whiteout'
  | 'link'
  | 'stamp'
  | 'signature-place'
  | 'redact-area'
  | 'crop';

export interface DocViewState {
  page: number; // 1-based current page
  zoom: number;
  zoomMode: 'custom' | 'fit-width' | 'fit-page';
  viewMode: ViewMode;
  rotationDelta: number;
}

export interface OpenDocumentMeta {
  id: string;
  title: string;
  path?: string;
  pageCount: number;
  fileSize: number;
  dirty: boolean;
  encrypted: boolean;
  signed: boolean;
  ocrApplied: boolean;
  view: DocViewState;
}

/** Page geometry in CSS pixels for the virtualizer. */
export interface PageLayout {
  pageIndex: number;
  top: number;
  left: number;
  width: number;
  height: number;
  /** Native page size in PDF points. */
  ptWidth: number;
  ptHeight: number;
}

/**
 * Annotation draft in *viewer space*: PDF points with origin at the page's
 * TOP-left (y down) — convenient for canvas overlays. Converted to PDF
 * coordinate space (y up) when committed by the annotation service.
 */
export interface AnnotationDraft {
  id: string;
  pageIndex: number;
  kind:
    | 'highlight'
    | 'underline'
    | 'strikeout'
    | 'squiggly'
    | 'note'
    | 'ink'
    | 'marker'
    | 'line'
    | 'arrow'
    | 'rect'
    | 'ellipse'
    | 'cloud'
    | 'callout'
    | 'textbox';
  color: string;
  opacity: number;
  strokeWidth: number;
  author: string;
  contents: string;
  createdAt: number;
  /** Geometry by kind (viewer space, PDF points, y-down). */
  rects?: Array<{ x: number; y: number; w: number; h: number }>; // markup quads
  points?: number[][]; // ink paths [x,y,x,y…]
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number; // line/arrow
  rect?: { x: number; y: number; w: number; h: number }; // shapes / textbox / note anchor
  fontSize?: number;
  lines?: string[];
  calloutTarget?: { x: number; y: number };
}

export interface ImportedComment {
  id: string;
  pageIndex: number;
  subtype: string;
  author: string;
  contents: string;
  modified: string;
  inReplyTo?: string;
  resolved: boolean;
  isDraft: boolean;
}

export interface RedactionMarkDraft {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number; // viewer space (pt, y-down)
  source: string;
}

export interface FormFieldDraft {
  id: string;
  kind: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'listbox' | 'date' | 'signature';
  name: string;
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number; // viewer space (pt, y-down)
  options: string[];
  required: boolean;
  multiline: boolean;
}

export interface SearchResultItem {
  docId: string;
  pageIndex: number;
  start: number;
  end: number;
  snippet: string;
  snippetHighlight: [number, number];
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export type DialogId =
  | 'watermark'
  | 'header-footer'
  | 'bates'
  | 'stamp'
  | 'encrypt'
  | 'remove-security'
  | 'redact'
  | 'sign'
  | 'verify-signatures'
  | 'ocr'
  | 'convert-export'
  | 'create-pdf'
  | 'compress'
  | 'pdfa'
  | 'split'
  | 'merge'
  | 'insert-pages'
  | 'crop'
  | 'compare'
  | 'batch'
  | 'form-field'
  | 'link'
  | 'password-prompt'
  | 'save-changes'
  | 'settings'
  | 'shortcuts'
  | 'about'
  | 'version-history'
  | 'template-picker'
  | 'signature-manager'
  | 'document-properties'
  | 'metadata-edit'
  | 'attach-file'
  | 'go-to-page'
  | 'plugin-manager'
  | 'audit-log';

export interface DialogRequest {
  id: DialogId;
  payload?: unknown;
}
