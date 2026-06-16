/**
 * Redaction orchestration — geometry mapping for search/pattern marks and
 * the apply step that rasterizes marked pages with regions destroyed.
 */
import { findPatternMatches, findSearchMatches, applyRedactions } from '@core/pdf/redaction';
import type { CensoredPage } from '@core/pdf/redaction';
import { documentService } from './document-service';
import { pageRenderService } from './page-render-service';
import { useRedactionStore, useToastStore, toast } from '../stores/ui-stores';
import { useSettingsStore } from '../stores/settings-store';
import { ipc } from './ipc';
import { uid } from '../utils';
import type { RedactionMarkDraft } from '../types';

/**
 * Maps a character range in a page's text to bounding rectangles using the
 * positioned text items (viewer space, y-down).
 */
async function rangeToRects(
  docId: string,
  pageIndex: number,
  start: number,
  end: number
): Promise<Array<{ x: number; y: number; w: number; h: number }>> {
  const runtime = documentService.runtime(docId);
  if (!runtime) return [];
  const items = await documentService.textItems(docId, pageIndex);
  const page = await runtime.pdf.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale: 1 });

  // Rebuild the page text exactly as the index does, tracking item offsets.
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  let offset = 0;
  for (const item of items) {
    const text = item.str;
    const len = text.length + 1; // separator space appended by extractor
    const itemStart = offset;
    const itemEnd = offset + text.length;
    offset += len;
    if (itemEnd <= start || itemStart >= end) continue;

    const overlapStart = Math.max(start, itemStart) - itemStart;
    const overlapEnd = Math.min(end, itemEnd) - itemStart;
    const fraction = text.length > 0 ? (overlapEnd - overlapStart) / text.length : 1;
    const xFraction = text.length > 0 ? overlapStart / text.length : 0;
    const h = item.height * 1.25;
    rects.push({
      x: item.x + item.width * xFraction,
      y: vp.height - item.y - item.height, // flip to y-down, top of glyphs
      w: Math.max(2, item.width * fraction),
      h
    });
  }
  return rects;
}

export const redactionService = {
  /** Marks every match of a literal/regex search for redaction. */
  async markSearch(
    docId: string,
    query: string,
    options: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }
  ): Promise<number> {
    const runtime = documentService.runtime(docId);
    if (!runtime) return 0;
    const marks: RedactionMarkDraft[] = [];
    for (let p = 0; p < runtime.pdf.numPages; p++) {
      const text = await documentService.pageText(docId, p);
      for (const m of findSearchMatches(text, query, options)) {
        for (const r of await rangeToRects(docId, p, m.start, m.end)) {
          marks.push({ id: uid('redact'), pageIndex: p, ...r, source: `search:${query}` });
        }
      }
    }
    useRedactionStore.getState().addMany(docId, marks);
    return marks.length;
  },

  /** Marks built-in pattern matches (email/phone/aadhaar/pan/credit-card). */
  async markPatterns(docId: string, patternIds: string[]): Promise<number> {
    const runtime = documentService.runtime(docId);
    if (!runtime) return 0;
    const marks: RedactionMarkDraft[] = [];
    for (let p = 0; p < runtime.pdf.numPages; p++) {
      const text = await documentService.pageText(docId, p);
      for (const m of findPatternMatches(text, patternIds)) {
        for (const r of await rangeToRects(docId, p, m.start, m.end)) {
          marks.push({ id: uid('redact'), pageIndex: p, ...r, source: `pattern:${m.patternId}` });
        }
      }
    }
    useRedactionStore.getState().addMany(docId, marks);
    return marks.length;
  },

  /** Applies all pending marks — content on marked pages is destroyed. */
  async apply(docId: string): Promise<void> {
    const marks = useRedactionStore.getState().byDoc[docId] ?? [];
    if (marks.length === 0) {
      toast.warning('No redaction marks', 'Mark areas, search hits or patterns first.');
      return;
    }
    const dpi = useSettingsStore.getState().settings.security.redactionDpi || 300;
    const byPage = new Map<number, RedactionMarkDraft[]>();
    for (const m of marks) {
      const list = byPage.get(m.pageIndex) ?? [];
      list.push(m);
      byPage.set(m.pageIndex, list);
    }

    const progressId = toast.progress('redact', 'Applying redactions…');
    try {
      const censored: CensoredPage[] = [];
      for (const [pageIndex, pageMarks] of byPage) {
        const { png } = await pageRenderService.renderCensored(
          docId,
          pageIndex,
          dpi,
          pageMarks.map((m) => ({ x: m.x, y: m.y, w: m.w, h: m.h }))
        );
        censored.push({ pageIndex, imageBytes: png, imageFormat: 'png' });
      }
      await documentService.applyOperation(docId, 'Apply redactions', (bytes) =>
        applyRedactions(bytes, censored)
      );
      useRedactionStore.getState().clear(docId);
      void ipc.log.audit({
        event: 'sec.redact',
        detail: { pages: [...byPage.keys()].map((p) => p + 1), marks: marks.length }
      });
      toast.success('Redactions applied', `${marks.length} region(s) permanently removed on ${byPage.size} page(s)`);
    } finally {
      useToastStore.getState().dismiss(progressId);
    }
  }
};
