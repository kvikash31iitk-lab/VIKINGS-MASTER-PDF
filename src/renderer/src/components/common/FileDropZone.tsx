/**
 * Global OS file drop target. Listens at the window level so dropping a file
 * anywhere over the app (welcome screen, viewer, panels) opens it. Internal
 * drags (e.g. page reordering, which carry no "Files" type) are ignored and
 * bubble to their own handlers untouched.
 */
import { useEffect, useState } from 'react';
import { openDroppedPaths } from '../../services/file-open';
import { Icon } from './Icon';

function carriesFiles(e: DragEvent): boolean {
  const types = e.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes('Files');
}

export function FileDropZone() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // dragenter/dragleave fire per-element as the cursor crosses children;
    // a depth counter prevents the overlay from flickering.
    let depth = 0;

    const onEnter = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setActive(true);
    };
    const onOver = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      // Required: without preventDefault on dragover the browser will not fire
      // a usable drop event (and would try to navigate to the file instead).
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onDrop = (e: DragEvent): void => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : [];
      // Resolve paths synchronously inside the event (dataTransfer is only
      // valid here); the actual open is async.
      const paths = files.map((f) => window.vikings.getPathForFile(f)).filter(Boolean);
      void openDroppedPaths(paths);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      data-testid="file-drop-overlay"
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-app-accent/10 backdrop-blur-[1px] animate-fade-in"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-app-accent bg-app-surface/95 px-12 py-9 shadow-dialog">
        <Icon name="import" size={42} className="text-app-accent" strokeWidth={1.4} />
        <div className="text-base font-semibold text-app-text">Drop to open</div>
        <div className="text-xs text-app-text-muted">PDF, image and text files are supported</div>
      </div>
    </div>
  );
}
