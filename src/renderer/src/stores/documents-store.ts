/**
 * Open documents — metadata + per-document view state. Heavy objects
 * (PDF.js proxies, raw bytes) live in DocumentService, keyed by doc id.
 */
import { create } from 'zustand';
import type { OpenDocumentMeta, DocViewState, WorkspaceMode } from '../types';

interface DocumentsState {
  docs: OpenDocumentMeta[];
  activeId: string | null;
  workspaceMode: WorkspaceMode;
  /** Multi-select in Organize mode (page indices of the active doc). */
  selectedPages: number[];

  add(meta: OpenDocumentMeta): void;
  remove(id: string): void;
  setActive(id: string | null): void;
  update(id: string, patch: Partial<Omit<OpenDocumentMeta, 'id' | 'view'>>): void;
  updateView(id: string, patch: Partial<DocViewState>): void;
  setWorkspaceMode(mode: WorkspaceMode): void;
  setSelectedPages(pages: number[]): void;
  togglePageSelection(pageIndex: number, additive: boolean): void;
}

export const useDocumentsStore = create<DocumentsState>((set) => ({
  docs: [],
  activeId: null,
  workspaceMode: 'view',
  selectedPages: [],

  add: (meta) =>
    set((s) => ({
      docs: [...s.docs.filter((d) => d.id !== meta.id), meta],
      activeId: meta.id,
      selectedPages: []
    })),

  remove: (id) =>
    set((s) => {
      const docs = s.docs.filter((d) => d.id !== id);
      const activeId =
        s.activeId === id ? (docs.length > 0 ? docs[docs.length - 1]!.id : null) : s.activeId;
      return { docs, activeId, selectedPages: [] };
    }),

  setActive: (id) => set({ activeId: id, selectedPages: [] }),

  update: (id, patch) =>
    set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

  updateView: (id, patch) =>
    set((s) => ({
      docs: s.docs.map((d) => (d.id === id ? { ...d, view: { ...d.view, ...patch } } : d))
    })),

  setWorkspaceMode: (mode) => set({ workspaceMode: mode, selectedPages: [] }),

  setSelectedPages: (pages) => set({ selectedPages: pages }),

  togglePageSelection: (pageIndex, additive) =>
    set((s) => {
      const has = s.selectedPages.includes(pageIndex);
      if (!additive) return { selectedPages: has && s.selectedPages.length === 1 ? [] : [pageIndex] };
      return {
        selectedPages: has
          ? s.selectedPages.filter((p) => p !== pageIndex)
          : [...s.selectedPages, pageIndex].sort((a, b) => a - b)
      };
    })
}));

export const activeDoc = (): OpenDocumentMeta | null => {
  const s = useDocumentsStore.getState();
  return s.docs.find((d) => d.id === s.activeId) ?? null;
};

export const useActiveDoc = (): OpenDocumentMeta | null =>
  useDocumentsStore((s) => s.docs.find((d) => d.id === s.activeId) ?? null);
