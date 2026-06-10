/** Properties panel — document, security and page facts + quick actions. */
import { useEffect, useState } from 'react';
import { readMetadata, type DocumentMetadata } from '@core/pdf/metadata';
import { documentService } from '../../../services/document-service';
import { useActiveDoc } from '../../../stores/documents-store';
import { useDialogStore } from '../../../stores/ui-stores';
import { eventBus } from '@shared/event-bus';
import { Button, EmptyState } from '../../common/controls';
import { formatFileSize } from '../../../utils';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-app-border py-1.5 last:border-b-0">
      <span className="shrink-0 text-2xs text-app-text-faint">{label}</span>
      <span className="select-text truncate text-right text-2xs text-app-text" title={value}>
        {value || '—'}
      </span>
    </div>
  );
}

export function PropertiesPanel() {
  const doc = useActiveDoc();
  const show = useDialogStore((s) => s.show);
  const [meta, setMeta] = useState<DocumentMetadata | null>(null);
  const [pageSize, setPageSize] = useState('');

  useEffect(() => {
    const cancelled = false;
    const load = async (): Promise<void> => {
      if (!doc) return;
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      try {
        const m = await readMetadata(runtime.bytes);
        const page = await runtime.pdf.getPage(doc.view.page);
        const vp = page.getViewport({ scale: 1 });
        if (!cancelled) {
          setMeta(m);
          setPageSize(`${(vp.width / 72).toFixed(2)}″ × ${(vp.height / 72).toFixed(2)}″ (${Math.round(vp.width)} × ${Math.round(vp.height)} pt)`);
        }
      } catch {
        /* encrypted or reloading */
      }
    };
    void load();
    return eventBus.on('document:reloaded', ({ docId }) => {
      if (docId === doc?.id && !cancelled) void load();
    });
  }, [doc?.id, doc?.view.page, doc?.fileSize]);

  if (!doc) return <EmptyState icon="properties" title="No document open" />;

  return (
    <div className="flex flex-col gap-3 p-3">
      <section>
        <h3 className="mb-1 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Document</h3>
        <Row label="Title" value={meta?.title ?? doc.title} />
        <Row label="Author" value={meta?.author ?? ''} />
        <Row label="Subject" value={meta?.subject ?? ''} />
        <Row label="Keywords" value={meta?.keywords ?? ''} />
        <Row label="Producer" value={meta?.producer ?? ''} />
        <Row label="Created" value={meta?.creationDate ? new Date(meta.creationDate).toLocaleString() : ''} />
      </section>
      <section>
        <h3 className="mb-1 text-2xs font-bold uppercase tracking-wide text-app-text-faint">File</h3>
        <Row label="Location" value={doc.path ?? 'Not saved yet'} />
        <Row label="Size" value={formatFileSize(doc.fileSize)} />
        <Row label="Pages" value={String(doc.pageCount)} />
        <Row label="Security" value={doc.encrypted ? 'Password protected' : 'None'} />
        <Row label="OCR" value={doc.ocrApplied ? 'Text layer applied' : 'Not applied'} />
      </section>
      <section>
        <h3 className="mb-1 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Current Page</h3>
        <Row label="Number" value={`${doc.view.page} of ${doc.pageCount}`} />
        <Row label="Dimensions" value={pageSize} />
      </section>
      <div className="flex gap-2">
        <Button onClick={() => show('metadata-edit')}>Edit Metadata…</Button>
        <Button onClick={() => show('document-properties')}>Details</Button>
      </div>
    </div>
  );
}
