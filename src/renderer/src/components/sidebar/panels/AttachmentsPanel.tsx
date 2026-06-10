/** Attachments panel — embedded files: add, extract, preview text, remove. */
import { useCallback, useEffect, useState } from 'react';
import { listAttachments, extractAttachment, type AttachmentInfo } from '@core/pdf/attachments';
import { documentService } from '../../../services/document-service';
import { useActiveDoc } from '../../../stores/documents-store';
import { useDialogStore, toast } from '../../../stores/ui-stores';
import { ipc } from '../../../services/ipc';
import { eventBus } from '@shared/event-bus';
import { Icon } from '../../common/Icon';
import { Button, EmptyState } from '../../common/controls';
import { formatFileSize } from '../../../utils';
import { removeAttachment } from '@core/pdf/attachments';

export function AttachmentsPanel() {
  const doc = useActiveDoc();
  const show = useDialogStore((s) => s.show);
  const [items, setItems] = useState<AttachmentInfo[]>([]);
  const [preview, setPreview] = useState<{ name: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    if (!doc) return;
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    setItems(await listAttachments(runtime.bytes));
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
    return eventBus.on('document:reloaded', ({ docId }) => {
      if (docId === doc?.id) void reload();
    });
  }, [reload, doc?.id]);

  if (!doc) return <EmptyState icon="attachment" title="No document open" />;

  const extract = async (name: string): Promise<void> => {
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    const target = await ipc.files.saveDialog({ title: 'Save Attachment', defaultPath: name });
    if (!target) return;
    await ipc.files.write(target, await extractAttachment(runtime.bytes, name));
    toast.success('Attachment saved', target);
  };

  const previewItem = async (item: AttachmentInfo): Promise<void> => {
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    const textLike = /text|json|xml|csv/.test(item.mimeType ?? '') || /\.(txt|json|xml|csv|md|log)$/i.test(item.name);
    if (!textLike) {
      toast.info('No inline preview', 'Extract the file to view it in its native application.');
      return;
    }
    const bytes = await extractAttachment(runtime.bytes, item.name);
    setPreview({ name: item.name, text: new TextDecoder().decode(bytes.slice(0, 20000)) });
  };

  const remove = async (name: string): Promise<void> => {
    await documentService.applyOperation(doc.id, 'Remove attachment', (bytes) => removeAttachment(bytes, name));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-app-border p-2">
        <Button variant="ghost" onClick={() => show('attach-file')}>
          <Icon name="plus" size={13} /> Attach File…
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {items.length === 0 ? (
          <EmptyState icon="attachment" title="No attachments" hint="Attach documents, images or ZIP archives." />
        ) : (
          items.map((item) => (
            <div key={item.name} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-app-surface-3">
              <Icon name="attachment" size={14} className="shrink-0 text-app-text-muted" />
              <button onClick={() => void previewItem(item)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-xs">{item.name}</div>
                <div className="text-2xs text-app-text-faint">
                  {formatFileSize(item.size)}
                  {item.description ? ` — ${item.description}` : ''}
                </div>
              </button>
              <button onClick={() => void extract(item.name)} title="Save to disk" className="rounded p-1 opacity-0 hover:bg-app-surface-2 group-hover:opacity-100">
                <Icon name="export" size={12} />
              </button>
              <button onClick={() => void remove(item.name)} title="Remove" className="rounded p-1 opacity-0 hover:bg-app-surface-2 group-hover:opacity-100">
                <Icon name="close" size={12} />
              </button>
            </div>
          ))
        )}
        {preview && (
          <div className="mt-2 rounded-md border border-app-border bg-app-surface-2 p-2">
            <div className="mb-1 flex items-center justify-between text-2xs font-semibold text-app-text-muted">
              {preview.name}
              <button onClick={() => setPreview(null)} aria-label="Close preview">
                <Icon name="close" size={11} />
              </button>
            </div>
            <pre className="max-h-56 select-text overflow-auto whitespace-pre-wrap font-mono text-2xs text-app-text-muted">
              {preview.text}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
