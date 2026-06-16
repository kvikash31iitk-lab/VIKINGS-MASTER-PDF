/** Bookmarks (outline) panel — tree CRUD, nesting, auto-generate, JSON IO. */
import { useCallback, useEffect, useState } from 'react';
import {
  readBookmarks,
  buildOutlineFromHeadings,
  bookmarksToJson,
  bookmarksFromJson,
  type BookmarkNode,
  type HeadingCandidate
} from '@core/pdf/bookmarks';
import { reconstructPage } from '@core/convert/text-extract';
import { documentService } from '../../../services/document-service';
import { useActiveDoc, useDocumentsStore } from '../../../stores/documents-store';
import { toast } from '../../../stores/ui-stores';
import { ipc } from '../../../services/ipc';
import { eventBus } from '@shared/event-bus';
import { Icon } from '../../common/Icon';
import { Button, EmptyState } from '../../common/controls';

function NodeRow({
  node,
  depth,
  onGoto,
  onRename,
  onDelete
}: {
  node: BookmarkNode;
  depth: number;
  onGoto: (n: BookmarkNode) => void;
  onRename: (n: BookmarkNode, title: string) => void;
  onDelete: (n: BookmarkNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(node.title);

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-app-surface-3"
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        {node.children.length > 0 ? (
          <button onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Collapse' : 'Expand'}>
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={11} className="text-app-text-faint" />
          </button>
        ) : (
          <span className="w-[11px]" />
        )}
        {editing ? (
          <input
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (title.trim() && title !== node.title) onRename(node, title.trim());
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="h-5 flex-1 rounded border border-app-accent bg-app-surface px-1 text-xs"
          />
        ) : (
          <button
            onClick={() => onGoto(node)}
            onDoubleClick={() => setEditing(true)}
            className="flex-1 truncate text-left text-xs"
            title={`${node.title} → page ${node.pageIndex + 1}`}
          >
            {node.title}
          </button>
        )}
        <span className="text-2xs text-app-text-faint">{node.pageIndex + 1}</span>
        <button
          onClick={() => onDelete(node)}
          aria-label={`Delete bookmark ${node.title}`}
          className="rounded p-0.5 opacity-0 hover:bg-app-surface-2 group-hover:opacity-100"
        >
          <Icon name="close" size={10} />
        </button>
      </div>
      {expanded &&
        node.children.map((child, i) => (
          <NodeRow key={i} node={child} depth={depth + 1} onGoto={onGoto} onRename={onRename} onDelete={onDelete} />
        ))}
    </div>
  );
}

export function BookmarksPanel() {
  const doc = useActiveDoc();
  const updateView = useDocumentsStore((s) => s.updateView);
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!doc) return;
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    setTree(await readBookmarks(runtime.bytes));
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void reload();
    return eventBus.on('document:reloaded', ({ docId }) => {
      if (docId === doc?.id) void reload();
    });
  }, [reload, doc?.id]);

  if (!doc) return <EmptyState icon="bookmark" title="No document open" />;

  const persist = async (next: BookmarkNode[], label: string): Promise<void> => {
    await documentService.applyServerOp(doc.id, label, { kind: 'writeBookmarks', tree: next });
    setTree(next);
  };

  const mutateTree = (
    nodes: BookmarkNode[],
    target: BookmarkNode,
    fn: (list: BookmarkNode[], index: number) => void
  ): BookmarkNode[] => {
    const clone = structuredClone(nodes);
    const walk = (list: BookmarkNode[]): boolean => {
      for (let i = 0; i < list.length; i++) {
        const n = list[i]!;
        if (n.title === target.title && n.pageIndex === target.pageIndex && n.children.length === target.children.length) {
          fn(list, i);
          return true;
        }
        if (walk(n.children)) return true;
      }
      return false;
    };
    walk(clone);
    return clone;
  };

  const addBookmark = (): void => {
    const next = [...tree, { title: `Page ${doc.view.page}`, pageIndex: doc.view.page - 1, children: [] }];
    void persist(next, 'Add bookmark');
  };

  const autoGenerate = async (): Promise<void> => {
    setLoading(true);
    try {
      const headings: HeadingCandidate[] = [];
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      for (let p = 0; p < doc.pageCount; p++) {
        const items = await documentService.textItems(doc.id, p);
        const page = await runtime.pdf.getPage(p + 1);
        const vp = page.getViewport({ scale: 1 });
        const rec = reconstructPage(p, vp.width, vp.height, items);
        for (const para of rec.paragraphs) {
          if (para.isHeading) headings.push({ pageIndex: p, text: para.text, fontSize: para.fontSize, y: para.y });
        }
      }
      const generated = buildOutlineFromHeadings(headings);
      if (generated.length === 0) {
        toast.warning('No headings detected', 'The document has no obvious heading structure.');
        return;
      }
      await persist(generated, 'Auto-generate bookmarks');
      toast.success('Bookmarks generated', `${headings.length} heading(s) found`);
    } finally {
      setLoading(false);
    }
  };

  const exportJson = async (): Promise<void> => {
    const target = await ipc.files.saveDialog({
      title: 'Export Bookmarks',
      filters: [{ name: 'Bookmarks JSON', extensions: ['json'] }],
      defaultPath: 'bookmarks.json'
    });
    if (!target) return;
    await ipc.files.write(target, new TextEncoder().encode(bookmarksToJson(tree)));
    toast.success('Bookmarks exported');
  };

  const importJson = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({
      title: 'Import Bookmarks',
      filters: [{ name: 'Bookmarks JSON', extensions: ['json'] }]
    });
    if (!paths?.[0]) return;
    try {
      const next = bookmarksFromJson(new TextDecoder().decode(await ipc.files.read(paths[0])));
      await persist(next, 'Import bookmarks');
    } catch (e) {
      toast.error('Import failed', (e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-app-border p-2">
        <Button variant="ghost" onClick={addBookmark} title="Bookmark current page">
          <Icon name="plus" size={13} /> Add
        </Button>
        <Button variant="ghost" onClick={() => void autoGenerate()} disabled={loading} title="Generate from headings">
          <Icon name="bulb" size={13} /> Auto
        </Button>
        <Button variant="ghost" onClick={() => void importJson()}>
          <Icon name="import" size={13} />
        </Button>
        <Button variant="ghost" onClick={() => void exportJson()} disabled={tree.length === 0}>
          <Icon name="export" size={13} />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {tree.length === 0 ? (
          <EmptyState icon="bookmark" title="No bookmarks" hint="Add one for the current page or auto-generate from headings." />
        ) : (
          tree.map((node, i) => (
            <NodeRow
              key={i}
              node={node}
              depth={0}
              onGoto={(n) => updateView(doc.id, { page: n.pageIndex + 1 })}
              onRename={(n, title) => void persist(mutateTree(tree, n, (list, idx) => { list[idx]!.title = title; }), 'Rename bookmark')}
              onDelete={(n) => void persist(mutateTree(tree, n, (list, idx) => list.splice(idx, 1)), 'Delete bookmark')}
            />
          ))
        )}
      </div>
    </div>
  );
}
