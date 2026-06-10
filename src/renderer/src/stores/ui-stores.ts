/** Lightweight UI stores: dialogs, toasts, tool selection, search, OCR, batch, AI. */
import { create } from 'zustand';
import { uid } from '../utils';
import type {
  DialogId,
  ToolId,
  AnnotationDraft,
  ImportedComment,
  RedactionMarkDraft,
  FormFieldDraft,
  SearchResultItem,
  AiChatMessage
} from '../types';
import type { BatchProgressEvent, UpdateEventPayload } from '@shared/types';

// ───────────────────────── Dialogs ─────────────────────────

interface DialogState {
  open: DialogId | null;
  payload: unknown;
  show(id: DialogId, payload?: unknown): void;
  close(): void;
}

export const useDialogStore = create<DialogState>((set) => ({
  open: null,
  payload: undefined,
  show: (id, payload) => set({ open: id, payload }),
  close: () => set({ open: null, payload: undefined })
}));

// ───────────────────────── Toasts ─────────────────────────

export interface Toast {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error' | 'progress';
  title: string;
  detail?: string;
  progress?: number; // 0..100, undefined = indeterminate for 'progress'
  sticky?: boolean;
}

interface ToastState {
  toasts: Toast[];
  push(toast: Omit<Toast, 'id'> & { id?: string }): string;
  update(id: string, patch: Partial<Toast>): void;
  dismiss(id: string): void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = toast.id ?? uid('toast');
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== id), { ...toast, id }] }));
    if (!toast.sticky && toast.kind !== 'progress') {
      setTimeout(() => useToastStore.getState().dismiss(id), toast.kind === 'error' ? 9000 : 4500);
    }
    return id;
  },
  update: (id, patch) =>
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));

export const toast = {
  info: (title: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'info', title, ...(detail ? { detail } : {}) }),
  success: (title: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'success', title, ...(detail ? { detail } : {}) }),
  warning: (title: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'warning', title, ...(detail ? { detail } : {}) }),
  error: (title: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'error', title, ...(detail ? { detail } : {}) }),
  progress: (id: string, title: string, progress?: number) =>
    useToastStore.getState().push({
      id,
      kind: 'progress',
      title,
      sticky: true,
      ...(progress !== undefined ? { progress } : {})
    })
};

// ───────────────────────── Tool / annotation drafts ─────────────────────────

interface ToolState {
  tool: ToolId;
  color: string;
  fillColor: string | null;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  author: string;
  /** Drafts not yet committed to the PDF, keyed by doc id. */
  drafts: Record<string, AnnotationDraft[]>;
  selectedDraftId: string | null;

  setTool(tool: ToolId): void;
  setStyle(patch: Partial<Pick<ToolState, 'color' | 'fillColor' | 'strokeWidth' | 'opacity' | 'fontSize'>>): void;
  setAuthor(author: string): void;
  addDraft(docId: string, draft: AnnotationDraft): void;
  updateDraft(docId: string, id: string, patch: Partial<AnnotationDraft>): void;
  removeDraft(docId: string, id: string): void;
  clearDrafts(docId: string): void;
  selectDraft(id: string | null): void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'hand',
  color: '#d13438',
  fillColor: null,
  strokeWidth: 2,
  opacity: 1,
  fontSize: 12,
  author: 'You',
  drafts: {},
  selectedDraftId: null,

  setTool: (tool) => set({ tool }),
  setStyle: (patch) => set(patch),
  setAuthor: (author) => set({ author }),
  addDraft: (docId, draft) =>
    set((s) => ({ drafts: { ...s.drafts, [docId]: [...(s.drafts[docId] ?? []), draft] } })),
  updateDraft: (docId, id, patch) =>
    set((s) => ({
      drafts: {
        ...s.drafts,
        [docId]: (s.drafts[docId] ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d))
      }
    })),
  removeDraft: (docId, id) =>
    set((s) => ({
      drafts: { ...s.drafts, [docId]: (s.drafts[docId] ?? []).filter((d) => d.id !== id) }
    })),
  clearDrafts: (docId) => set((s) => ({ drafts: { ...s.drafts, [docId]: [] } })),
  selectDraft: (id) => set({ selectedDraftId: id })
}));

// ───────────────────────── Comments panel ─────────────────────────

interface CommentsState {
  byDoc: Record<string, ImportedComment[]>;
  filterAuthor: string | null;
  showResolved: boolean;
  setComments(docId: string, comments: ImportedComment[]): void;
  setFilterAuthor(author: string | null): void;
  setShowResolved(show: boolean): void;
}

export const useCommentsStore = create<CommentsState>((set) => ({
  byDoc: {},
  filterAuthor: null,
  showResolved: true,
  setComments: (docId, comments) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: comments } })),
  setFilterAuthor: (author) => set({ filterAuthor: author }),
  setShowResolved: (show) => set({ showResolved: show })
}));

// ───────────────────────── Redaction marks ─────────────────────────

interface RedactionState {
  byDoc: Record<string, RedactionMarkDraft[]>;
  add(docId: string, mark: RedactionMarkDraft): void;
  addMany(docId: string, marks: RedactionMarkDraft[]): void;
  remove(docId: string, id: string): void;
  clear(docId: string): void;
}

export const useRedactionStore = create<RedactionState>((set) => ({
  byDoc: {},
  add: (docId, mark) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: [...(s.byDoc[docId] ?? []), mark] } })),
  addMany: (docId, marks) =>
    set((s) => ({ byDoc: { ...s.byDoc, [docId]: [...(s.byDoc[docId] ?? []), ...marks] } })),
  remove: (docId, id) =>
    set((s) => ({ byDoc: { ...s.byDoc, [docId]: (s.byDoc[docId] ?? []).filter((m) => m.id !== id) } })),
  clear: (docId) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: [] } }))
}));

// ───────────────────────── Form designer ─────────────────────────

interface FormsState {
  byDoc: Record<string, FormFieldDraft[]>;
  selectedFieldId: string | null;
  gridSnap: boolean;
  gridSize: number;
  pendingKind: FormFieldDraft['kind'] | null;
  add(docId: string, field: FormFieldDraft): void;
  update(docId: string, id: string, patch: Partial<FormFieldDraft>): void;
  remove(docId: string, id: string): void;
  clear(docId: string): void;
  select(id: string | null): void;
  setGridSnap(on: boolean): void;
  setPendingKind(kind: FormFieldDraft['kind'] | null): void;
}

export const useFormsStore = create<FormsState>((set) => ({
  byDoc: {},
  selectedFieldId: null,
  gridSnap: true,
  gridSize: 8,
  pendingKind: null,
  add: (docId, field) =>
    set((s) => ({ byDoc: { ...s.byDoc, [docId]: [...(s.byDoc[docId] ?? []), field] }, selectedFieldId: field.id })),
  update: (docId, id, patch) =>
    set((s) => ({
      byDoc: { ...s.byDoc, [docId]: (s.byDoc[docId] ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)) }
    })),
  remove: (docId, id) =>
    set((s) => ({
      byDoc: { ...s.byDoc, [docId]: (s.byDoc[docId] ?? []).filter((f) => f.id !== id) },
      selectedFieldId: null
    })),
  clear: (docId) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: [] } })),
  select: (id) => set({ selectedFieldId: id }),
  setGridSnap: (on) => set({ gridSnap: on }),
  setPendingKind: (kind) => set({ pendingKind: kind })
}));

// ───────────────────────── Search ─────────────────────────

interface SearchState {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
  allDocs: boolean;
  results: SearchResultItem[];
  activeIndex: number;
  findBarVisible: boolean;
  searching: boolean;
  set(patch: Partial<Omit<SearchState, 'set'>>): void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  allDocs: false,
  results: [],
  activeIndex: -1,
  findBarVisible: false,
  searching: false,
  set: (patch) => set(patch)
}));

// ───────────────────────── OCR ─────────────────────────

interface OcrState {
  running: boolean;
  docId: string | null;
  page: number;
  pageCount: number;
  cancelRequested: boolean;
  lastConfidence: number | null;
  set(patch: Partial<Omit<OcrState, 'set'>>): void;
}

export const useOcrStore = create<OcrState>((set) => ({
  running: false,
  docId: null,
  page: 0,
  pageCount: 0,
  cancelRequested: false,
  lastConfidence: null,
  set: (patch) => set(patch)
}));

// ───────────────────────── Batch ─────────────────────────

interface BatchState {
  running: boolean;
  jobId: string | null;
  events: BatchProgressEvent[];
  set(patch: Partial<Omit<BatchState, 'set' | 'appendEvent'>>): void;
  appendEvent(e: BatchProgressEvent): void;
}

export const useBatchStore = create<BatchState>((set) => ({
  running: false,
  jobId: null,
  events: [],
  set: (patch) => set(patch),
  appendEvent: (e) =>
    set((s) => ({
      events: [...s.events.slice(-199), e],
      running: e.status !== 'done' && e.status !== 'cancelled' ? s.running : false
    }))
}));

// ───────────────────────── AI assistant ─────────────────────────

interface AiState {
  conversations: Record<string, AiChatMessage[]>;
  busy: boolean;
  append(docKey: string, message: AiChatMessage): void;
  patchMessage(docKey: string, id: string, patch: Partial<AiChatMessage>): void;
  appendToMessage(docKey: string, id: string, chunk: string): void;
  setBusy(busy: boolean): void;
  clear(docKey: string): void;
}

export const useAiStore = create<AiState>((set) => ({
  conversations: {},
  busy: false,
  append: (docKey, message) =>
    set((s) => ({
      conversations: { ...s.conversations, [docKey]: [...(s.conversations[docKey] ?? []), message] }
    })),
  patchMessage: (docKey, id, patch) =>
    set((s) => ({
      conversations: {
        ...s.conversations,
        [docKey]: (s.conversations[docKey] ?? []).map((m) => (m.id === id ? { ...m, ...patch } : m))
      }
    })),
  appendToMessage: (docKey, id, chunk) =>
    set((s) => ({
      conversations: {
        ...s.conversations,
        [docKey]: (s.conversations[docKey] ?? []).map((m) =>
          m.id === id ? { ...m, content: m.content + chunk } : m
        )
      }
    })),
  setBusy: (busy) => set({ busy }),
  clear: (docKey) => set((s) => ({ conversations: { ...s.conversations, [docKey]: [] } }))
}));

// ───────────────────────── Updates ─────────────────────────

interface UpdateState {
  status: UpdateEventPayload | null;
  set(status: UpdateEventPayload): void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: null,
  set: (status) => set({ status })
}));
