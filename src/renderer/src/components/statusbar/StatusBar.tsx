/** Status bar: page navigation, zoom, view mode, OCR/security/save status. */
import { useState } from 'react';
import { useActiveDoc, useDocumentsStore } from '../../stores/documents-store';
import { useOcrStore, useUpdateStore } from '../../stores/ui-stores';
import { commands } from '../../services/command-registry';
import { ZOOM_LEVELS } from '@shared/constants';
import { Icon } from '../common/Icon';
import { cx } from '../../utils';

export function StatusBar() {
  const doc = useActiveDoc();
  const updateView = useDocumentsStore((s) => s.updateView);
  const ocr = useOcrStore();
  const update = useUpdateStore((s) => s.status);
  const [pageInput, setPageInput] = useState<string | null>(null);

  if (!doc) {
    return (
      <div className="vk-chrome flex h-6 shrink-0 items-center border-t border-app-border bg-app-surface px-3 text-2xs text-app-text-faint">
        Ready — open a document to begin
      </div>
    );
  }

  const commitPage = (): void => {
    if (pageInput !== null) {
      const n = parseInt(pageInput, 10);
      if (!Number.isNaN(n)) updateView(doc.id, { page: Math.min(doc.pageCount, Math.max(1, n)) });
    }
    setPageInput(null);
  };

  return (
    <div className="vk-chrome flex h-6 shrink-0 items-center gap-1 border-t border-app-border bg-app-surface px-2 text-2xs text-app-text-muted">
      {/* Page navigation */}
      <button onClick={() => void commands.execute('view.firstPage')} className="rounded p-0.5 hover:bg-app-surface-3" aria-label="First page">
        <Icon name="chevrons-left" size={11} />
      </button>
      <button onClick={() => void commands.execute('view.prevPage')} className="rounded p-0.5 hover:bg-app-surface-3" aria-label="Previous page">
        <Icon name="chevron-left" size={11} />
      </button>
      <span className="flex items-center gap-1">
        Page
        <input
          value={pageInput ?? String(doc.view.page)}
          onChange={(e) => setPageInput(e.target.value)}
          onBlur={commitPage}
          onKeyDown={(e) => e.key === 'Enter' && commitPage()}
          onFocus={(e) => e.target.select()}
          aria-label="Current page"
          className="h-5 w-10 rounded border border-app-border bg-app-surface-2 text-center text-2xs"
        />
        / {doc.pageCount}
      </span>
      <button onClick={() => void commands.execute('view.nextPage')} className="rounded p-0.5 hover:bg-app-surface-3" aria-label="Next page">
        <Icon name="chevron-right" size={11} />
      </button>
      <button onClick={() => void commands.execute('view.lastPage')} className="rounded p-0.5 hover:bg-app-surface-3" aria-label="Last page">
        <Icon name="chevrons-right" size={11} />
      </button>

      <div className="mx-2 h-3.5 w-px bg-app-border" />

      {/* Zoom */}
      <button onClick={() => void commands.execute('view.zoomOut')} className="rounded p-0.5 hover:bg-app-surface-3" aria-label="Zoom out">
        <Icon name="minus" size={11} />
      </button>
      <select
        value={String(Math.round(doc.view.zoom * 100))}
        onChange={(e) => updateView(doc.id, { zoom: parseInt(e.target.value, 10) / 100, zoomMode: 'custom' })}
        aria-label="Zoom level"
        className="h-5 cursor-pointer rounded border border-app-border bg-app-surface-2 px-1 text-2xs"
      >
        {!ZOOM_LEVELS.some((z) => Math.round(z * 100) === Math.round(doc.view.zoom * 100)) && (
          <option value={String(Math.round(doc.view.zoom * 100))}>{Math.round(doc.view.zoom * 100)}%</option>
        )}
        {ZOOM_LEVELS.map((z) => (
          <option key={z} value={String(Math.round(z * 100))}>
            {Math.round(z * 100)}%
          </option>
        ))}
      </select>
      <button onClick={() => void commands.execute('view.zoomIn')} className="rounded p-0.5 hover:bg-app-surface-3" aria-label="Zoom in">
        <Icon name="plus" size={11} />
      </button>

      <div className="flex-1" />

      {/* OCR status */}
      <span className={cx('flex items-center gap-1', ocr.running && 'text-app-accent')}>
        <Icon name="ocr" size={11} />
        {ocr.running
          ? `OCR ${ocr.page}/${ocr.pageCount}`
          : doc.ocrApplied
            ? 'OCR: Applied'
            : 'OCR: Ready'}
      </span>

      <div className="mx-2 h-3.5 w-px bg-app-border" />

      {/* Security status */}
      <span className="flex items-center gap-1">
        <Icon name={doc.encrypted ? 'lock' : 'unlock'} size={11} className={doc.encrypted ? 'text-app-success' : ''} />
        {doc.encrypted ? 'Encrypted' : 'Not Encrypted'}
      </span>

      {update && update.state !== 'not-available' && (
        <>
          <div className="mx-2 h-3.5 w-px bg-app-border" />
          <span className="flex items-center gap-1 text-app-accent">
            <Icon name="update" size={11} />
            {update.state === 'downloading'
              ? `Update ${update.percent ?? 0}%`
              : update.state === 'downloaded'
                ? 'Update ready'
                : update.state === 'available'
                  ? `v${update.version} available`
                  : update.state}
          </span>
        </>
      )}

      <div className="mx-2 h-3.5 w-px bg-app-border" />
      <span className="flex items-center gap-1">
        {doc.dirty ? (
          <span className="text-app-warning">● Unsaved changes</span>
        ) : (
          <span className="flex items-center gap-1 text-app-success">
            <Icon name="check" size={11} /> Saved
          </span>
        )}
      </span>
    </div>
  );
}
