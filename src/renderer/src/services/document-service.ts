/**
 * DocumentService — owns the heavy per-document state the store must not
 * hold: raw bytes, PDF.js proxies, undo history, text index. Every PDF
 * mutation flows through applyOperation(): bytes-in → bytes-out → reload.
 */
import { loadPdf, extractPageText, extractTextItems, PasswordRequiredError } from './pdfjs';
import type { PDFDocumentProxy, SimpleTextItem } from './pdfjs';
import { TextIndex } from '@core/search/text-index';
import type { PdfOpDescriptor } from '@core/pdf/op-runner';
import { readBasicInfo } from '@core/pdf/page-ops';
import { ipc, rlog } from './ipc';
import { eventBus } from '@shared/event-bus';
import { useDocumentsStore } from '../stores/documents-store';
import { useCommentsStore, toast } from '../stores/ui-stores';
import { useSettingsStore } from '../stores/settings-store';
import { uid, baseName } from '../utils';
import { PDF_FILTERS } from '@shared/constants';
import type { ImportedComment, OpenDocumentMeta } from '../types';

interface HistoryEntry {
  bytes: Uint8Array;
  label: string;
}

class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  constructor(private limit: number) {}

  push(bytes: Uint8Array, label: string): void {
    this.undoStack.push({ bytes, label });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  undo(current: Uint8Array): HistoryEntry | null {
    const prev = this.undoStack.pop();
    if (!prev) return null;
    this.redoStack.push({ bytes: current, label: prev.label });
    return prev;
  }
  redo(current: Uint8Array): HistoryEntry | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push({ bytes: current, label: next.label });
    return next;
  }
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}

export interface DocumentRuntime {
  id: string;
  bytes: Uint8Array;
  pdf: PDFDocumentProxy;
  history: HistoryManager;
  textIndex: TextIndex;
  /** Pages whose text has been indexed. */
  indexedPages: Set<number>;
  textItemsCache: Map<number, SimpleTextItem[]>;
  password?: string;
  /** Optional content (layers) visibility configuration. */
  ocConfig?: unknown;
}

class DocumentService {
  private runtimes = new Map<string, DocumentRuntime>();
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;

  runtime(docId: string): DocumentRuntime | undefined {
    return this.runtimes.get(docId);
  }

  activeRuntime(): DocumentRuntime | undefined {
    const id = useDocumentsStore.getState().activeId;
    return id ? this.runtimes.get(id) : undefined;
  }

  // ───────────────────────── Open / close ─────────────────────────

  async openFromPath(path: string, password?: string): Promise<string> {
    const existing = [...this.runtimes.values()].find(
      (r) => useDocumentsStore.getState().docs.find((d) => d.id === r.id)?.path === path
    );
    if (existing) {
      useDocumentsStore.getState().setActive(existing.id);
      return existing.id;
    }
    const bytes = await ipc.files.read(path);
    const id = await this.openFromBytes(bytes, { path, title: baseName(path), password });
    void ipc.recents.add({
      path,
      title: baseName(path),
      pageCount: this.runtimes.get(id)?.pdf.numPages ?? 0,
      fileSize: bytes.length
    });
    return id;
  }

  async openFromBytes(
    bytes: Uint8Array,
    options: { path?: string; title?: string; password?: string } = {}
  ): Promise<string> {
    let pdf: PDFDocumentProxy;
    try {
      pdf = (await loadPdf(bytes, options.password)).doc;
    } catch (e) {
      if (e instanceof PasswordRequiredError) throw e;
      throw new Error(`Could not open PDF: ${(e as Error).message}`);
    }

    const id = uid('doc');
    const limit = useSettingsStore.getState().settings.performance.undoHistoryLimit || 30;
    const runtime: DocumentRuntime = {
      id,
      bytes,
      pdf,
      history: new HistoryManager(limit),
      textIndex: new TextIndex(),
      indexedPages: new Set(),
      textItemsCache: new Map(),
      ...(options.password !== undefined ? { password: options.password } : {})
    };
    this.runtimes.set(id, runtime);

    let encrypted = false;
    try {
      encrypted = (await readBasicInfo(bytes)).encrypted;
    } catch {
      encrypted = options.password !== undefined;
    }

    const meta: OpenDocumentMeta = {
      id,
      title: options.title ?? 'Untitled.pdf',
      ...(options.path ? { path: options.path } : {}),
      pageCount: pdf.numPages,
      fileSize: bytes.length,
      dirty: false,
      encrypted,
      signed: false,
      ocrApplied: false,
      view: {
        page: 1,
        zoom: 1,
        zoomMode: 'fit-width',
        viewMode: useSettingsStore.getState().settings.viewer.defaultViewMode,
        rotationDelta: 0
      }
    };
    useDocumentsStore.getState().add(meta);
    eventBus.emit('document:opened', { docId: id, ...(options.path ? { path: options.path } : {}), pageCount: pdf.numPages });
    void this.importComments(id);
    this.ensureAutosaveLoop();
    rlog.info('documents', `Opened ${meta.title} (${pdf.numPages} pages)`);
    return id;
  }

  async close(docId: string): Promise<void> {
    const runtime = this.runtimes.get(docId);
    if (runtime) {
      await runtime.pdf.destroy().catch(() => undefined);
      this.runtimes.delete(docId);
    }
    // Stop the autosave loop once the last document closes; it restarts on open.
    if (this.runtimes.size === 0 && this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    useDocumentsStore.getState().remove(docId);
    eventBus.emit('document:closed', { docId });
  }

  // ───────────────────────── Mutation pipeline ─────────────────────────

  /**
   * Runs a bytes→bytes operation in the renderer, records undo history, reloads
   * the PDF.js document and marks the tab dirty. Use this only for operations
   * that need renderer-only context (e.g. PDF.js page proxies); pure pdf-lib
   * mutations should use applyServerOp so they run off the UI thread.
   *
   * `changedPages` lets a structure-preserving edit invalidate only the caches
   * of the pages it touched; omit it for structural edits (insert/delete/
   * reorder) so all page caches are rebuilt.
   */
  async applyOperation(
    docId: string,
    label: string,
    op: (bytes: Uint8Array) => Promise<Uint8Array>,
    changedPages?: number[]
  ): Promise<void> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) throw new Error('Document is not open');
    const before = runtime.bytes;
    const after = await op(before);
    await this.finalize(runtime, before, label, after, changedPages);
  }

  /**
   * Like applyOperation, but the mutation runs in the main-process worker pool
   * (off the renderer's UI thread). The descriptor must be structured-clone
   * serializable — see PdfOpDescriptor / runPdfOp.
   */
  async applyServerOp(
    docId: string,
    label: string,
    op: PdfOpDescriptor,
    changedPages?: number[]
  ): Promise<void> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) throw new Error('Document is not open');
    const before = runtime.bytes;
    const after = await ipc.pdf.applyOp({ bytes: before, op });
    await this.finalize(runtime, before, label, after, changedPages);
  }

  private async finalize(
    runtime: DocumentRuntime,
    before: Uint8Array,
    label: string,
    after: Uint8Array,
    changedPages?: number[]
  ): Promise<void> {
    runtime.history.push(before, label);
    await this.swapBytes(runtime, after, changedPages);
    useDocumentsStore.getState().update(runtime.id, { dirty: true, fileSize: after.length });
    eventBus.emit('document:modified', { docId: runtime.id });
  }

  private async swapBytes(
    runtime: DocumentRuntime,
    bytes: Uint8Array,
    changedPages?: number[]
  ): Promise<void> {
    const old = runtime.pdf;
    const { doc } = await loadPdf(bytes, runtime.password);
    runtime.bytes = bytes;
    runtime.pdf = doc;
    if (changedPages && changedPages.length > 0 && doc.numPages === old.numPages) {
      // Structure-preserving edit: only rebuild the touched pages' caches.
      for (const p of changedPages) {
        runtime.indexedPages.delete(p);
        runtime.textItemsCache.delete(p);
        runtime.textIndex.clearPage(p);
      }
    } else {
      runtime.textIndex = new TextIndex();
      runtime.indexedPages.clear();
      runtime.textItemsCache.clear();
    }
    await old.destroy().catch(() => undefined);
    useDocumentsStore.getState().update(runtime.id, { pageCount: doc.numPages });
    const view = useDocumentsStore.getState().docs.find((d) => d.id === runtime.id)?.view;
    if (view && view.page > doc.numPages) {
      useDocumentsStore.getState().updateView(runtime.id, { page: doc.numPages });
    }
    eventBus.emit('document:reloaded', { docId: runtime.id });
    void this.importComments(runtime.id);
  }

  async undo(docId: string): Promise<void> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) return;
    const entry = runtime.history.undo(runtime.bytes);
    if (!entry) return;
    await this.swapBytes(runtime, entry.bytes);
    useDocumentsStore.getState().update(docId, { dirty: true });
    toast.info(`Undo: ${entry.label}`);
  }

  async redo(docId: string): Promise<void> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) return;
    const entry = runtime.history.redo(runtime.bytes);
    if (!entry) return;
    await this.swapBytes(runtime, entry.bytes);
    useDocumentsStore.getState().update(docId, { dirty: true });
    toast.info(`Redo: ${entry.label}`);
  }

  canUndo(docId: string): boolean {
    return this.runtimes.get(docId)?.history.canUndo ?? false;
  }
  canRedo(docId: string): boolean {
    return this.runtimes.get(docId)?.history.canRedo ?? false;
  }

  /** Layer (OCG) visibility config used by page renders. */
  setOcConfig(docId: string, config: unknown): void {
    const runtime = this.runtimes.get(docId);
    if (runtime) runtime.ocConfig = config;
  }

  // ───────────────────────── Save ─────────────────────────

  async save(docId: string): Promise<boolean> {
    const meta = useDocumentsStore.getState().docs.find((d) => d.id === docId);
    const runtime = this.runtimes.get(docId);
    if (!meta || !runtime) return false;
    if (!meta.path) return this.saveAs(docId);
    await ipc.files.write(meta.path, runtime.bytes);
    useDocumentsStore.getState().update(docId, { dirty: false });
    eventBus.emit('document:saved', { docId, path: meta.path });
    toast.success('Saved', meta.title);
    return true;
  }

  async saveAs(docId: string): Promise<boolean> {
    const meta = useDocumentsStore.getState().docs.find((d) => d.id === docId);
    const runtime = this.runtimes.get(docId);
    if (!meta || !runtime) return false;
    const target = await ipc.files.saveDialog({
      title: 'Save As',
      filters: PDF_FILTERS,
      defaultPath: meta.path ?? meta.title
    });
    if (!target) return false;
    await ipc.files.write(target, runtime.bytes);
    useDocumentsStore.getState().update(docId, {
      dirty: false,
      path: target,
      title: baseName(target)
    } as Partial<OpenDocumentMeta>);
    void ipc.recents.add({
      path: target,
      title: baseName(target),
      pageCount: meta.pageCount,
      fileSize: runtime.bytes.length
    });
    eventBus.emit('document:saved', { docId, path: target });
    toast.success('Saved', baseName(target));
    return true;
  }

  // ───────────────────────── Text / search ─────────────────────────

  async pageText(docId: string, pageIndex: number): Promise<string> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) return '';
    if (!runtime.indexedPages.has(pageIndex)) {
      const page = await runtime.pdf.getPage(pageIndex + 1);
      const text = await extractPageText(page);
      runtime.textIndex.setPage(pageIndex, text);
      runtime.indexedPages.add(pageIndex);
    }
    return runtime.textIndex.getPage(pageIndex) ?? '';
  }

  async ensureFullTextIndex(docId: string): Promise<TextIndex> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) throw new Error('Document is not open');
    for (let i = 0; i < runtime.pdf.numPages; i++) {
      if (!runtime.indexedPages.has(i)) await this.pageText(docId, i);
    }
    return runtime.textIndex;
  }

  async allPagesText(docId: string): Promise<Array<{ pageIndex: number; text: string }>> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) return [];
    await this.ensureFullTextIndex(docId);
    const out: Array<{ pageIndex: number; text: string }> = [];
    for (let i = 0; i < runtime.pdf.numPages; i++) {
      out.push({ pageIndex: i, text: runtime.textIndex.getPage(i) ?? '' });
    }
    return out;
  }

  async textItems(docId: string, pageIndex: number): Promise<SimpleTextItem[]> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) return [];
    const cached = runtime.textItemsCache.get(pageIndex);
    if (cached) return cached;
    const page = await runtime.pdf.getPage(pageIndex + 1);
    const items = await extractTextItems(page);
    runtime.textItemsCache.set(pageIndex, items);
    return items;
  }

  // ───────────────────────── Comments import ─────────────────────────

  async importComments(docId: string): Promise<void> {
    const runtime = this.runtimes.get(docId);
    if (!runtime) return;
    const comments: ImportedComment[] = [];
    const replies = new Map<string, string>(); // id → state (Review replies)
    try {
      for (let p = 1; p <= runtime.pdf.numPages; p++) {
        const page = await runtime.pdf.getPage(p);
        const annots = (await page.getAnnotations()) as Array<Record<string, unknown>>;
        for (const a of annots) {
          const subtype = String(a.subtype ?? '');
          if (['Link', 'Widget', 'Popup'].includes(subtype)) continue;
          const id = String(a.id ?? uid('annot'));
          const contents = typeof a.contentsObj === 'object' && a.contentsObj
            ? String((a.contentsObj as { str?: string }).str ?? '')
            : String(a.contents ?? '');
          const author = typeof a.titleObj === 'object' && a.titleObj
            ? String((a.titleObj as { str?: string }).str ?? '')
            : String(a.title ?? '');
          const inReplyTo = a.inReplyTo ? String(a.inReplyTo) : undefined;
          const state = a.state ? String(a.state) : undefined;
          if (inReplyTo && state) {
            replies.set(inReplyTo, state);
            continue;
          }
          comments.push({
            id,
            pageIndex: p - 1,
            subtype,
            author,
            contents,
            modified: String(a.modificationDate ?? ''),
            ...(inReplyTo ? { inReplyTo } : {}),
            resolved: false,
            isDraft: false
          });
        }
      }
      for (const c of comments) {
        if (replies.get(c.id) === 'Completed' || replies.get(c.id) === 'Accepted') c.resolved = true;
      }
      useCommentsStore.getState().setComments(docId, comments);
    } catch (e) {
      rlog.warn('documents', 'Comment import failed', { error: (e as Error).message });
    }
  }

  // ───────────────────────── Autosave / session ─────────────────────────

  private ensureAutosaveLoop(): void {
    if (this.autosaveTimer) return;
    const minutes = useSettingsStore.getState().settings.autosave.intervalMinutes || 5;
    this.autosaveTimer = setInterval(() => void this.autosaveTick(), minutes * 60_000);
  }

  private async autosaveTick(): Promise<void> {
    if (!useSettingsStore.getState().settings.autosave.enabled) return;
    for (const meta of useDocumentsStore.getState().docs) {
      if (!meta.dirty || !meta.path) continue;
      const runtime = this.runtimes.get(meta.id);
      if (!runtime) continue;
      try {
        await ipc.versions.write(meta.path, runtime.bytes, 'autosave');
      } catch (e) {
        rlog.warn('autosave', 'Snapshot failed', { error: (e as Error).message });
      }
    }
    void this.persistSession();
  }

  async persistSession(): Promise<void> {
    const docs = useDocumentsStore.getState().docs;
    const active = useDocumentsStore.getState().activeId;
    const activePath = docs.find((d) => d.id === active)?.path;
    await ipc.session
      .save({
        openDocs: docs
          .filter((d) => d.path)
          .map((d) => ({
            path: d.path!,
            page: d.view.page,
            zoom: d.view.zoom,
            viewMode: d.view.viewMode,
            dirty: d.dirty
          })),
        ...(activePath ? { activePath } : {})
      })
      .catch(() => undefined);
  }

  async restoreSession(): Promise<number> {
    try {
      const session = await ipc.session.load();
      if (!session || session.state.openDocs.length === 0) return 0;
      let restored = 0;
      for (const docState of session.state.openDocs) {
        try {
          const id = await this.openFromPath(docState.path);
          useDocumentsStore.getState().updateView(id, {
            page: docState.page,
            zoom: docState.zoom,
            viewMode: docState.viewMode as OpenDocumentMeta['view']['viewMode']
          });
          restored++;
        } catch {
          /* file moved/deleted — skip */
        }
      }
      return restored;
    } catch {
      return 0;
    }
  }
}

export const documentService = new DocumentService();
