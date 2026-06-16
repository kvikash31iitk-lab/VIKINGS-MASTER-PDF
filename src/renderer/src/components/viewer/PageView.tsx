/**
 * PageView — one mounted page: raster canvas, selectable text layer,
 * search highlights, redaction marks, form-designer layer and the
 * interactive annotation overlay.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { documentService } from '../../services/document-service';
import { renderPageToCanvas } from '../../services/pdfjs';
import type { SimpleTextItem } from '../../services/pdfjs';
import { useSearchStore, useRedactionStore, useToolStore } from '../../stores/ui-stores';
import { useDocumentsStore } from '../../stores/documents-store';
import { AnnotationOverlay } from './AnnotationOverlay';
import { FormDesignerLayer } from './FormDesignerLayer';
import type { PageLayout } from '../../types';
import { EMPTY } from '../../utils';

// A glyph's ink sits mostly above the baseline: its ascent is roughly this
// fraction of the font height. Placing each text-layer span this far above the
// baseline (rather than a full font height) lines the invisible selectable
// glyphs up with the rasterised page, so selection rects — and the
// highlight/underline/strikeout marks derived from them — cover the real text
// instead of floating above it.
const GLYPH_ASCENT_RATIO = 0.8;

export const PageView = memo(function PageView({
  docId,
  layout,
  zoom,
  renderZoom,
  renderNonce,
  onActualSize
}: {
  docId: string;
  layout: PageLayout;
  zoom: number;
  renderZoom: number;
  renderNonce: number;
  onActualSize: (pageIndex: number, size: { width: number; height: number }) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [textItems, setTextItems] = useState<SimpleTextItem[]>([]);
  const [rendered, setRendered] = useState(false);
  const renderedZoomRef = useRef(0);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const workspaceMode = useDocumentsStore((s) => s.workspaceMode);
  const tool = useToolStore((s) => s.tool);

  // ── Raster render (re-renders when settled zoom or the document changes) ──
  const renderedNonceRef = useRef(-1);
  useEffect(() => {
    let cancelled = false;
    // Abort any render still running for this page slot before starting a new one.
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    void (async () => {
      const runtime = documentService.runtime(docId);
      if (!runtime) return;
      if (
        Math.abs(renderedZoomRef.current - renderZoom) < 0.001 &&
        renderedNonceRef.current === renderNonce &&
        rendered
      ) {
        return;
      }
      try {
        const page = await runtime.pdf.getPage(layout.pageIndex + 1);
        const vp = page.getViewport({ scale: 1 });
        onActualSize(layout.pageIndex, { width: vp.width, height: vp.height });
        const canvas = await renderPageToCanvas(page, renderZoom, {
          ...(runtime.ocConfig ? { ocConfig: runtime.ocConfig } : {}),
          onRenderTask: (task) => {
            renderTaskRef.current = task;
          }
        });
        if (cancelled) return;
        renderTaskRef.current = null;
        renderedZoomRef.current = renderZoom;
        renderedNonceRef.current = renderNonce;
        const host = canvasHostRef.current;
        if (host) {
          host.replaceChildren(canvas);
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          setRendered(true);
        }
      } catch {
        /* render cancelled mid-flight (scroll/zoom/tab close) — RenderingCancelledException */
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, layout.pageIndex, renderZoom, renderNonce]);

  // ── Text layer items ──
  useEffect(() => {
    let cancelled = false;
    void documentService.textItems(docId, layout.pageIndex).then((items) => {
      if (!cancelled) setTextItems(items);
    });
    return () => {
      cancelled = true;
    };
  }, [docId, layout.pageIndex, renderNonce]);

  const scale = zoom;
  const textSelectable = tool === 'text-select' || tool === 'highlight' || tool === 'underline' || tool === 'strikeout' || tool === 'squiggly';

  return (
    <div
      ref={hostRef}
      data-page-index={layout.pageIndex}
      className="vk-page-shadow absolute bg-white"
      style={{ top: layout.top, left: layout.left, width: layout.width, height: layout.height }}
    >
      <div ref={canvasHostRef} className="absolute inset-0 overflow-hidden" aria-hidden="true" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-app-accent border-t-transparent" />
        </div>
      )}

      {/* Text layer (PDF pt → CSS px via scale) */}
      <div
        className="vk-textlayer"
        style={{ pointerEvents: textSelectable ? 'auto' : 'none' }}
        data-page-text-layer={layout.pageIndex}
      >
        {textItems.map((item, i) => (
          <span
            key={i}
            style={{
              left: item.x * scale,
              top: (layout.ptHeight - item.y - item.height * GLYPH_ASCENT_RATIO) * scale,
              fontSize: Math.max(1, item.height * scale),
              fontFamily: 'sans-serif'
            }}
          >
            {item.str}
          </span>
        ))}
      </div>

      <SearchHighlights docId={docId} pageIndex={layout.pageIndex} ptHeight={layout.ptHeight} scale={scale} />
      <RedactionMarks docId={docId} pageIndex={layout.pageIndex} scale={scale} />
      {workspaceMode === 'forms' && (
        <FormDesignerLayer docId={docId} pageIndex={layout.pageIndex} scale={scale} />
      )}
      <AnnotationOverlay
        docId={docId}
        pageIndex={layout.pageIndex}
        widthCss={layout.width}
        heightCss={layout.height}
        scale={scale}
        ptHeight={layout.ptHeight}
      />
    </div>
  );
});

// ───────────────────────── Search highlights ─────────────────────────

function SearchHighlights({
  docId,
  pageIndex,
  ptHeight,
  scale
}: {
  docId: string;
  pageIndex: number;
  ptHeight: number;
  scale: number;
}) {
  const results = useSearchStore((s) => s.results);
  const activeIndex = useSearchStore((s) => s.activeIndex);
  const [rects, setRects] = useState<Array<{ x: number; y: number; w: number; h: number; active: boolean }>>([]);

  useEffect(() => {
    let cancelled = false;
    const pageHits = results
      .map((r, i) => ({ ...r, i }))
      .filter((r) => r.docId === docId && r.pageIndex === pageIndex);
    if (pageHits.length === 0) {
      setRects([]);
      return;
    }
    void (async () => {
      const items = await documentService.textItems(docId, pageIndex);
      if (cancelled) return;
      const out: Array<{ x: number; y: number; w: number; h: number; active: boolean }> = [];
      for (const hit of pageHits) {
        let offset = 0;
        for (const item of items) {
          const itemStart = offset;
          const itemEnd = offset + item.str.length;
          offset += item.str.length + 1;
          if (itemEnd <= hit.start || itemStart >= hit.end) continue;
          const from = Math.max(hit.start, itemStart) - itemStart;
          const to = Math.min(hit.end, itemEnd) - itemStart;
          const fraction = item.str.length > 0 ? (to - from) / item.str.length : 1;
          const xFraction = item.str.length > 0 ? from / item.str.length : 0;
          out.push({
            x: item.x + item.width * xFraction,
            y: ptHeight - item.y - item.height,
            w: Math.max(2, item.width * fraction),
            h: item.height * 1.25,
            active: hit.i === activeIndex
          });
        }
      }
      setRects(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [results, activeIndex, docId, pageIndex, ptHeight]);

  return (
    <>
      {rects.map((r, i) => (
        <div
          key={i}
          className={`vk-search-highlight${r.active ? ' active' : ''}`}
          style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale }}
        />
      ))}
    </>
  );
}

// ───────────────────────── Redaction marks ─────────────────────────

function RedactionMarks({ docId, pageIndex, scale }: { docId: string; pageIndex: number; scale: number }) {
  const marks = useRedactionStore((s) => s.byDoc[docId] ?? EMPTY);
  const remove = useRedactionStore((s) => s.remove);
  const pageMarks = marks.filter((m) => m.pageIndex === pageIndex);
  return (
    <>
      {pageMarks.map((m) => (
        <div
          key={m.id}
          className="vk-redact-mark"
          title={`Redaction (${m.source}) — click to remove`}
          onClick={() => remove(docId, m.id)}
          style={{ left: m.x * scale, top: m.y * scale, width: m.w * scale, height: m.h * scale }}
        />
      ))}
    </>
  );
}
