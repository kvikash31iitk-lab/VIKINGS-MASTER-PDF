/** Inline find bar (Ctrl+F) with options and result navigation. */
import { useEffect, useRef } from 'react';
import { useSearchStore } from '../../stores/ui-stores';
import { searchService } from '../../services/search-service';
import { Icon } from '../common/Icon';
import { cx, debounce } from '../../utils';

export function FindBar() {
  const s = useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const runDebounced = useRef(debounce(() => void searchService.run(), 280)).current;

  useEffect(() => {
    if (s.findBarVisible) inputRef.current?.focus();
  }, [s.findBarVisible]);

  if (!s.findBarVisible) return null;

  const OptionToggle = ({
    label,
    title,
    active,
    onClick
  }: {
    label: string;
    title: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={() => {
        onClick();
        runDebounced();
      }}
      title={title}
      aria-pressed={active}
      className={cx(
        'rounded px-1.5 py-0.5 text-2xs font-semibold',
        active ? 'bg-app-accent text-app-accent-text' : 'text-app-text-muted hover:bg-app-surface-3'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="absolute right-6 top-2 z-30 flex items-center gap-1.5 rounded-lg border border-app-border bg-app-surface px-2 py-1.5 shadow-flyout animate-slide-down">
      <Icon name="search" size={14} className="text-app-text-muted" />
      <input
        ref={inputRef}
        value={s.query}
        placeholder="Find in document…"
        aria-label="Search query"
        onChange={(e) => {
          s.set({ query: e.target.value });
          runDebounced();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.shiftKey ? searchService.previous() : searchService.next());
          if (e.key === 'Escape') searchService.clear();
        }}
        className="h-7 w-52 bg-transparent text-sm outline-none placeholder:text-app-text-faint"
      />
      <span className="min-w-14 text-center text-2xs tabular-nums text-app-text-muted">
        {s.searching ? '…' : s.results.length > 0 ? `${s.activeIndex + 1} / ${s.results.length}` : s.query ? '0 results' : ''}
      </span>
      <OptionToggle label="Aa" title="Case sensitive" active={s.caseSensitive} onClick={() => s.set({ caseSensitive: !s.caseSensitive })} />
      <OptionToggle label="W" title="Whole word" active={s.wholeWord} onClick={() => s.set({ wholeWord: !s.wholeWord })} />
      <OptionToggle label=".*" title="Regular expression" active={s.regex} onClick={() => s.set({ regex: !s.regex })} />
      <OptionToggle label="All" title="Search all open documents" active={s.allDocs} onClick={() => s.set({ allDocs: !s.allDocs })} />
      <div className="mx-0.5 h-4 w-px bg-app-border" />
      <button onClick={() => searchService.previous()} aria-label="Previous result" className="rounded p-1 hover:bg-app-surface-3">
        <Icon name="chevron-up" size={13} />
      </button>
      <button onClick={() => searchService.next()} aria-label="Next result" className="rounded p-1 hover:bg-app-surface-3">
        <Icon name="chevron-down" size={13} />
      </button>
      <button onClick={() => searchService.clear()} aria-label="Close find bar" className="rounded p-1 hover:bg-app-surface-3">
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}
