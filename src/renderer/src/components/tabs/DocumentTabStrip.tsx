/** Multi-document tab strip with dirty markers and middle-click close. */
import { useDocumentsStore } from '../../stores/documents-store';
import { useDialogStore } from '../../stores/ui-stores';
import { documentService } from '../../services/document-service';
import { commands } from '../../services/command-registry';
import { Icon } from '../common/Icon';
import { cx } from '../../utils';

export function DocumentTabStrip() {
  const docs = useDocumentsStore((s) => s.docs);
  const activeId = useDocumentsStore((s) => s.activeId);
  const setActive = useDocumentsStore((s) => s.setActive);
  const show = useDialogStore((s) => s.show);

  if (docs.length === 0) return null;

  const close = (docId: string): void => {
    const meta = docs.find((d) => d.id === docId);
    if (meta?.dirty) show('save-changes', { docId });
    else void documentService.close(docId);
  };

  return (
    <div className="vk-chrome flex h-8 shrink-0 items-end gap-0.5 border-b border-app-border bg-app-bg px-1.5" role="tablist" aria-label="Open documents">
      {docs.map((doc) => (
        <div
          key={doc.id}
          role="tab"
          aria-selected={doc.id === activeId}
          onClick={() => setActive(doc.id)}
          onAuxClick={(e) => e.button === 1 && close(doc.id)}
          className={cx(
            'group flex h-7 max-w-52 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 text-xs',
            doc.id === activeId
              ? 'border-app-border bg-app-surface text-app-text'
              : 'border-transparent bg-transparent text-app-text-muted hover:bg-app-surface-3'
          )}
        >
          <Icon name="file" size={12} className={doc.id === activeId ? 'text-app-accent' : ''} />
          <span className="truncate">{doc.title}</span>
          {doc.dirty && <span className="text-app-accent">●</span>}
          <button
            aria-label={`Close ${doc.title}`}
            onClick={(e) => {
              e.stopPropagation();
              close(doc.id);
            }}
            className="rounded p-0.5 opacity-0 hover:bg-app-surface-3 group-hover:opacity-100"
          >
            <Icon name="close" size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => void commands.execute('file.open')}
        title="Open document"
        aria-label="Open document"
        className="mb-0.5 rounded p-1 text-app-text-faint hover:bg-app-surface-3 hover:text-app-text"
      >
        <Icon name="plus" size={13} />
      </button>
    </div>
  );
}
