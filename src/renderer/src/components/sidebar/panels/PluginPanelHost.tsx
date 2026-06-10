/** Mounts a plugin-contributed panel's DOM into the sidebar. */
import { useEffect, useRef } from 'react';
import type { PluginPanel } from '../../../plugins/plugin-runtime';

export function PluginPanelHost({ panel }: { panel: PluginPanel }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    let cleanup: void | (() => void);
    try {
      cleanup = panel.mount(host);
    } catch (e) {
      host.textContent = `Plugin panel failed: ${(e as Error).message}`;
    }
    return () => {
      if (typeof cleanup === 'function') cleanup();
      host.replaceChildren();
    };
  }, [panel]);

  return <div ref={hostRef} className="h-full overflow-y-auto p-2 text-xs" />;
}
