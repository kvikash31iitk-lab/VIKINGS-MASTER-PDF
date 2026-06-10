/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDocumentsStore } from '@renderer/stores/documents-store';
import { useDialogStore, useToolStore, useSearchStore, useToastStore, useRedactionStore, useFormsStore } from '@renderer/stores/ui-stores';
import type { OpenDocumentMeta } from '@renderer/types';

const meta = (id: string): OpenDocumentMeta => ({
  id,
  title: `${id}.pdf`,
  pageCount: 10,
  fileSize: 1000,
  dirty: false,
  encrypted: false,
  signed: false,
  ocrApplied: false,
  view: { page: 1, zoom: 1, zoomMode: 'fit-width', viewMode: 'continuous', rotationDelta: 0 }
});

beforeEach(() => {
  useDocumentsStore.setState({ docs: [], activeId: null, workspaceMode: 'view', selectedPages: [] });
  useDialogStore.setState({ open: null, payload: undefined });
  useToolStore.setState({ drafts: {}, tool: 'hand', selectedDraftId: null });
  useToastStore.setState({ toasts: [] });
});

describe('documents store', () => {
  it('adds documents and tracks the active one', () => {
    const s = useDocumentsStore.getState();
    s.add(meta('a'));
    s.add(meta('b'));
    expect(useDocumentsStore.getState().docs).toHaveLength(2);
    expect(useDocumentsStore.getState().activeId).toBe('b');
  });

  it('removes a document and falls back to the last remaining tab', () => {
    const s = useDocumentsStore.getState();
    s.add(meta('a'));
    s.add(meta('b'));
    s.remove('b');
    expect(useDocumentsStore.getState().activeId).toBe('a');
    s.remove('a');
    expect(useDocumentsStore.getState().activeId).toBeNull();
  });

  it('updates view state per document', () => {
    const s = useDocumentsStore.getState();
    s.add(meta('a'));
    s.updateView('a', { page: 5, zoom: 2 });
    const doc = useDocumentsStore.getState().docs[0]!;
    expect(doc.view.page).toBe(5);
    expect(doc.view.zoom).toBe(2);
    expect(doc.view.viewMode).toBe('continuous'); // untouched
  });

  it('toggles page selection with and without additive mode', () => {
    const s = useDocumentsStore.getState();
    s.add(meta('a'));
    s.togglePageSelection(2, false);
    expect(useDocumentsStore.getState().selectedPages).toEqual([2]);
    s.togglePageSelection(5, true);
    expect(useDocumentsStore.getState().selectedPages).toEqual([2, 5]);
    s.togglePageSelection(2, true);
    expect(useDocumentsStore.getState().selectedPages).toEqual([5]);
    s.togglePageSelection(7, false);
    expect(useDocumentsStore.getState().selectedPages).toEqual([7]);
  });
});

describe('dialog store', () => {
  it('shows one dialog at a time with payload', () => {
    useDialogStore.getState().show('watermark', { x: 1 });
    expect(useDialogStore.getState().open).toBe('watermark');
    expect(useDialogStore.getState().payload).toEqual({ x: 1 });
    useDialogStore.getState().show('encrypt');
    expect(useDialogStore.getState().open).toBe('encrypt');
    useDialogStore.getState().close();
    expect(useDialogStore.getState().open).toBeNull();
  });
});

describe('tool store drafts', () => {
  const draft = {
    id: 'd1',
    pageIndex: 0,
    kind: 'rect' as const,
    color: '#ff0000',
    opacity: 1,
    strokeWidth: 2,
    author: 'QA',
    contents: '',
    createdAt: Date.now(),
    rect: { x: 10, y: 10, w: 50, h: 30 }
  };

  it('adds, patches and removes drafts per document', () => {
    const s = useToolStore.getState();
    s.addDraft('doc1', draft);
    expect(useToolStore.getState().drafts.doc1).toHaveLength(1);
    s.updateDraft('doc1', 'd1', { rect: { x: 20, y: 20, w: 50, h: 30 } });
    expect(useToolStore.getState().drafts.doc1![0]!.rect!.x).toBe(20);
    s.removeDraft('doc1', 'd1');
    expect(useToolStore.getState().drafts.doc1).toHaveLength(0);
  });

  it('clears drafts only for the targeted document', () => {
    const s = useToolStore.getState();
    s.addDraft('doc1', draft);
    s.addDraft('doc2', { ...draft, id: 'd2' });
    s.clearDrafts('doc1');
    expect(useToolStore.getState().drafts.doc1).toHaveLength(0);
    expect(useToolStore.getState().drafts.doc2).toHaveLength(1);
  });
});

describe('toast store', () => {
  it('replaces toasts sharing an id and dismisses', () => {
    vi.useFakeTimers();
    const id = useToastStore.getState().push({ id: 'job', kind: 'progress', title: 'Working', sticky: true });
    useToastStore.getState().push({ id: 'job', kind: 'progress', title: 'Still working', sticky: true });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]!.title).toBe('Still working');
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });

  it('auto-dismisses non-sticky toasts', () => {
    vi.useFakeTimers();
    useToastStore.getState().push({ kind: 'success', title: 'Saved' });
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe('redaction & forms stores', () => {
  it('accumulates and clears redaction marks', () => {
    const s = useRedactionStore.getState();
    s.add('doc1', { id: 'r1', pageIndex: 0, x: 0, y: 0, w: 10, h: 10, source: 'manual' });
    s.addMany('doc1', [
      { id: 'r2', pageIndex: 1, x: 0, y: 0, w: 10, h: 10, source: 'pattern:email' },
      { id: 'r3', pageIndex: 1, x: 5, y: 5, w: 10, h: 10, source: 'search:foo' }
    ]);
    expect(useRedactionStore.getState().byDoc.doc1).toHaveLength(3);
    s.remove('doc1', 'r2');
    expect(useRedactionStore.getState().byDoc.doc1).toHaveLength(2);
    s.clear('doc1');
    expect(useRedactionStore.getState().byDoc.doc1).toHaveLength(0);
  });

  it('manages form field drafts and selection', () => {
    const s = useFormsStore.getState();
    s.add('doc1', {
      id: 'f1', kind: 'text', name: 'name', pageIndex: 0,
      x: 0, y: 0, w: 100, h: 24, options: [], required: false, multiline: false
    });
    expect(useFormsStore.getState().selectedFieldId).toBe('f1');
    s.update('doc1', 'f1', { name: 'fullName', required: true });
    expect(useFormsStore.getState().byDoc.doc1![0]!.name).toBe('fullName');
    s.remove('doc1', 'f1');
    expect(useFormsStore.getState().byDoc.doc1).toHaveLength(0);
    expect(useFormsStore.getState().selectedFieldId).toBeNull();
  });
});

describe('search store', () => {
  it('holds query options and results', () => {
    useSearchStore.getState().set({ query: 'fox', caseSensitive: true, results: [], activeIndex: -1 });
    expect(useSearchStore.getState().query).toBe('fox');
    expect(useSearchStore.getState().caseSensitive).toBe(true);
  });
});
