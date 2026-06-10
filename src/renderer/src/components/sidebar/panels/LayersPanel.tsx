/** Layers panel — optional content groups (OCG) with visibility toggles. */
import { useEffect, useState } from 'react';
import { documentService } from '../../../services/document-service';
import { useActiveDoc } from '../../../stores/documents-store';
import { eventBus } from '@shared/event-bus';
import { EmptyState, Toggle } from '../../common/controls';

interface LayerEntry {
  id: string;
  name: string;
  visible: boolean;
}

export function LayersPanel() {
  const doc = useActiveDoc();
  const [layers, setLayers] = useState<LayerEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!doc) return;
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      try {
        const config = await runtime.pdf.getOptionalContentConfig();
        const order = (config.getOrder() ?? []) as unknown[];
        const entries: LayerEntry[] = [];
        const walk = (nodes: unknown[]): void => {
          for (const node of nodes) {
            if (typeof node === 'string') {
              const group = config.getGroup(node) as { name?: string } | null;
              entries.push({ id: node, name: group?.name ?? node, visible: config.isVisible(node) !== false });
            } else if (node && typeof node === 'object' && 'order' in node) {
              walk((node as { order: unknown[] }).order);
            }
          }
        };
        walk(order);
        if (!cancelled) setLayers(entries);
      } catch {
        if (!cancelled) setLayers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc?.id, doc?.fileSize]);

  if (!doc) return <EmptyState icon="layers" title="No document open" />;
  if (layers.length === 0) {
    return <EmptyState icon="layers" title="No layers" hint="This document defines no optional content groups." />;
  }

  const toggle = async (id: string, visible: boolean): Promise<void> => {
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    const config = await runtime.pdf.getOptionalContentConfig();
    config.setVisibility(id, visible);
    documentService.setOcConfig(doc.id, config);
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible } : l)));
    eventBus.emit('document:reloaded', { docId: doc.id }); // forces page re-render
  };

  return (
    <div className="flex flex-col gap-1 p-2">
      {layers.map((layer) => (
        <div key={layer.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-app-surface-3">
          <span className="truncate text-xs">{layer.name}</span>
          <Toggle checked={layer.visible} onChange={(v) => void toggle(layer.id, v)} label={`Toggle layer ${layer.name}`} />
        </div>
      ))}
    </div>
  );
}
