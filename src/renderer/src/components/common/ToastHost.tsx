/** Toast notifications + progress chips (bottom-right). */
import { useToastStore } from '../../stores/ui-stores';
import { Icon } from './Icon';
import { cx } from '../../utils';

const KIND_ICON: Record<string, string> = {
  info: 'info',
  success: 'check',
  warning: 'warning',
  error: 'error-circle',
  progress: 'update'
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-9 right-4 z-[95] flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id}
          className={cx(
            'pointer-events-auto animate-slide-up rounded-lg border bg-app-surface p-3 shadow-flyout',
            t.kind === 'error' ? 'border-app-danger/50' : t.kind === 'warning' ? 'border-app-warning/50' : 'border-app-border'
          )}
          role={t.kind === 'error' ? 'alert' : 'status'}>
          <div className="flex items-start gap-2.5">
            <Icon name={KIND_ICON[t.kind] ?? 'info'} size={15}
              className={cx(
                'mt-0.5 shrink-0',
                t.kind === 'success' && 'text-app-success',
                t.kind === 'error' && 'text-app-danger',
                t.kind === 'warning' && 'text-app-warning',
                (t.kind === 'info' || t.kind === 'progress') && 'text-app-accent',
                t.kind === 'progress' && 'animate-spin'
              )} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold">{t.title}</div>
              {t.detail && <div className="mt-0.5 break-words text-2xs text-app-text-muted">{t.detail}</div>}
              {t.kind === 'progress' && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-app-surface-3">
                  {t.progress !== undefined ? (
                    <div className="h-full rounded-full bg-app-accent transition-all" style={{ width: `${t.progress}%` }} />
                  ) : (
                    <div className="vk-progress-indeterminate h-full w-1/3 rounded-full bg-app-accent" />
                  )}
                </div>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification"
              className="shrink-0 rounded p-1 text-app-text-faint hover:bg-app-surface-3 hover:text-app-text">
              <Icon name="close" size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
