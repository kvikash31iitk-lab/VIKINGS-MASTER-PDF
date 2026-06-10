/** Frameless window title bar: app icon, Quick Access Toolbar, title, window controls. */
import { useEffect } from 'react';
import { useAppStore } from '../../stores/app-store';
import { useActiveDoc } from '../../stores/documents-store';
import { commands } from '../../services/command-registry';
import { ipc } from '../../services/ipc';
import { Icon } from '../common/Icon';
import { cx } from '../../utils';

function QatButton({ icon, label, commandId }: { icon: string; label: string; commandId: string }) {
  return (
    <button
      onClick={() => void commands.execute(commandId)}
      title={label}
      aria-label={label}
      className="vk-no-drag rounded p-1.5 text-app-text-muted hover:bg-app-surface-3 hover:text-app-text"
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

export function TitleBar() {
  const doc = useActiveDoc();
  const maximized = useAppStore((s) => s.maximized);
  const setWindowState = useAppStore((s) => s.setWindowState);

  useEffect(() => ipc.win.onStateChanged((s) => setWindowState(s)), [setWindowState]);

  return (
    <div className="vk-drag vk-chrome flex h-9 shrink-0 items-center gap-1 border-b border-app-border bg-app-surface pl-2.5">
      {/* App mark */}
      <div className="flex items-center gap-1.5 pr-2">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-app-accent text-[11px] font-bold text-app-accent-text">
          V
        </div>
        <span className="text-xs font-semibold tracking-tight text-app-text-muted">Vikings Master PDF</span>
      </div>

      {/* Quick Access Toolbar */}
      <div className="vk-no-drag flex items-center gap-0.5 border-l border-app-border pl-1.5">
        <QatButton icon="save" label="Save (Ctrl+S)" commandId="file.save" />
        <QatButton icon="rotate-left" label="Undo (Ctrl+Z)" commandId="edit.undo" />
        <QatButton icon="rotate-right" label="Redo (Ctrl+Y)" commandId="edit.redo" />
        <QatButton icon="print" label="Print (Ctrl+P)" commandId="file.print" />
      </div>

      {/* Document title */}
      <div className="flex flex-1 items-center justify-center gap-1.5 truncate px-3 text-xs text-app-text-muted">
        {doc && (
          <>
            <span className="truncate">{doc.title}</span>
            {doc.dirty && <span className="text-app-accent">●</span>}
          </>
        )}
      </div>

      {/* Window controls */}
      <div className="vk-no-drag flex h-full items-stretch">
        <button
          onClick={() => void ipc.win.minimize()}
          aria-label="Minimize"
          className="flex w-11 items-center justify-center text-app-text-muted hover:bg-app-surface-3"
        >
          <Icon name="win-min" size={13} />
        </button>
        <button
          onClick={() => void ipc.win.toggleMaximize()}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          className="flex w-11 items-center justify-center text-app-text-muted hover:bg-app-surface-3"
        >
          <Icon name={maximized ? 'win-restore' : 'win-max'} size={12} />
        </button>
        <button
          onClick={() => void ipc.win.close()}
          aria-label="Close window"
          className={cx('flex w-11 items-center justify-center text-app-text-muted', 'hover:bg-app-danger hover:text-white')}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
