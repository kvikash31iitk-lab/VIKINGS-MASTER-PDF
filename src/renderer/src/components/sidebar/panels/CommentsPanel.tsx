/** Comments panel — imported + draft annotations, replies, resolve, filters. */
import { useMemo, useState } from 'react';
import { useActiveDoc, useDocumentsStore } from '../../../stores/documents-store';
import { useCommentsStore, useToolStore } from '../../../stores/ui-stores';
import { annotationService } from '../../../services/annotation-service';
import { Icon } from '../../common/Icon';
import { Button, Checkbox, EmptyState, Select, TextInput } from '../../common/controls';
import { cx, EMPTY } from '../../../utils';

export function CommentsPanel() {
  const doc = useActiveDoc();
  const updateView = useDocumentsStore((s) => s.updateView);
  const imported = useCommentsStore((s) => (doc ? s.byDoc[doc.id] ?? EMPTY : EMPTY));
  const filterAuthor = useCommentsStore((s) => s.filterAuthor);
  const showResolved = useCommentsStore((s) => s.showResolved);
  const drafts = useToolStore((s) => (doc ? s.drafts[doc.id] ?? EMPTY : EMPTY));
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const authors = useMemo(
    () => [...new Set(imported.map((c) => c.author).filter(Boolean))].sort(),
    [imported]
  );

  if (!doc) return <EmptyState icon="comment" title="No document open" />;

  const visible = imported
    .filter((c) => !c.inReplyTo)
    .filter((c) => (filterAuthor ? c.author === filterAuthor : true))
    .filter((c) => (showResolved ? true : !c.resolved))
    .sort((a, b) => a.pageIndex - b.pageIndex);
  const repliesOf = (id: string) => imported.filter((c) => c.inReplyTo === id);

  const sendReply = async (parentId: string): Promise<void> => {
    if (!replyText.trim()) return;
    await annotationService.reply(doc.id, parentId, replyText.trim());
    setReplyText('');
    setReplyFor(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-app-border p-2">
        <Select
          value={filterAuthor ?? '*'}
          onChange={(v) => useCommentsStore.getState().setFilterAuthor(v === '*' ? null : v)}
          options={[{ value: '*', label: 'All authors' }, ...authors.map((a) => ({ value: a, label: a }))]}
        />
        <Checkbox
          checked={showResolved}
          onChange={(v) => useCommentsStore.getState().setShowResolved(v)}
          label="Show resolved"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {drafts.length > 0 && (
          <div className="mb-2 rounded-md border border-dashed border-app-accent bg-app-accent-muted/40 p-2">
            <div className="mb-1 text-2xs font-semibold text-app-accent">
              {drafts.length} pending annotation(s) — not yet written to the PDF
            </div>
            <Button variant="primary" className="h-6 px-2 text-2xs" onClick={() => void annotationService.commitDrafts(doc.id)}>
              Apply now
            </Button>
          </div>
        )}

        {visible.length === 0 && drafts.length === 0 ? (
          <EmptyState icon="comments" title="No comments" hint="Use the Review tab tools to add markup and notes." />
        ) : (
          visible.map((c) => (
            <div
              key={c.id}
              className={cx('mb-2 rounded-lg border border-app-border bg-app-surface-2 p-2', c.resolved && 'opacity-60')}
            >
              <div className="flex items-center gap-1.5">
                <Icon name={c.subtype === 'Highlight' ? 'highlight' : c.subtype === 'Text' ? 'note' : 'comment'} size={13} className="text-app-accent" />
                <button
                  onClick={() => updateView(doc.id, { page: c.pageIndex + 1 })}
                  className="flex-1 truncate text-left text-xs font-semibold hover:underline"
                >
                  {c.author || 'Anonymous'} · p.{c.pageIndex + 1}
                </button>
                {c.resolved && <Icon name="check" size={12} className="text-app-success" />}
              </div>
              {c.contents && <p className="mt-1 select-text whitespace-pre-wrap text-xs text-app-text-muted">{c.contents}</p>}

              {repliesOf(c.id).map((r) => (
                <div key={r.id} className="ml-3 mt-1.5 border-l-2 border-app-border pl-2">
                  <div className="text-2xs font-semibold">{r.author || 'Anonymous'}</div>
                  <p className="select-text text-2xs text-app-text-muted">{r.contents}</p>
                </div>
              ))}

              <div className="mt-1.5 flex gap-1">
                <Button variant="ghost" className="h-6 px-2 text-2xs" onClick={() => setReplyFor(replyFor === c.id ? null : c.id)}>
                  Reply
                </Button>
                <Button
                  variant="ghost"
                  className="h-6 px-2 text-2xs"
                  onClick={() => void annotationService.setResolved(doc.id, c.id, !c.resolved)}
                >
                  {c.resolved ? 'Reopen' : 'Resolve'}
                </Button>
                <Button
                  variant="ghost"
                  className="h-6 px-2 text-2xs text-app-danger"
                  onClick={() => void annotationService.deleteByName(doc.id, [c.id])}
                >
                  Delete
                </Button>
              </div>

              {replyFor === c.id && (
                <div className="mt-1.5 flex gap-1">
                  <TextInput value={replyText} onChange={setReplyText} placeholder="Write a reply…" autoFocus onEnter={() => void sendReply(c.id)} />
                  <Button variant="primary" className="h-8 px-2.5" onClick={() => void sendReply(c.id)}>
                    <Icon name="check" size={13} />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
