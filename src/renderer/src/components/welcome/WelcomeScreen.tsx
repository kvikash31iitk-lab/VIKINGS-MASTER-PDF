/** Welcome screen — recents (pinned first), favorites, quick starts. */
import { useEffect, useState } from 'react';
import { documentService } from '../../services/document-service';
import { ipc } from '../../services/ipc';
import { commands } from '../../services/command-registry';
import { useDialogStore, toast } from '../../stores/ui-stores';
import { Icon } from '../common/Icon';
import { formatFileSize, formatTimeAgo, cx } from '../../utils';
import { APP_NAME, TAGLINE } from '@shared/constants';
import type { RecentFileEntry } from '@shared/types';

export function WelcomeScreen() {
  const [recents, setRecents] = useState<RecentFileEntry[]>([]);
  const show = useDialogStore((s) => s.show);

  const reload = (): void => {
    void ipc.recents.list().then(setRecents).catch(() => setRecents([]));
  };
  useEffect(reload, []);

  const open = async (entry: RecentFileEntry): Promise<void> => {
    try {
      const id = await documentService.openFromPath(entry.path);
      if (entry.lastPage > 1) {
        const { useDocumentsStore } = await import('../../stores/documents-store');
        useDocumentsStore.getState().updateView(id, { page: entry.lastPage });
      }
    } catch (e) {
      if ((e as Error).name === 'PasswordRequiredError') {
        show('password-prompt', { path: entry.path });
      } else {
        toast.error('Could not open file', (e as Error).message);
        void ipc.recents.remove(entry.path).then(reload);
      }
    }
  };

  const QuickAction = ({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void }) => (
    <button onClick={onClick}
      className="flex w-44 flex-col items-start gap-2 rounded-xl border border-app-border bg-app-surface p-4 text-left transition-all hover:border-app-accent hover:shadow-flyout">
      <Icon name={icon} size={22} className="text-app-accent" strokeWidth={1.4} />
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-2xs text-app-text-faint">{hint}</span>
    </button>
  );

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto bg-app-bg px-8 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-accent text-xl font-bold text-app-accent-text">V</div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{APP_NAME}</h1>
            <p className="text-xs text-app-text-muted">{TAGLINE}</p>
          </div>
        </div>

        <div className="mb-10 flex flex-wrap gap-3">
          <QuickAction icon="folder-open" label="Open PDF" hint="Browse your files (Ctrl+O)" onClick={() => void commands.execute('file.open')} />
          <QuickAction icon="file-plus" label="New PDF" hint="Blank page or template" onClick={() => void commands.execute('file.new')} />
          <QuickAction icon="convert" label="Create PDF" hint="From images, Office, HTML…" onClick={() => void commands.execute('convert.create')} />
          <QuickAction icon="merge" label="Merge PDFs" hint="Combine multiple documents" onClick={() => void commands.execute('organize.merge')} />
          <QuickAction icon="batch" label="Batch Tools" hint="Process many files at once" onClick={() => void commands.execute('tools.batch')} />
        </div>

        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-app-text-faint">Recent files</h2>
        {recents.length === 0 ? (
          <p className="text-sm text-app-text-faint">Files you open will appear here.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recents.map((entry) => (
              <div key={entry.path}
                className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-app-border hover:bg-app-surface">
                <Icon name="file" size={18} className="shrink-0 text-app-accent" />
                <button onClick={() => void open(entry)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {entry.title}
                    {entry.favorite && <Icon name="star" size={11} className="text-app-warning" />}
                  </div>
                  <div className="truncate text-2xs text-app-text-faint">
                    {entry.path} · {formatFileSize(entry.fileSize)} · {entry.pageCount} pages · {formatTimeAgo(entry.openedAt)}
                  </div>
                </button>
                <button onClick={() => void ipc.recents.setPinned(entry.path, !entry.pinned).then(reload)}
                  title={entry.pinned ? 'Unpin' : 'Pin to top'} aria-label={entry.pinned ? 'Unpin' : 'Pin'}
                  className={cx('rounded p-1.5 hover:bg-app-surface-3', entry.pinned ? 'text-app-accent' : 'text-app-text-faint opacity-0 group-hover:opacity-100')}>
                  <Icon name="pin" size={13} />
                </button>
                <button onClick={() => void ipc.recents.setFavorite(entry.path, !entry.favorite).then(reload)}
                  title="Favorite" aria-label="Toggle favorite"
                  className={cx('rounded p-1.5 hover:bg-app-surface-3', entry.favorite ? 'text-app-warning' : 'text-app-text-faint opacity-0 group-hover:opacity-100')}>
                  <Icon name="star" size={13} />
                </button>
                <button onClick={() => void ipc.recents.remove(entry.path).then(reload)}
                  title="Remove from list" aria-label="Remove from recent files"
                  className="rounded p-1.5 text-app-text-faint opacity-0 hover:bg-app-surface-3 group-hover:opacity-100">
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
