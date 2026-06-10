/** Search orchestration across the active document or every open tab. */
import { searchAcrossDocuments } from '@core/search/text-index';
import { documentService } from './document-service';
import { useSearchStore } from '../stores/ui-stores';
import { useDocumentsStore } from '../stores/documents-store';
import { eventBus } from '@shared/event-bus';
import type { SearchResultItem } from '../types';

export const searchService = {
  async run(): Promise<void> {
    const s = useSearchStore.getState();
    if (!s.query) {
      useSearchStore.getState().set({ results: [], activeIndex: -1 });
      return;
    }
    useSearchStore.getState().set({ searching: true });
    try {
      const docsState = useDocumentsStore.getState();
      const targets = s.allDocs
        ? docsState.docs
        : docsState.docs.filter((d) => d.id === docsState.activeId);

      const indexed = [];
      for (const meta of targets) {
        const index = await documentService.ensureFullTextIndex(meta.id);
        indexed.push({ docId: meta.id, title: meta.title, index });
      }
      const hits = searchAcrossDocuments(indexed, s.query, {
        caseSensitive: s.caseSensitive,
        wholeWord: s.wholeWord,
        regex: s.regex
      });
      const results: SearchResultItem[] = hits.map((h) => ({
        docId: h.docId,
        pageIndex: h.pageIndex,
        start: h.start,
        end: h.end,
        snippet: h.snippet,
        snippetHighlight: h.snippetHighlight
      }));
      useSearchStore.getState().set({ results, activeIndex: results.length > 0 ? 0 : -1 });
      const active = useDocumentsStore.getState().activeId;
      if (active) eventBus.emit('search:results', { docId: active, total: results.length });
      if (results.length > 0) this.goTo(0);
    } finally {
      useSearchStore.getState().set({ searching: false });
    }
  },

  goTo(index: number): void {
    const s = useSearchStore.getState();
    if (s.results.length === 0) return;
    const wrapped = ((index % s.results.length) + s.results.length) % s.results.length;
    const hit = s.results[wrapped]!;
    useSearchStore.getState().set({ activeIndex: wrapped });
    const docsState = useDocumentsStore.getState();
    if (docsState.activeId !== hit.docId) docsState.setActive(hit.docId);
    useDocumentsStore.getState().updateView(hit.docId, { page: hit.pageIndex + 1 });
    eventBus.emit('page:changed', { docId: hit.docId, page: hit.pageIndex + 1 });
  },

  next(): void {
    const s = useSearchStore.getState();
    this.goTo(s.activeIndex + 1);
  },

  previous(): void {
    const s = useSearchStore.getState();
    this.goTo(s.activeIndex - 1);
  },

  clear(): void {
    useSearchStore.getState().set({ query: '', results: [], activeIndex: -1, findBarVisible: false });
  }
};
