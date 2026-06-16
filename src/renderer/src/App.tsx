/** Application shell — composes title bar, ribbon, workspace, panels, hosts. */
import { useEffect, useRef } from 'react';
import { TitleBar } from './components/titlebar/TitleBar';
import { Ribbon } from './components/ribbon/Ribbon';
import { DocumentTabStrip } from './components/tabs/DocumentTabStrip';
import { LeftSidebar, RightSidebar } from './components/sidebar/Sidebars';
import { PdfViewer } from './components/viewer/PdfViewer';
import { OrganizeGrid } from './components/viewer/OrganizeGrid';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { StatusBar } from './components/statusbar/StatusBar';
import { DialogHost } from './components/dialogs/DialogHost';
import { CommandPalette } from './components/common/CommandPalette';
import { ToastHost } from './components/common/ToastHost';
import { FileDropZone } from './components/common/FileDropZone';
import { useAppStore } from './stores/app-store';
import { useDocumentsStore, useActiveDoc } from './stores/documents-store';
import { useSettingsStore } from './stores/settings-store';
import { useUpdateStore, useBatchStore, useToastStore, toast } from './stores/ui-stores';
import { registerBuiltInCommands } from './modules/register-commands';
import { installKeyboardShortcuts } from './services/command-registry';
import { documentService } from './services/document-service';
import { openFilePath } from './services/file-open';
import { pluginRuntime } from './plugins/plugin-runtime';
import { ipc, rlog } from './services/ipc';
import { cx } from './utils';

export default function App() {
  const readingMode = useAppStore((s) => s.readingMode);
  const statusBarVisible = useSettingsStore((s) => s.settings.appearance.showStatusBar);
  const workspaceMode = useDocumentsStore((s) => s.workspaceMode);
  const doc = useActiveDoc();
  // Guards the genuinely one-time async init so it doesn't re-run when the
  // effect is re-invoked (React 18 StrictMode mounts effects twice in dev).
  const didInit = useRef(false);

  useEffect(() => {
    // ── Per-mount setup (torn down in cleanup so it survives remounts) ──
    const shortcutsDispose = installKeyboardShortcuts();
    const unsubs: Array<() => void> = [
      // OS file associations / second instance — same path as drag-and-drop.
      ipc.files.onOpenedExternally((path) => void openFilePath(path)),
      // Updates → status bar.
      ipc.updates.onEvent((e) => useUpdateStore.getState().set(e)),
      // Batch progress → store.
      ipc.batch.onProgress((e) => useBatchStore.getState().appendEvent(e)),
      // Persistence degraded (DB unavailable) → warn the user once.
      ipc.db.onDegraded((info) =>
        useToastStore.getState().push({ kind: 'warning', title: 'Persistence unavailable', detail: info.reason, sticky: true })
      )
    ];
    const persist = (): void => void documentService.persistSession();
    window.addEventListener('beforeunload', persist);

    // ── One-time global init (commands, theme, session restore, plugins) ──
    if (!didInit.current) {
      didInit.current = true;
      registerBuiltInCommands();
      void (async () => {
        await useSettingsStore.getState().load();
        const settings = useSettingsStore.getState().settings;
        useAppStore.getState().setTheme(settings.appearance.theme);
        document.documentElement.setAttribute(
          'data-animations',
          settings.appearance.animationsEnabled ? 'on' : 'off'
        );
        try {
          const previous = await ipc.session.load();
          if (previous && !previous.cleanExit && previous.state.openDocs.length > 0) {
            toast.info('Recovered from an unexpected exit', 'Restoring your previous session…');
            await documentService.restoreSession();
          } else if (settings.general.restoreSession) {
            await documentService.restoreSession();
          }
        } catch {
          /* no session */
        }
        await pluginRuntime.loadAll(settings.plugins.allowList, settings.plugins.enabled);
        rlog.info('app', 'Renderer ready');
      })();
    }

    return () => {
      window.removeEventListener('beforeunload', persist);
      shortcutsDispose();
      for (const unsub of unsubs) unsub();
    };
  }, []);

  return (
    <div className={cx('flex h-full flex-col', readingMode && 'vk-reading-mode')}>
      <TitleBar />
      <Ribbon />
      <DocumentTabStrip />
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        {doc ? (
          workspaceMode === 'organize' ? (
            <OrganizeGrid key={doc.id} doc={doc} />
          ) : (
            <PdfViewer key={doc.id} doc={doc} />
          )
        ) : (
          <WelcomeScreen />
        )}
        <RightSidebar />
      </div>
      {statusBarVisible && <StatusBar />}
      <DialogHost />
      <CommandPalette />
      <ToastHost />
      <FileDropZone />
    </div>
  );
}
