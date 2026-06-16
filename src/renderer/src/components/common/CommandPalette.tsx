/** Command palette (Ctrl+Shift+P) — fuzzy command search and execution. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { useDocumentsStore } from '../../stores/documents-store';
import { commands } from '../../services/command-registry';
import { Icon } from '../common/Icon';
import { cx } from '../../utils';

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100 - t.indexOf(q);
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 2;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  useDocumentsStore((s) => s.activeId); // re-evaluate `when` clauses
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    const all = commands.all().filter((c) => commands.isEnabled(c.id));
    if (!query.trim()) return all.slice(0, 14);
    return all
      .map((c) => ({ c, score: fuzzyScore(query, `${c.label} ${c.id}`) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)
      .map((r) => r.c);
  }, [query, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const run = (id: string): void => {
    setOpen(false);
    void commands.execute(id);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/35 pt-24 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} role="presentation">
      <div
        className="w-[520px] max-w-[calc(100vw-48px)] animate-slide-down rounded-xl border border-app-border bg-app-surface shadow-dialog"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const focusable = [...e.currentTarget.querySelectorAll<HTMLElement>('input, button')];
          if (focusable.length === 0) return;
          const first = focusable[0]!;
          const last = focusable[focusable.length - 1]!;
          if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
          } else {
            if (document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-app-border px-3 py-2.5">
          <Icon name="search" size={15} className="text-app-text-muted" />
          <input
            ref={inputRef}
            value={query}
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter' && results[index]) run(results[index]!.id);
            }}
            placeholder="Type a command…"
            aria-label="Command search"
            className="h-7 flex-1 bg-transparent text-sm outline-none placeholder:text-app-text-faint"
          />
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5" role="listbox">
          {results.length === 0 && <p className="px-3 py-4 text-center text-xs text-app-text-faint">No matching commands</p>}
          {results.map((c, i) => (
            <button key={c.id} role="option" aria-selected={i === index}
              onClick={() => run(c.id)} onMouseEnter={() => setIndex(i)}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm',
                i === index ? 'bg-app-accent-muted text-app-accent' : 'hover:bg-app-surface-3'
              )}>
              <span className="flex-1 truncate">{c.label}</span>
              {c.shortcut && (
                <kbd className="rounded border border-app-border-strong bg-app-surface-2 px-1.5 py-0.5 font-mono text-2xs text-app-text-muted">
                  {c.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
