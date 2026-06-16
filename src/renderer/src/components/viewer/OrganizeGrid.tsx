/**
 * OrganizeGrid — page-thumbnail workspace for the Organize tab:
 * multi-select, drag-to-reorder, and quick page actions.
 */
import { useEffect, useRef, useState } from 'react';
import { documentService } from '../../services/document-service';
import { renderPageToCanvas } from '../../services/pdfjs';
import { useDocumentsStore } from '../../stores/documents-store';
import { commands } from '../../services/command-registry';
import { Icon } from '../common/Icon';
import { cx } from '../../utils';
import type { OpenDocumentMeta } from '../../types';

const THUMB_WIDTH = 148;

function PageThumb({
  docId,
  pageIndex,
  selected,
  onSelect,
  onDragStart,
  onDropOn
}: {
  docId: string;
  pageIndex: number;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onDragStart: () => void;
  onDropOn: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [over, setOver] = useState(false);

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
        const canvas = await renderPageToCanvas(page, THUMB_WIDTH / vp.width, { dpr: 1 });
        if (!cancelled && hostRef.current) {
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          hostRef.current.replaceChildren(canvas);
        }
      } catch {
        /* reloaded mid-render */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, docId, pageIndex]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropOn();
      }}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey || e.shiftKey)}
      className={cx(
        'group cursor-pointer rounded-lg border-2 p-1.5 transition-colors',
        selected ? 'border-app-accent bg-app-accent-muted' : 'border-transparent hover:border-app-border-strong',
        over && 'border-app-accent border-dashed'
      )}
      role="option"
      aria-selected={selected}
    >
      <div
        ref={hostRef}
        style={{ width: THUMB_WIDTH, minHeight: THUMB_WIDTH * 1.3 }}
        className="overflow-hidden rounded bg-white shadow"
      />
      <div className="pt-1 text-center text-2xs text-app-text-muted">{pageIndex + 1}</div>
    </div>
  );
}

export function OrganizeGrid({ doc }: { doc: OpenDocumentMeta }) {
  const selectedPages = useDocumentsStore((s) => s.selectedPages);
  const toggle = useDocumentsStore((s) => s.togglePageSelection);
  const dragFrom = useRef<number | null>(null);

  const onDrop = async (target: number): Promise<void> => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === target) return;
    const order = Array.from({ length: doc.pageCount }, (_, i) => i);
    order.splice(from, 1);
    order.splice(target > from ? target - 1 : target, 0, from);
    await documentService.applyServerOp(doc.id, 'Reorder pages', { kind: 'reorderPages', order });
  };

  const Action = ({ icon, label, commandId }: { icon: string; label: string; commandId: string }) => (
    <button
      onClick={() => void commands.execute(commandId)}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs hover:bg-app-surface-3"
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-app-border bg-app-surface px-2 py-1">
        <Action icon="insert-page" label="Insert" commandId="organize.insertBlank" />
        <Action icon="delete-page" label="Delete" commandId="organize.deletePages" />
        <Action icon="pages" label="Duplicate" commandId="organize.duplicatePages" />
        <Action icon="rotate-left" label="Rotate ⟲" commandId="organize.rotateLeft" />
        <Action icon="rotate-right" label="Rotate ⟳" commandId="organize.rotateRight" />
        <Action icon="extract" label="Extract" commandId="organize.extract" />
        <Action icon="split" label="Split" commandId="organize.split" />
        <Action icon="merge" label="Merge" commandId="organize.merge" />
        <div className="flex-1" />
        <span className="px-2 text-2xs text-app-text-faint">
          {selectedPages.length > 0 ? `${selectedPages.length} page(s) selected` : 'Click to select · Ctrl+click for multi-select · drag to reorder'}
        </span>
        <Action icon="close" label="Close Grid" commandId="organize.mode" />
      </div>
      <div className="flex flex-1 flex-wrap content-start gap-2 overflow-y-auto bg-app-workspace p-4" role="listbox" aria-label="Pages" aria-multiselectable="true">
        {Array.from({ length: doc.pageCount }, (_, i) => (
          <PageThumb
            key={`${doc.id}-${i}-${doc.fileSize}`}
            docId={doc.id}
            pageIndex={i}
            selected={selectedPages.includes(i)}
            onSelect={(additive) => toggle(i, additive)}
            onDragStart={() => {
              dragFrom.current = i;
            }}
            onDropOn={() => void onDrop(i)}
          />
        ))}
      </div>
    </div>
  );
}
