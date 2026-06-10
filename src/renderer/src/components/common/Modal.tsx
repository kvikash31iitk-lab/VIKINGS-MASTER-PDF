/** Modal dialog shell with focus trap, Esc handling and Fluent styling. */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../utils';
import { Icon } from './Icon';

export function Modal({
  title,
  icon,
  children,
  footer,
  onClose,
  width = 460
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.focus();

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && node) {
        // Minimal focus trap.
        const focusables = node.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width, maxWidth: 'calc(100vw - 48px)' }}
        className="flex max-h-[calc(100vh-64px)] animate-slide-up flex-col rounded-xl border border-app-border bg-app-surface shadow-dialog"
      >
        <header className="flex items-center gap-2.5 border-b border-app-border px-4 py-3">
          {icon && <Icon name={icon} size={17} className="text-app-accent" />}
          <h2 className="flex-1 text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-app-text-muted hover:bg-app-surface-3 hover:text-app-text"
          >
            <Icon name="close" size={15} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
        {footer && (
          <footer
            className={cx(
              'flex items-center justify-end gap-2 border-t border-app-border px-4 py-3'
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
