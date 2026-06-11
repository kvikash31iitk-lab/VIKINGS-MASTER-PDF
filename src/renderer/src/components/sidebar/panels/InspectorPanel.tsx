/** Inspector — structural overview: annotations, fields, attachments, signatures. */
import { useEffect, useState } from 'react';
import { readFormData } from '@core/pdf/form-builder';
import { listAttachments } from '@core/pdf/attachments';
import { documentService } from '../../../services/document-service';
import { useActiveDoc } from '../../../stores/documents-store';
import { useCommentsStore, useToolStore, useDialogStore } from '../../../stores/ui-stores';
import { eventBus } from '@shared/event-bus';
import { Button, EmptyState } from '../../common/controls';
import { Icon } from '../../common/Icon';
import { EMPTY } from '../../../utils';

export function InspectorPanel() {
  const doc = useActiveDoc();
  const comments = useCommentsStore((s) => (doc ? s.byDoc[doc.id] ?? EMPTY : EMPTY));
  const drafts = useToolStore((s) => (doc ? s.drafts[doc.id] ?? EMPTY : EMPTY));
  const show = useDialogStore((s) => s.show);
  const [fieldCount, setFieldCount] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [signatureFields, setSignatureFields] = useState(0);

  useEffect(() => {
    const cancelled = false;
    const load = async (): Promise<void> => {
      if (!doc) return;
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      try {
        const fields = await readFormData(runtime.bytes);
        const attachments = await listAttachments(runtime.bytes);
        if (!cancelled) {
          setFieldCount(fields.length);
          setSignatureFields(fields.filter((f) => f.type === 'signature').length);
          setAttachmentCount(attachments.length);
        }
      } catch {
        /* tolerate parse issues */
      }
    };
    void load();
    return eventBus.on('document:reloaded', ({ docId }) => {
      if (docId === doc?.id && !cancelled) void load();
    });
    // Narrow deps by design: whole-doc identity churns on dirty-flag updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id, doc?.fileSize]);

  if (!doc) return <EmptyState icon="inspector" title="No document open" />;

  const bySubtype = new Map<string, number>();
  for (const c of comments) bySubtype.set(c.subtype, (bySubtype.get(c.subtype) ?? 0) + 1);

  const Stat = ({ icon, label, value }: { icon: string; label: string; value: number | string }) => (
    <div className="flex items-center gap-2 rounded-md bg-app-surface-2 px-2.5 py-2">
      <Icon name={icon} size={15} className="text-app-accent" />
      <span className="flex-1 text-xs">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 p-3">
      <Stat icon="comment" label="Annotations" value={comments.length} />
      <Stat icon="pencil" label="Pending drafts" value={drafts.length} />
      <Stat icon="inspector" label="Form fields" value={fieldCount} />
      <Stat icon="signature" label="Signature fields" value={signatureFields} />
      <Stat icon="attachment" label="Attachments" value={attachmentCount} />

      {bySubtype.size > 0 && (
        <section className="mt-2">
          <h3 className="mb-1 text-2xs font-bold uppercase tracking-wide text-app-text-faint">By type</h3>
          {[...bySubtype.entries()].map(([type, count]) => (
            <div key={type} className="flex justify-between border-b border-app-border py-1 text-2xs last:border-b-0">
              <span className="text-app-text-muted">{type}</span>
              <span className="tabular-nums">{count}</span>
            </div>
          ))}
        </section>
      )}

      <div className="mt-2 flex flex-col gap-1.5">
        <Button onClick={() => show('verify-signatures')}>Validate signatures…</Button>
        <Button onClick={() => show('audit-log')}>View audit log…</Button>
      </div>
    </div>
  );
}
