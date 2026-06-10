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
import { useAppStore } from './stores/app-store';
import { useDocumentsStore, useActiveDoc } from './stores/documents-store';
import { useSettingsStore } from './stores/settings-store';
import { useUpdateStore, useBatchStore, useDialogStore, toast } from './stores/ui-stores';
import { registerBuiltInCommands } from './modules/register-commands';
import { installKeyboardShortcuts } from './services/command-registry';
import { documentService } from './services/document-service';
import { pluginRuntime } from './plugins/plugin-runtime';
import { ipc, rlog } from './services/ipc';
import { cx } from './utils';

let bootstrapped = false;

export default function App() {
  const readingMode = useAppStore((s) => s.readingMode);
  const statusBarVisible = useSettingsStore((s) => s.settings.appearance.showStatusBar);
  const workspaceMode = useDocumentsStore((s) => s.workspaceMode);
  const doc = useActiveDoc();
  const shortcutsCleanup = useRef<(() => void) | null>(null);

  // ── One-time bootstrap ──
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;

    registerBuiltInCommands();
    shortcutsCleanup.current = installKeyboardShortcuts();

    void (async () => {
      // Settings → theme/animations.
      await useSettingsStore.getState().load();
      const settings = useSettingsStore.getState().settings;
      useAppStore.getState().setTheme(settings.appearance.theme);
      document.documentElement.setAttribute('data-animations', settings.appearance.animationsEnabled ? 'on' : 'off');

      // OS file associations / second instance.
      ipc.files.onOpenedExternally((path) => {
        void documentService.openFromPath(path).catch((e: Error) => {
          if (e.name === 'PasswordRequiredError') {
            useDialogStore.getState().show('password-prompt', { path });
          } else {
            toast.error('Could not open file', e.message);
          }
        });
      });

      // Updates → status bar.
      ipc.updates.onEvent((e) => useUpdateStore.getState().set(e));

      // Batch progress → store.
      ipc.batch.onProgress((e) => useBatchStore.getState().appendEvent(e));

      // Crash recovery / session restore.
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

      // Plugins.
      await pluginRuntime.loadAll(settings.plugins.allowList, settings.plugins.enabled);

      rlog.info('app', 'Renderer ready');
    })();

    // Persist session on quit-ish moments.
    const persist = (): void => void documentService.persistSession();
    window.addEventListener('beforeunload', persist);
    return () => {
      window.removeEventListener('beforeunload', persist);
      shortcutsCleanup.current?.();
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
    </div>
  );
}
