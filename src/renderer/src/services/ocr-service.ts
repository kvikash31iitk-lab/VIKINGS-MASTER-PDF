/**
 * OCR orchestration — renders page bitmaps, sends them to the main-process
 * tesseract service, then builds a searchable text overlay (or editable
 * text boxes) through the core engine.
 */
import { addSearchableTextLayer, groupWordsIntoLines, type OcrPageResult } from '@core/ocr/searchable-overlay';
import { composePageContent, type PlacedOp } from '@core/pdf/content-composer';
import { documentService } from './document-service';
import { pageRenderService } from './page-render-service';
import { ipc } from './ipc';
import { useOcrStore, toast } from '../stores/ui-stores';
import { useDocumentsStore } from '../stores/documents-store';
import { eventBus } from '@shared/event-bus';
import { resolvePageSelection } from '@core/pdf/utils';

export interface OcrRunOptions {
  languages: string[];
  mode: 'fast' | 'balanced' | 'accurate';
  output: 'searchable' | 'editable';
  pageRange?: string;
  /** Area OCR: restrict to a region of one page (viewer space, pt). */
  area?: { pageIndex: number; x: number; y: number; w: number; h: number };
}

const MODE_DPI: Record<OcrRunOptions['mode'], number> = { fast: 150, balanced: 220, accurate: 300 };

export const ocrService = {
  async run(docId: string, options: OcrRunOptions): Promise<void> {
    const runtime = documentService.runtime(docId);
    if (!runtime) throw new Error('Document is not open');
    const store = useOcrStore.getState();
    if (store.running) {
      toast.warning('OCR already running');
      return;
    }

    const dpi = MODE_DPI[options.mode];
    const pageIndices = options.area
      ? [options.area.pageIndex]
      : resolvePageSelection(options.pageRange, runtime.pdf.numPages);

    useOcrStore.getState().set({
      running: true,
      docId,
      page: 0,
      pageCount: pageIndices.length,
      cancelRequested: false,
      lastConfidence: null
    });

    const started = Date.now();
    const results: OcrPageResult[] = [];
    const confidences: number[] = [];
    let areaText = '';

    try {
      for (let i = 0; i < pageIndices.length; i++) {
        if (useOcrStore.getState().cancelRequested) break;
        const pageIndex = pageIndices[i]!;
        useOcrStore.getState().set({ page: i + 1 });
        eventBus.emit('ocr:progress', {
          docId,
          page: i + 1,
          pageCount: pageIndices.length,
          progress: (i / pageIndices.length) * 100
        });

        const render = await pageRenderService.renderAtDpi(docId, pageIndex, dpi);
        let png: Uint8Array;
        let imageWidth = render.widthPx;
        let imageHeight = render.heightPx;
        let offsetX = 0;
        let offsetY = 0;

        if (options.area) {
          const pxPerPt = render.widthPx / render.ptWidth;
          const sx = Math.max(0, Math.floor(options.area.x * pxPerPt));
          const sy = Math.max(0, Math.floor(options.area.y * pxPerPt));
          const sw = Math.min(render.widthPx - sx, Math.ceil(options.area.w * pxPerPt));
          const sh = Math.min(render.heightPx - sy, Math.ceil(options.area.h * pxPerPt));
          const crop = document.createElement('canvas');
          crop.width = sw;
          crop.height = sh;
          crop.getContext('2d')!.drawImage(render.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
          const blob = await new Promise<Blob | null>((r) => crop.toBlob(r, 'image/png'));
          png = new Uint8Array(await blob!.arrayBuffer());
          imageWidth = render.widthPx;
          imageHeight = render.heightPx;
          offsetX = sx;
          offsetY = sy;
        } else {
          png = await pageRenderService.renderPng(docId, pageIndex, dpi);
        }

        const recognition = await ipc.ocr.recognize(png, options.languages, options.mode);
        confidences.push(recognition.confidence);
        if (options.area) areaText += recognition.text;

        results.push({
          pageIndex,
          imageWidth,
          imageHeight,
          words: recognition.words.map((w) => ({
            ...w,
            x0: w.x0 + offsetX,
            x1: w.x1 + offsetX,
            y0: w.y0 + offsetY,
            y1: w.y1 + offsetY
          }))
        });
      }

      if (useOcrStore.getState().cancelRequested) {
        toast.info('OCR cancelled');
        return;
      }

      if (options.area) {
        // Area OCR: copy recognized text to the clipboard via a toast-visible path.
        await navigator.clipboard.writeText(areaText.trim());
        toast.success('Area OCR complete', 'Recognized text copied to clipboard');
      } else if (options.output === 'searchable') {
        await documentService.applyOperation(docId, 'OCR text layer', async (bytes) => {
          const { bytes: out, stats } = await addSearchableTextLayer(bytes, results, { minConfidence: 35 });
          toast.success('OCR complete', `${stats.wordsPlaced} words indexed across ${stats.pagesProcessed} pages`);
          return out;
        });
        useDocumentsStore.getState().update(docId, { ocrApplied: true });
      } else {
        // Editable output: place visible text boxes per recognized line.
        const ops: PlacedOp[] = [];
        for (const result of results) {
          const runtime2 = documentService.runtime(docId);
          if (!runtime2) break;
          const page = await runtime2.pdf.getPage(result.pageIndex + 1);
          const vp = page.getViewport({ scale: 1 });
          const scaleX = vp.width / result.imageWidth;
          const scaleY = vp.height / result.imageHeight;
          for (const line of groupWordsIntoLines(result.words)) {
            const fontSize = Math.max(4, (line.y1 - line.y0) * scaleY * 0.85);
            ops.push({
              pageIndex: result.pageIndex,
              op: {
                kind: 'text',
                x: line.x0 * scaleX,
                y: vp.height - line.y1 * scaleY,
                lines: [line.text],
                fontSize,
                color: '#111111',
                fontFamily: 'Helvetica'
              }
            });
          }
        }
        await documentService.applyOperation(docId, 'OCR editable text', (bytes) =>
          composePageContent(bytes, ops)
        );
        useDocumentsStore.getState().update(docId, { ocrApplied: true });
        toast.success('OCR complete', 'Editable text placed on pages');
      }

      const meta = useDocumentsStore.getState().docs.find((d) => d.id === docId);
      const meanConfidence =
        confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : undefined;
      useOcrStore.getState().set({ lastConfidence: meanConfidence ?? null });
      if (meta?.path) {
        void ipc.history.addOcr({
          filePath: meta.path,
          languages: options.languages,
          mode: options.mode,
          pageCount: pageIndices.length,
          durationMs: Date.now() - started,
          ...(meanConfidence !== undefined ? { meanConfidence } : {})
        });
      }
      eventBus.emit('ocr:done', { docId });
    } finally {
      useOcrStore.getState().set({ running: false, cancelRequested: false });
    }
  },

  cancel(): void {
    useOcrStore.getState().set({ cancelRequested: true });
  }
};
