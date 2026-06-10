/** Sidebar rails + resizable panel hosts (left: navigation, right: context). */
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useAppStore, type LeftPanelId, type RightPanelId } from '../../stores/app-store';
import { ThumbnailsPanel } from './panels/ThumbnailsPanel';
import { BookmarksPanel } from './panels/BookmarksPanel';
import { AttachmentsPanel } from './panels/AttachmentsPanel';
import { LayersPanel } from './panels/LayersPanel';
import { CommentsPanel } from './panels/CommentsPanel';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { FormattingPanel } from './panels/FormattingPanel';
import { InspectorPanel } from './panels/InspectorPanel';
import { AiAssistantPanel } from './panels/AiAssistantPanel';
import { usePluginStore } from '../../plugins/plugin-runtime';
import { PluginPanelHost } from './panels/PluginPanelHost';
import { Icon } from '../common/Icon';
import { cx } from '../../utils';

const LEFT_PANELS: Array<{ id: LeftPanelId; icon: string; label: string }> = [
  { id: 'thumbnails', icon: 'thumbnails', label: 'Page Thumbnails' },
  { id: 'bookmarks', icon: 'bookmark', label: 'Bookmarks' },
  { id: 'attachments', icon: 'attachment', label: 'Attachments' },
  { id: 'layers', icon: 'layers', label: 'Layers' },
  { id: 'comments', icon: 'comment', label: 'Comments' }
];

const RIGHT_PANELS: Array<{ id: RightPanelId; icon: string; label: string }> = [
  { id: 'properties', icon: 'properties', label: 'Properties' },
  { id: 'formatting', icon: 'formatting', label: 'Formatting' },
  { id: 'inspector', icon: 'inspector', label: 'Inspector' },
  { id: 'ai', icon: 'ai', label: 'AI Assistant' }
];

function Rail<T extends string>({
  side,
  items,
  active,
  onToggle
}: {
  side: 'left' | 'right';
  items: Array<{ id: T; icon: string; label: string }>;
  active: T | null;
  onToggle: (id: T) => void;
}) {
  return (
    <div
      className={cx(
        'vk-chrome flex w-9 shrink-0 flex-col items-center gap-1 bg-app-surface py-2',
        side === 'left' ? 'border-r border-app-border' : 'border-l border-app-border'
      )}
      role="toolbar"
      aria-label={`${side} panel selector`}
      aria-orientation="vertical"
    >
      {items.map((p) => (
        <button
          key={p.id}
          onClick={() => onToggle(p.id)}
          title={p.label}
          aria-label={p.label}
          aria-pressed={active === p.id}
          className={cx(
            'rounded-md p-1.5 transition-colors',
            active === p.id ? 'bg-app-accent-muted text-app-accent' : 'text-app-text-muted hover:bg-app-surface-3'
          )}
        >
          <Icon name={p.icon} size={17} />
        </button>
      ))}
    </div>
  );
}

function ResizablePanel({
  side,
  width,
  onResize,
  title,
  children
}: {
  side: 'left' | 'right';
  width: number;
  onResize: (w: number) => void;
  title: string;
  children: ReactNode;
}) {
  const startX = useRef(0);
  const startW = useRef(0);

  const onPointerDown = (e: React.PointerEvent): void => {
    startX.current = e.clientX;
    startW.current = width;
    const onMove = (ev: PointerEvent): void => {
      const delta = side === 'left' ? ev.clientX - startX.current : startX.current - ev.clientX;
      onResize(startW.current + delta);
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      style={{ width }}
      className={cx(
        'vk-chrome relative flex shrink-0 flex-col bg-app-surface',
        side === 'left' ? 'border-r border-app-border' : 'border-l border-app-border'
      )}
    >
      <div className="flex h-8 shrink-0 items-center border-b border-app-border px-3 text-xs font-semibold text-app-text-muted">
        {title}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <div
        onPointerDown={onPointerDown}
        className={cx(
          'absolute bottom-0 top-0 z-10 w-1 cursor-col-resize hover:bg-app-accent/40',
          side === 'left' ? 'right-0' : 'left-0'
        )}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title} panel`}
      />
    </div>
  );
}

export function LeftSidebar() {
  const leftPanel = useAppStore((s) => s.leftPanel);
  const setLeftPanel = useAppStore((s) => s.setLeftPanel);
  const width = useAppStore((s) => s.leftWidth);
  const setWidth = useAppStore((s) => s.setLeftWidth);

  const label = LEFT_PANELS.find((p) => p.id === leftPanel)?.label ?? '';
  return (
    <>
      <Rail side="left" items={LEFT_PANELS} active={leftPanel} onToggle={setLeftPanel} />
      {leftPanel && (
        <ResizablePanel side="left" width={width} onResize={setWidth} title={label}>
          {leftPanel === 'thumbnails' && <ThumbnailsPanel />}
          {leftPanel === 'bookmarks' && <BookmarksPanel />}
          {leftPanel === 'attachments' && <AttachmentsPanel />}
          {leftPanel === 'layers' && <LayersPanel />}
          {leftPanel === 'comments' && <CommentsPanel />}
        </ResizablePanel>
      )}
    </>
  );
}

export function RightSidebar() {
  const rightPanel = useAppStore((s) => s.rightPanel);
  const setRightPanel = useAppStore((s) => s.setRightPanel);
  const width = useAppStore((s) => s.rightWidth);
  const setWidth = useAppStore((s) => s.setRightWidth);
  const pluginPanels = usePluginStore((s) => s.panels);

  const allRight = [
    ...RIGHT_PANELS,
    ...pluginPanels.map((p) => ({ id: `plugin:${p.id}` as RightPanelId, icon: 'plugin', label: p.title }))
  ];
  const label = allRight.find((p) => p.id === rightPanel)?.label ?? '';
  const pluginPanel = rightPanel?.startsWith('plugin:')
    ? pluginPanels.find((p) => `plugin:${p.id}` === rightPanel)
    : undefined;

  return (
    <>
      {rightPanel && (
        <ResizablePanel side="right" width={width} onResize={setWidth} title={label}>
          {rightPanel === 'properties' && <PropertiesPanel />}
          {rightPanel === 'formatting' && <FormattingPanel />}
          {rightPanel === 'inspector' && <InspectorPanel />}
          {rightPanel === 'ai' && <AiAssistantPanel />}
          {pluginPanel && <PluginPanelHost panel={pluginPanel} />}
        </ResizablePanel>
      )}
      <Rail side="right" items={allRight} active={rightPanel} onToggle={setRightPanel} />
    </>
  );
}
