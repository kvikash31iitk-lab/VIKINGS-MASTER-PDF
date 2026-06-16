/**
 * PdfViewer — virtualized page workspace. Only pages intersecting the
 * viewport (± overscan) mount; layout adapts to continuous / single /
 * facing / book modes; zoom supports fit-width / fit-page / custom.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentsStore } from '../../stores/documents-store';
import { documentService } from '../../services/document-service';
import { eventBus } from '@shared/event-bus';
import { PageView } from './PageView';
import { FindBar } from './FindBar';
import type { OpenDocumentMeta, PageLayout } from '../../types';
import { clamp, debounce } from '../../utils';
import { MIN_ZOOM, MAX_ZOOM } from '@shared/constants';

const GAP = 18;
const PADDING = 24;
const OVERSCAN = 2;

interface PageSizePt {
  width: number;
  height: number;
}

export function PdfViewer({ doc }: { doc: OpenDocumentMeta }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateView = useDocumentsStore((s) => s.updateView);
  const [sizes, setSizes] = useState<PageSizePt[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0, scrollTop: 0 });
  const scrollLock = useRef<{ target: number | null }>({ target: null });
  // Page number we ourselves derived from the user's scroll position. The
  // "scroll to page" effect skips these so it never yanks the view while the
  // user is scrolling; it only acts on external navigation (thumbnail, go-to,
  // search).
  const scrollOriginPage = useRef(0);
  const scrollRaf = useRef(0);
  const [renderZoom, setRenderZoom] = useState(doc.view.zoom);
  const [renderNonce, setRenderNonce] = useState(0);

  // Re-render pages after document mutations (ops, undo/redo, layer toggles).
  useEffect(
    () =>
      eventBus.on('document:reloaded', ({ docId }) => {
        if (docId === doc.id) setRenderNonce((n) => n + 1);
      }),
    [doc.id]
  );

  // ── Page sizes: first page seeds the estimate; visible pages refine it. ──
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      const first = await runtime.pdf.getPage(1);
      const vp = first.getViewport({ scale: 1 });
      if (!cancelled) {
        setSizes(Array.from({ length: doc.pageCount }, () => ({ width: vp.width, height: vp.height })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.pageCount]);

  const reportActualSize = useCallback((pageIndex: number, size: PageSizePt) => {
    setSizes((prev) => {
      const cur = prev[pageIndex];
      if (!cur || (Math.abs(cur.width - size.width) < 0.5 && Math.abs(cur.height - size.height) < 0.5)) {
        return prev;
      }
      const next = [...prev];
      next[pageIndex] = size;
      return next;
    });
  }, []);

  // ── Viewport tracking ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = (): void =>
      setViewport((v) => ({ ...v, width: el.clientWidth, height: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Effective zoom (fit modes derive from container + page size) ──
  const zoom = useMemo(() => {
    const base = sizes[0] ?? { width: 612, height: 792 };
    const columns = doc.view.viewMode === 'facing' || doc.view.viewMode === 'book' ? 2 : 1;
    if (doc.view.zoomMode === 'fit-width' && viewport.width > 0) {
      return clamp((viewport.width - PADDING * 2 - GAP * (columns - 1)) / (base.width * columns), MIN_ZOOM, MAX_ZOOM);
    }
    if (doc.view.zoomMode === 'fit-page' && viewport.height > 0) {
      const zw = (viewport.width - PADDING * 2 - GAP * (columns - 1)) / (base.width * columns);
      const zh = (viewport.height - PADDING * 2) / base.height;
      return clamp(Math.min(zw, zh), MIN_ZOOM, MAX_ZOOM);
    }
    return clamp(doc.view.zoom, MIN_ZOOM, MAX_ZOOM);
  }, [doc.view.zoom, doc.view.zoomMode, doc.view.viewMode, sizes, viewport.width, viewport.height]);

  // Publish derived zoom so the status bar shows fit-mode percentages.
  useEffect(() => {
    if (Math.abs(zoom - doc.view.zoom) > 0.001) {
      updateView(doc.id, { zoom });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Two-phase zoom: CSS-scale immediately, re-render crisp after idle.
  useEffect(() => {
    const settle = debounce((z: number) => setRenderZoom(z), 160);
    settle(zoom);
  }, [zoom]);

  // ── Layout ──
  const layouts: PageLayout[] = useMemo(() => {
    if (sizes.length === 0 || viewport.width === 0) return [];
    const result: PageLayout[] = [];
    const mode = doc.view.viewMode;
    const single = mode === 'single';
    const columns = mode === 'facing' || mode === 'book' ? 2 : 1;

    if (single) {
      const i = doc.view.page - 1;
      const size = sizes[i] ?? sizes[0]!;
      const w = size.width * zoom;
      const h = size.height * zoom;
      result.push({
        pageIndex: i,
        top: PADDING,
        left: Math.max(PADDING, (viewport.width - w) / 2),
        width: w,
        height: h,
        ptWidth: size.width,
        ptHeight: size.height
      });
      return result;
    }

    let y = PADDING;
    let i = 0;
    while (i < sizes.length) {
      // Book mode: cover page sits alone.
      const rowCount = mode === 'book' && i === 0 ? 1 : columns;
      const rowPages = [];
      for (let c = 0; c < rowCount && i + c < sizes.length; c++) {
        rowPages.push(i + c);
      }
      const rowWidth =
        rowPages.reduce((sum, p) => sum + sizes[p]!.width * zoom, 0) + GAP * (rowPages.length - 1);
      let x = Math.max(PADDING, (viewport.width - rowWidth) / 2);
      let rowHeight = 0;
      for (const p of rowPages) {
        const size = sizes[p]!;
        const w = size.width * zoom;
        const h = size.height * zoom;
        result.push({ pageIndex: p, top: y, left: x, width: w, height: h, ptWidth: size.width, ptHeight: size.height });
        x += w + GAP;
        rowHeight = Math.max(rowHeight, h);
      }
      y += rowHeight + GAP;
      i += rowPages.length;
    }
    return result;
  }, [sizes, zoom, viewport.width, doc.view.viewMode, doc.view.page]);

  const totalHeight = useMemo(
    () => (layouts.length > 0 ? Math.max(...layouts.map((l) => l.top + l.height)) + PADDING : 0),
    [layouts]
  );

  // ── Visible window ──
  const visible = useMemo(() => {
    const from = viewport.scrollTop - OVERSCAN * viewport.height;
    const to = viewport.scrollTop + (1 + OVERSCAN) * viewport.height;
    return layouts.filter((l) => l.top + l.height >= from && l.top <= to);
  }, [layouts, viewport.scrollTop, viewport.height]);

  // ── Scroll → current page (rAF-throttled: one update per frame) ──
  const onScroll = useCallback(() => {
    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      const el = containerRef.current;
      if (!el) return;
      const top = el.scrollTop;
      setViewport((v) => (v.scrollTop === top ? v : { ...v, scrollTop: top }));

      // While a programmatic scroll is settling, don't recompute the page.
      if (scrollLock.current.target !== null) {
        if (Math.abs(top - scrollLock.current.target) < 4) scrollLock.current.target = null;
        return;
      }
      const center = top + el.clientHeight / 2;
      let best = doc.view.page;
      let bestDist = Infinity;
      for (const l of layouts) {
        const dist = Math.abs(l.top + l.height / 2 - center);
        if (dist < bestDist) {
          bestDist = dist;
          best = l.pageIndex + 1;
        }
      }
      if (best !== doc.view.page) {
        scrollOriginPage.current = best; // mark as scroll-derived
        updateView(doc.id, { page: best });
        eventBus.emit('page:changed', { docId: doc.id, page: best });
      }
    });
  }, [layouts, doc.id, doc.view.page, updateView]);

  useEffect(
    () => () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    },
    []
  );

  // ── External page change → scroll there ──
  // Only acts on navigation that did NOT come from scrolling, so pages taller
  // than the viewport no longer snap to their top mid-scroll.
  const lastScrolledPage = useRef(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || layouts.length === 0) return;
    if (doc.view.viewMode === 'single') return; // single mode re-layouts instead
    if (doc.view.page === scrollOriginPage.current) return; // user-scroll origin
    if (doc.view.page === lastScrolledPage.current) return; // already positioned
    const layout = layouts.find((l) => l.pageIndex === doc.view.page - 1);
    if (!layout) return;
    scrollLock.current.target = Math.max(0, layout.top - GAP);
    el.scrollTo({ top: scrollLock.current.target });
    lastScrolledPage.current = doc.view.page;
  }, [doc.view.page, layouts, doc.view.viewMode]);

  // ── Ctrl+wheel zoom ──
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!e.ctrlKey) {
        if (doc.view.viewMode === 'single') {
          updateView(doc.id, {
            page: clamp(doc.view.page + (e.deltaY > 0 ? 1 : -1), 1, doc.pageCount)
          });
        }
        return;
      }
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      updateView(doc.id, { zoom: clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM), zoomMode: 'custom' });
    },
    [doc.id, doc.view.viewMode, doc.view.page, doc.pageCount, zoom, updateView]
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <FindBar />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {`Page ${doc.view.page} of ${doc.pageCount}`}
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        onWheel={onWheel}
        className="h-full w-full overflow-auto bg-app-workspace"
        role="document"
        aria-label={`${doc.title}, page ${doc.view.page} of ${doc.pageCount}`}
      >
        <div className="relative" style={{ height: totalHeight, minWidth: '100%' }}>
          {visible.map((layout) => (
            <PageView
              key={`${doc.id}-${layout.pageIndex}`}
              docId={doc.id}
              layout={layout}
              zoom={zoom}
              renderZoom={renderZoom}
              renderNonce={renderNonce}
              onActualSize={reportActualSize}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
