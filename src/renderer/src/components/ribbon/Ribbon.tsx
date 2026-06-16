/**
 * Ribbon — tab strip with arrow-key navigation + content groups for the
 * active tab. Tool items render pressed state; plugin buttons merge in.
 */
import { useRef } from 'react';
import { RIBBON_TABS } from './ribbon-definitions';
import type { RibbonItem } from './ribbon-definitions';
import { useAppStore, type RibbonTabId } from '../../stores/app-store';
import { useToolStore } from '../../stores/ui-stores';
import { useDocumentsStore } from '../../stores/documents-store';
import { usePluginStore } from '../../plugins/plugin-runtime';
import { commands } from '../../services/command-registry';
import { Icon, iconExists } from '../common/Icon';
import { cx } from '../../utils';

function RibbonButton({ item }: { item: RibbonItem }) {
  const activeTool = useToolStore((s) => s.tool);
  // Re-render on doc changes so `when` clauses re-evaluate.
  useDocumentsStore((s) => s.activeId);
  useDocumentsStore((s) => s.docs.length);
  // Re-render on annotation-draft history changes so Undo/Redo (and other
  // draft-dependent commands) reflect their enabled state immediately.
  useToolStore((s) => s.draftPast);
  useToolStore((s) => s.draftFuture);

  const enabled = item.commandId ? commands.isEnabled(item.commandId) : true;
  const pressed = item.kind === 'tool' && item.toolId === activeTool;
  const shortcut = item.commandId ? commands.get(item.commandId)?.shortcut : undefined;

  const onClick = (): void => {
    if (item.commandId) void commands.execute(item.commandId);
  };

  if (item.size === 'large') {
    return (
      <button
        onClick={onClick}
        disabled={!enabled}
        aria-pressed={item.kind === 'tool' ? pressed : undefined}
        title={shortcut ? `${item.label} (${shortcut})` : item.label}
        className={cx(
          'flex h-[66px] w-16 flex-col items-center justify-center gap-1 rounded-md px-1 text-2xs leading-tight',
          'transition-colors disabled:opacity-35',
          pressed ? 'bg-app-accent-muted text-app-accent' : 'text-app-text hover:bg-app-surface-3'
        )}
      >
        <Icon name={iconExists(item.icon) ? item.icon : 'file'} size={22} strokeWidth={1.5} />
        <span className="line-clamp-2 text-center">{item.label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      aria-pressed={item.kind === 'tool' ? pressed : undefined}
      title={shortcut ? `${item.label} (${shortcut})` : item.label}
      className={cx(
        'flex h-[22px] w-full min-w-0 items-center gap-1.5 rounded px-1.5 text-2xs',
        'transition-colors disabled:opacity-35',
        pressed ? 'bg-app-accent-muted text-app-accent' : 'text-app-text hover:bg-app-surface-3'
      )}
    >
      <Icon name={iconExists(item.icon) ? item.icon : 'file'} size={14} />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function RibbonGroupView({ label, items }: { label: string; items: RibbonItem[] }) {
  const large = items.filter((i) => i.size === 'large');
  const small = items.filter((i) => i.size !== 'large');
  // Stack small items into columns of three.
  const columns: RibbonItem[][] = [];
  for (let i = 0; i < small.length; i += 3) columns.push(small.slice(i, i + 3));

  return (
    <div className="flex shrink-0 flex-col border-r border-app-border px-1.5 last:border-r-0" role="group" aria-label={label}>
      <div className="flex flex-1 items-center gap-0.5">
        {large.map((item) => (
          <RibbonButton key={item.commandId ?? item.label} item={item} />
        ))}
        {columns.map((col, ci) => (
          <div key={ci} className="flex w-[118px] flex-col justify-center gap-0.5">
            {col.map((item) => (
              <RibbonButton key={item.commandId ?? item.label} item={item} />
            ))}
          </div>
        ))}
      </div>
      <div className="pb-0.5 pt-0.5 text-center text-2xs text-app-text-faint">{label}</div>
    </div>
  );
}

export function Ribbon() {
  const activeTab = useAppStore((s) => s.activeRibbonTab);
  const collapsed = useAppStore((s) => s.ribbonCollapsed);
  const setRibbonTab = useAppStore((s) => s.setRibbonTab);
  const toggleCollapsed = useAppStore((s) => s.toggleRibbonCollapsed);
  const pluginButtons = usePluginStore((s) => s.ribbonButtons);
  const stripRef = useRef<HTMLDivElement>(null);

  const tab = RIBBON_TABS.find((t) => t.id === activeTab) ?? RIBBON_TABS[0]!;

  // Merge plugin contributions for the active tab.
  const pluginGroups = new Map<string, RibbonItem[]>();
  for (const b of pluginButtons.filter((b) => b.tabId === activeTab)) {
    const list = pluginGroups.get(b.groupLabel) ?? [];
    list.push({
      kind: 'command',
      commandId: b.commandId,
      label: b.label,
      icon: b.icon ?? 'plugin',
      size: 'small'
    });
    pluginGroups.set(b.groupLabel, list);
  }

  const onStripKeyDown = (e: React.KeyboardEvent): void => {
    const ids = RIBBON_TABS.map((t) => t.id);
    const index = ids.indexOf(activeTab);
    if (e.key === 'ArrowRight') {
      setRibbonTab(ids[(index + 1) % ids.length] as RibbonTabId);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      setRibbonTab(ids[(index - 1 + ids.length) % ids.length] as RibbonTabId);
      e.preventDefault();
    }
  };

  return (
    <div className="vk-chrome shrink-0 border-b border-app-border bg-app-surface">
      {/* Tab strip */}
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Ribbon tabs"
        onKeyDown={onStripKeyDown}
        className="flex items-center gap-0.5 px-2 pt-1"
      >
        {RIBBON_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeTab}
            tabIndex={t.id === activeTab ? 0 : -1}
            onClick={() => setRibbonTab(t.id)}
            onDoubleClick={toggleCollapsed}
            className={cx(
              'rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors',
              t.id === activeTab
                ? 'bg-app-surface-2 text-app-accent shadow-[inset_0_2px_0_var(--vk-accent)]'
                : 'text-app-text-muted hover:bg-app-surface-3 hover:text-app-text'
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand ribbon' : 'Collapse ribbon'}
          aria-label={collapsed ? 'Expand ribbon' : 'Collapse ribbon'}
          className="rounded p-1 text-app-text-faint hover:bg-app-surface-3 hover:text-app-text"
        >
          <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={13} />
        </button>
      </div>

      {/* Group content */}
      {!collapsed && (
        <div className="flex items-stretch overflow-x-auto bg-app-surface-2 px-1.5 py-1" role="tabpanel">
          {tab.groups.map((g) => (
            <RibbonGroupView key={g.label} label={g.label} items={g.items} />
          ))}
          {[...pluginGroups.entries()].map(([label, items]) => (
            <RibbonGroupView key={`plugin-${label}`} label={label} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}
