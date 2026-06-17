/**
 * Built-in command registration — every ribbon button, shortcut and palette
 * entry maps to a command defined here. Feature modules stay thin because
 * services own the heavy lifting.
 */
import { commands } from '../services/command-registry';
import { documentService } from '../services/document-service';
import { annotationService } from '../services/annotation-service';
import { searchService } from '../services/search-service';
import { formService } from '../services/form-service';
import { ipc } from '../services/ipc';
import { extractPages } from '@core/pdf/page-ops';
import { useDocumentsStore, activeDoc } from '../stores/documents-store';
import { useAppStore } from '../stores/app-store';
import { useDialogStore, useToolStore, useSearchStore, useFormsStore, toast } from '../stores/ui-stores';
import { PDF_FILTERS, ZOOM_LEVELS, MIN_ZOOM, MAX_ZOOM } from '@shared/constants';
import { baseName } from '../utils';
import type { ToolId, ViewMode } from '../types';
import type { ThemeName } from '@shared/settings-schema';

const needsDoc = (ctx: { hasDocument: boolean }): boolean => ctx.hasDocument;

const requireActive = (): string => {
  const id = useDocumentsStore.getState().activeId;
  if (!id) throw new Error('No document is open');
  return id;
};

function zoomStep(direction: 1 | -1): void {
  const meta = activeDoc();
  if (!meta) return;
  const current = meta.view.zoom;
  const levels = [...ZOOM_LEVELS];
  const next =
    direction === 1
      ? levels.find((z) => z > current + 0.001) ?? Math.min(current * 1.25, MAX_ZOOM)
      : [...levels].reverse().find((z) => z < current - 0.001) ?? Math.max(current / 1.25, MIN_ZOOM);
  useDocumentsStore.getState().updateView(meta.id, { zoom: next, zoomMode: 'custom' });
}

function gotoPage(delta: number | 'first' | 'last'): void {
  const meta = activeDoc();
  if (!meta) return;
  const page =
    delta === 'first' ? 1 : delta === 'last' ? meta.pageCount : Math.min(meta.pageCount, Math.max(1, meta.view.page + delta));
  useDocumentsStore.getState().updateView(meta.id, { page });
}

async function selectedOrCurrentPages(): Promise<number[]> {
  const meta = activeDoc();
  if (!meta) return [];
  const selected = useDocumentsStore.getState().selectedPages;
  return selected.length > 0 ? selected : [meta.view.page - 1];
}

export function registerBuiltInCommands(): void {
  const show = useDialogStore.getState().show;

  commands.setContextProvider(() => {
    const s = useDocumentsStore.getState();
    return { hasDocument: s.activeId !== null, docId: s.activeId };
  });

  commands.registerMany([
    // ───────────── File ─────────────
    {
      id: 'file.new',
      label: 'New PDF',
      description: 'Create a blank document or start from a template',
      shortcut: 'Ctrl+N',
      run: () => show('template-picker')
    },
    {
      id: 'file.open',
      label: 'Open…',
      shortcut: 'Ctrl+O',
      run: async () => {
        const paths = await ipc.files.openDialog({ title: 'Open PDF', filters: PDF_FILTERS, multi: true });
        if (!paths) return;
        for (const path of paths) {
          try {
            await documentService.openFromPath(path);
          } catch (e) {
            if ((e as Error).name === 'PasswordRequiredError') {
              show('password-prompt', { path });
            } else {
              toast.error(`Could not open ${baseName(path)}`, (e as Error).message);
            }
          }
        }
      }
    },
    {
      id: 'file.save',
      label: 'Save',
      shortcut: 'Ctrl+S',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        await annotationService.commitDrafts(docId);
        await documentService.save(docId);
      }
    },
    {
      id: 'file.saveAs',
      label: 'Save As…',
      shortcut: 'Ctrl+Shift+S',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        await annotationService.commitDrafts(docId);
        await documentService.saveAs(docId);
      }
    },
    {
      id: 'file.close',
      label: 'Close Document',
      shortcut: 'Ctrl+W',
      when: needsDoc,
      run: () => {
        const meta = activeDoc();
        if (!meta) return;
        if (meta.dirty) show('save-changes', { docId: meta.id });
        else void documentService.close(meta.id);
      }
    },
    {
      id: 'file.print',
      label: 'Print…',
      shortcut: 'Ctrl+P',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const runtime = documentService.runtime(docId);
        const meta = activeDoc();
        if (!runtime || !meta) return;
        await ipc.print(meta.path ? { path: meta.path } : { bytes: runtime.bytes });
      }
    },
    {
      id: 'file.export',
      label: 'Export…',
      when: needsDoc,
      run: () => show('convert-export')
    },
    {
      id: 'file.share',
      label: 'Share (Show in Folder)',
      when: (ctx) => ctx.hasDocument && !!activeDoc()?.path,
      run: () => {
        const path = activeDoc()?.path;
        if (path) void ipc.files.showInFolder(path);
      }
    },

    // ───────────── Edit / history ─────────────
    // Undo/redo covers both uncommitted annotation drafts (handled in the tool
    // store) and committed PDF byte operations. Drafts are the most recent
    // edits, so they are undone first; once exhausted we fall back to byte ops.
    {
      id: 'edit.undo',
      label: 'Undo',
      shortcut: 'Ctrl+Z',
      when: (ctx) =>
        ctx.hasDocument &&
        (useToolStore.getState().canUndoDrafts(ctx.docId ?? '') || documentService.canUndo(ctx.docId ?? '')),
      run: () => {
        const id = requireActive();
        if (!useToolStore.getState().undoDrafts(id)) void documentService.undo(id);
      }
    },
    {
      id: 'edit.redo',
      label: 'Redo',
      shortcut: 'Ctrl+Y',
      when: (ctx) =>
        ctx.hasDocument &&
        (useToolStore.getState().canRedoDrafts(ctx.docId ?? '') || documentService.canRedo(ctx.docId ?? '')),
      run: () => {
        const id = requireActive();
        if (!useToolStore.getState().redoDrafts(id)) void documentService.redo(id);
      }
    },

    // ───────────── View ─────────────
    { id: 'view.zoomIn', label: 'Zoom In', shortcut: 'Ctrl+=', when: needsDoc, run: () => zoomStep(1) },
    { id: 'view.zoomOut', label: 'Zoom Out', shortcut: 'Ctrl+-', when: needsDoc, run: () => zoomStep(-1) },
    {
      id: 'view.fitWidth',
      label: 'Fit Width',
      shortcut: 'Ctrl+1',
      when: needsDoc,
      run: () => useDocumentsStore.getState().updateView(requireActive(), { zoomMode: 'fit-width' })
    },
    {
      id: 'view.fitPage',
      label: 'Fit Page',
      shortcut: 'Ctrl+2',
      when: needsDoc,
      run: () => useDocumentsStore.getState().updateView(requireActive(), { zoomMode: 'fit-page' })
    },
    {
      id: 'view.actualSize',
      label: 'Actual Size',
      shortcut: 'Ctrl+0',
      when: needsDoc,
      run: () => useDocumentsStore.getState().updateView(requireActive(), { zoom: 1, zoomMode: 'custom' })
    },
    { id: 'view.firstPage', label: 'First Page', shortcut: 'Home', when: needsDoc, run: () => gotoPage('first') },
    { id: 'view.prevPage', label: 'Previous Page', when: needsDoc, run: () => gotoPage(-1) },
    { id: 'view.nextPage', label: 'Next Page', when: needsDoc, run: () => gotoPage(1) },
    { id: 'view.lastPage', label: 'Last Page', shortcut: 'End', when: needsDoc, run: () => gotoPage('last') },
    { id: 'view.gotoPage', label: 'Go To Page…', shortcut: 'Ctrl+G', when: needsDoc, run: () => show('go-to-page') },
    {
      id: 'view.fullscreen',
      label: 'Toggle Fullscreen',
      shortcut: 'F11',
      run: () => void ipc.win.setFullscreen(!useAppStore.getState().fullscreen)
    },
    {
      id: 'view.readingMode',
      label: 'Reading Mode',
      shortcut: 'Ctrl+H',
      when: needsDoc,
      run: () => {
        const next = !useAppStore.getState().readingMode;
        useAppStore.getState().setReadingMode(next);
        if (next) toast.info('Reading Mode', 'Press Escape or Ctrl+H to exit');
      }
    },
    ...(['continuous', 'single', 'facing', 'book'] as ViewMode[]).map((mode) => ({
      id: `view.mode.${mode}`,
      label: { continuous: 'Continuous Scroll', single: 'Single Page', facing: 'Facing Pages', book: 'Book View' }[mode]!,
      when: needsDoc,
      run: () => useDocumentsStore.getState().updateView(requireActive(), { viewMode: mode })
    })),
    ...(['light', 'dark', 'high-contrast', 'system'] as ThemeName[]).map((theme) => ({
      id: `view.theme.${theme}`,
      label: `Theme: ${theme === 'high-contrast' ? 'High Contrast' : theme[0]!.toUpperCase() + theme.slice(1)}`,
      run: () => {
        useAppStore.getState().setTheme(theme);
        void ipc.settings.set('appearance.theme', theme);
      }
    })),

    // ───────────── Tools (annotation/edit) ─────────────
    ...(
      [
        ['hand', 'Hand Tool'],
        ['select', 'Select Objects'],
        ['text-select', 'Select Text'],
        ['highlight', 'Highlight'],
        ['underline', 'Underline'],
        ['strikeout', 'Strikeout'],
        ['squiggly', 'Squiggly'],
        ['note', 'Sticky Note'],
        ['pencil', 'Pencil'],
        ['marker', 'Marker'],
        ['line', 'Line'],
        ['arrow', 'Arrow'],
        ['rect', 'Rectangle'],
        ['ellipse', 'Ellipse'],
        ['cloud', 'Cloud'],
        ['callout', 'Callout'],
        ['textbox', 'Text Box'],
        ['add-text', 'Add Text'],
        ['add-image', 'Add Image'],
        ['whiteout', 'White-out'],
        ['link', 'Add Link'],
        ['redact-area', 'Mark Redaction Area'],
        ['crop', 'Crop Pages']
      ] as Array<[ToolId, string]>
    ).map(([tool, label]) => ({
      id: `tool.${tool}`,
      label,
      when: needsDoc,
      run: () => useToolStore.getState().setTool(tool)
    })),
    {
      id: 'review.commit',
      label: 'Apply Pending Annotations',
      when: needsDoc,
      run: async () => {
        const n = await annotationService.commitDrafts(requireActive());
        if (n > 0) toast.success('Annotations applied', `${n} annotation(s) written to the PDF`);
        else toast.info('Nothing to apply');
      }
    },

    // ───────────── Organize ─────────────
    {
      id: 'organize.mode',
      label: 'Organize Pages',
      when: needsDoc,
      run: () => {
        const s = useDocumentsStore.getState();
        s.setWorkspaceMode(s.workspaceMode === 'organize' ? 'view' : 'organize');
      }
    },
    {
      id: 'organize.insertBlank',
      label: 'Insert Blank Page',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const meta = activeDoc()!;
        await documentService.applyServerOp(docId, 'Insert blank page', {
          kind: 'insertBlankPages',
          index: meta.view.page
        });
      }
    },
    { id: 'organize.insertFromFile', label: 'Insert From File…', when: needsDoc, run: () => show('insert-pages') },
    {
      id: 'organize.deletePages',
      label: 'Delete Pages',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const pages = await selectedOrCurrentPages();
        await documentService.applyServerOp(docId, `Delete ${pages.length} page(s)`, {
          kind: 'deletePages',
          indices: pages
        });
        useDocumentsStore.getState().setSelectedPages([]);
      }
    },
    {
      id: 'organize.duplicatePages',
      label: 'Duplicate Pages',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const pages = await selectedOrCurrentPages();
        await documentService.applyServerOp(docId, 'Duplicate page(s)', {
          kind: 'duplicatePages',
          indices: pages
        });
      }
    },
    {
      id: 'organize.rotateLeft',
      label: 'Rotate Left',
      shortcut: 'Ctrl+Shift+L',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const pages = await selectedOrCurrentPages();
        await documentService.applyServerOp(docId, 'Rotate left', { kind: 'rotatePages', indices: pages, delta: -90 });
      }
    },
    {
      id: 'organize.rotateRight',
      label: 'Rotate Right',
      shortcut: 'Ctrl+Shift+R',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const pages = await selectedOrCurrentPages();
        await documentService.applyServerOp(docId, 'Rotate right', { kind: 'rotatePages', indices: pages, delta: 90 });
      }
    },
    {
      id: 'organize.extract',
      label: 'Extract Pages…',
      when: needsDoc,
      run: async () => {
        const docId = requireActive();
        const runtime = documentService.runtime(docId);
        if (!runtime) return;
        const pages = await selectedOrCurrentPages();
        const extracted = await extractPages(runtime.bytes, pages);
        await documentService.openFromBytes(extracted, { title: 'Extracted Pages.pdf' });
        toast.success('Pages extracted', `${pages.length} page(s) opened as a new document`);
      }
    },
    { id: 'organize.split', label: 'Split Document…', when: needsDoc, run: () => show('split') },
    { id: 'organize.merge', label: 'Merge PDFs…', run: () => show('merge') },
    { id: 'organize.crop', label: 'Crop Pages…', when: needsDoc, run: () => show('crop') },

    // ───────────── Review ─────────────
    { id: 'review.compare', label: 'Compare Documents…', when: needsDoc, run: () => show('compare') },

    // ───────────── Forms ─────────────
    {
      id: 'forms.designer',
      label: 'Form Designer',
      when: needsDoc,
      run: () => {
        const s = useDocumentsStore.getState();
        s.setWorkspaceMode(s.workspaceMode === 'forms' ? 'view' : 'forms');
      }
    },
    ...(
      [
        ['text', 'Text Field'],
        ['checkbox', 'Checkbox'],
        ['radio', 'Radio Buttons'],
        ['dropdown', 'Dropdown'],
        ['listbox', 'List Box'],
        ['date', 'Date Picker'],
        ['signature', 'Signature Field']
      ] as Array<['text' | 'checkbox' | 'radio' | 'dropdown' | 'listbox' | 'date' | 'signature', string]>
    ).map(([kind, label]) => ({
      id: `forms.field.${kind}`,
      label: `Add ${label}`,
      when: needsDoc,
      run: () => {
        useDocumentsStore.getState().setWorkspaceMode('forms');
        useFormsStore.getState().setPendingKind(kind);
        toast.info(`${label}: drag on the page to place it`);
      }
    })),
    { id: 'forms.commit', label: 'Create Fields', when: needsDoc, run: () => formService.commitDrafts(requireActive()) },
    { id: 'forms.exportData', label: 'Export Form Data…', when: needsDoc, run: () => formService.exportData(requireActive()) },
    { id: 'forms.importData', label: 'Import Form Data…', when: needsDoc, run: () => formService.importData(requireActive()) },
    { id: 'forms.flatten', label: 'Flatten Form', when: needsDoc, run: () => formService.flatten(requireActive()) },

    // ───────────── Protect ─────────────
    { id: 'protect.encrypt', label: 'Encrypt with Password…', when: needsDoc, run: () => show('encrypt') },
    { id: 'protect.removeSecurity', label: 'Remove Security…', when: needsDoc, run: () => show('remove-security') },
    { id: 'protect.redact', label: 'Redaction…', when: needsDoc, run: () => show('redact') },
    {
      id: 'protect.redactMode',
      label: 'Mark Redactions',
      when: needsDoc,
      run: () => {
        useToolStore.getState().setTool('redact-area');
        useDocumentsStore.getState().setWorkspaceMode('redact');
      }
    },

    // ───────────── Convert / OCR ─────────────
    { id: 'convert.create', label: 'Create PDF…', run: () => show('create-pdf') },
    { id: 'convert.export', label: 'Export To…', when: needsDoc, run: () => show('convert-export') },
    { id: 'convert.compress', label: 'Compress PDF…', when: needsDoc, run: () => show('compress') },
    { id: 'convert.pdfa', label: 'PDF/A…', when: needsDoc, run: () => show('pdfa') },
    { id: 'ocr.run', label: 'Recognize Text (OCR)…', when: needsDoc, run: () => show('ocr') },

    // ───────────── eSign ─────────────
    { id: 'esign.sign', label: 'Certificate Sign…', when: needsDoc, run: () => show('sign') },
    { id: 'esign.verify', label: 'Validate Signatures', when: needsDoc, run: () => show('verify-signatures') },
    { id: 'esign.manager', label: 'My Signatures…', run: () => show('signature-manager') },
    {
      id: 'esign.place',
      label: 'Place Signature',
      when: needsDoc,
      run: () => show('signature-manager', { placing: true })
    },

    // ───────────── Decorations / tools ─────────────
    { id: 'tools.watermark', label: 'Watermark…', when: needsDoc, run: () => show('watermark') },
    { id: 'tools.headerFooter', label: 'Header && Footer…', when: needsDoc, run: () => show('header-footer') },
    { id: 'tools.bates', label: 'Bates Numbering…', when: needsDoc, run: () => show('bates') },
    { id: 'tools.stamp', label: 'Stamps…', when: needsDoc, run: () => show('stamp') },
    { id: 'tools.attach', label: 'Attach File…', when: needsDoc, run: () => show('attach-file') },
    { id: 'tools.batch', label: 'Batch Processing…', run: () => show('batch') },
    { id: 'tools.versionHistory', label: 'Version History…', when: (ctx) => ctx.hasDocument && !!activeDoc()?.path, run: () => show('version-history') },
    { id: 'tools.properties', label: 'Document Properties', when: needsDoc, run: () => show('document-properties') },
    { id: 'tools.metadata', label: 'Edit Metadata…', when: needsDoc, run: () => show('metadata-edit') },
    { id: 'tools.auditLog', label: 'Audit Log', run: () => show('audit-log') },
    { id: 'tools.plugins', label: 'Plugin Manager', run: () => show('plugin-manager') },
    { id: 'tools.exportLogs', label: 'Export Logs…', run: async () => {
        const target = await ipc.log.exportLogs();
        if (target) toast.success('Logs exported', target);
      }
    },

    // ───────────── Search / app ─────────────
    {
      id: 'search.find',
      label: 'Find',
      shortcut: 'Ctrl+F',
      when: needsDoc,
      run: () => useSearchStore.getState().set({ findBarVisible: true })
    },
    {
      id: 'search.next',
      label: 'Find Next',
      shortcut: 'F3',
      when: () => useSearchStore.getState().results.length > 0,
      run: () => searchService.next()
    },
    {
      id: 'search.previous',
      label: 'Find Previous',
      shortcut: 'Shift+F3',
      when: () => useSearchStore.getState().results.length > 0,
      run: () => searchService.previous()
    },
    {
      id: 'app.commandPalette',
      label: 'Command Palette',
      shortcut: 'Ctrl+Shift+P',
      run: () => useAppStore.getState().setCommandPaletteOpen(true)
    },
    { id: 'app.settings', label: 'Settings', shortcut: 'Ctrl+,', run: () => show('settings') },
    { id: 'app.shortcuts', label: 'Keyboard Shortcuts', shortcut: 'Ctrl+/', run: () => show('shortcuts') },
    { id: 'app.about', label: 'About Vikings Master PDF', run: () => show('about') },
    { id: 'app.checkUpdates', label: 'Check for Updates', run: () => void ipc.updates.check() },
    { id: 'ai.open', label: 'AI Assistant', shortcut: 'Ctrl+Shift+A', run: () => useAppStore.getState().setRightPanel('ai') }
  ]);
}
