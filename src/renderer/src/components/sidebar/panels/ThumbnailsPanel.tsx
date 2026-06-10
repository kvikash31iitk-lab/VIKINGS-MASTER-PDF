/** Page thumbnails with lazy rendering and current-page tracking. */
import { useEffect, useRef, useState } from 'react';
import { documentService } from '../../../services/document-service';
import { renderPageToCanvas } from '../../../services/pdfjs';
import { useActiveDoc, useDocumentsStore } from '../../../stores/documents-store';
import { EmptyState } from '../../common/controls';
import { cx } from '../../../utils';

function Thumb({ docId, pageIndex, active, onClick }: { docId: string; pageIndex: number; active: boolean; onClick: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setVisible(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const runtime = documentService.runtime(docId);
      if (!runtime) return;
      try {
        const page = await runtime.pdf.getPage(pageIndex + 1);
        const vp = page.getViewport({ scale: 1 });
        const canvas = await renderPageToCanvas(page, 132 / vp.width, { dpr: 1 });
        if (!cancelled && hostRef.current) {
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          hostRef.current.replaceChildren(canvas);
        }
      } catch {
        /* document reloaded */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, docId, pageIndex]);

  return (
    <button
      onClick={onClick}
      aria-label={`Page ${pageIndex + 1}`}
      aria-current={active}
      className={cx(
        'block w-full rounded-lg border-2 p-1.5 text-left transition-colors',
        active ? 'border-app-accent bg-app-accent-muted' : 'border-transparent hover:border-app-border-strong'
      )}
    >
      <div ref={hostRef} className="min-h-36 overflow-hidden rounded bg-white shadow" />
      <div className="pt-1 text-center text-2xs text-app-text-muted">{pageIndex + 1}</div>
    </button>
  );
}

export function ThumbnailsPanel() {
  const doc = useActiveDoc();
  const updateView = useDocumentsStore((s) => s.updateView);
  if (!doc) return <EmptyState icon="thumbnails" title="No document open" />;
  return (
    <div className="flex flex-col gap-1.5 p-2" role="listbox" aria-label="Page thumbnails">
      {Array.from({ length: doc.pageCount }, (_, i) => (
        <Thumb
          key={`${doc.id}-${i}-${doc.fileSize}`}
          docId={doc.id}
          pageIndex={i}
          active={doc.view.page === i + 1}
          onClick={() => updateView(doc.id, { page: i + 1 })}
        />
      ))}
    </div>
  );
}
