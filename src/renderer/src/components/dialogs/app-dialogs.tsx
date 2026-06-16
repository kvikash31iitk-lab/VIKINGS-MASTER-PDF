/**
 * Application dialogs: Save Changes, Settings, Shortcuts, About, Version
 * History, Template Picker, Signature Manager, Metadata, Attach File,
 * Plugin Manager, Audit Log, Form Field properties, Link target.
 */
import { useEffect, useRef, useState } from 'react';
import { documentService } from '../../services/document-service';
import { ipc } from '../../services/ipc';
import { useActiveDoc, useDocumentsStore } from '../../stores/documents-store';
import { useDialogStore, useFormsStore, toast } from '../../stores/ui-stores';
import { useSettingsStore } from '../../stores/settings-store';
import { usePluginStore, pluginRuntime } from '../../plugins/plugin-runtime';
import { commands } from '../../services/command-registry';
import { readMetadata } from '@core/pdf/metadata';
import { createBlankPdf, PAGE_SIZES } from '@core/pdf/page-ops';
import { textToPdf } from '@core/convert/text-to-pdf';
import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { Button, Field, TextInput, NumberInput, Select, Checkbox, Toggle, EmptyState, Spinner } from '../common/controls';
import { APP_NAME, COMPANY, TAGLINE } from '@shared/constants';
import { uid, baseName, formatFileSize, formatTimeAgo, canvasToPngBytes } from '../../utils';
import type { VersionEntry, SavedSignature, AuditEntry, AppInfo } from '@shared/types';
import type { ThemeName } from '@shared/settings-schema';

// ───────────────────────── Save changes ─────────────────────────

export function SaveChangesDialog() {
  const close = useDialogStore((s) => s.close);
  const payload = useDialogStore((s) => s.payload) as { docId: string } | undefined;
  const doc = useDocumentsStore((s) => s.docs.find((d) => d.id === payload?.docId));
  if (!payload || !doc) return null;

  return (
    <Modal title="Unsaved Changes" icon="warning" onClose={close}
      footer={<>
        <Button onClick={() => { close(); void documentService.close(payload.docId); }}>Don&apos;t Save</Button>
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={async () => {
          close();
          const saved = await documentService.save(payload.docId);
          if (saved) void documentService.close(payload.docId);
        }}>Save</Button>
      </>}>
      <p className="text-sm">“{doc.title}” has unsaved changes. Save before closing?</p>
    </Modal>
  );
}

// ───────────────────────── Settings ─────────────────────────

type SettingsCategory = 'general' | 'appearance' | 'ocr' | 'security' | 'performance' | 'ai' | 'plugins' | 'shortcuts';

export function SettingsDialog() {
  const close = useDialogStore((s) => s.close);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reset = useSettingsStore((s) => s.reset);
  const [category, setCategory] = useState<SettingsCategory>('general');

  const CATEGORIES: Array<{ id: SettingsCategory; label: string; icon: string }> = [
    { id: 'general', label: 'General', icon: 'settings' },
    { id: 'appearance', label: 'Appearance', icon: 'sun' },
    { id: 'ocr', label: 'OCR', icon: 'ocr' },
    { id: 'security', label: 'Security', icon: 'shield' },
    { id: 'performance', label: 'Performance', icon: 'update' },
    { id: 'ai', label: 'AI', icon: 'ai' },
    { id: 'plugins', label: 'Plugins', icon: 'plugin' },
    { id: 'shortcuts', label: 'Shortcuts', icon: 'keyboard' }
  ];

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 border-b border-app-border py-2.5 last:border-b-0">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-2xs text-app-text-faint">{hint}</div>}
      </div>
      <div className="w-56 shrink-0">{children}</div>
    </div>
  );

  return (
    <Modal title="Settings" icon="settings" onClose={close} width={680}
      footer={<>
        <Button variant="ghost" onClick={() => void reset()}>Reset all to defaults</Button>
        <Button variant="primary" onClick={close}>Done</Button>
      </>}>
      <div className="flex gap-4">
        <nav className="w-36 shrink-0">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ${category === c.id ? 'bg-app-accent-muted text-app-accent' : 'hover:bg-app-surface-3'}`}>
              <Icon name={c.icon} size={13} /> {c.label}
            </button>
          ))}
        </nav>
        <div className="min-h-72 flex-1">
          {category === 'general' && (
            <>
              <Row label="Restore previous session" hint="Reopen documents from your last session">
                <Toggle checked={settings.general.restoreSession} onChange={(v) => void update('general.restoreSession', v)} />
              </Row>
              <Row label="Confirm before closing" hint="Warn about unsaved changes">
                <Toggle checked={settings.general.confirmBeforeClose} onChange={(v) => void update('general.confirmBeforeClose', v)} />
              </Row>
              <Row label="Check for updates automatically">
                <Toggle checked={settings.general.checkUpdatesAutomatically} onChange={(v) => void update('general.checkUpdatesAutomatically', v)} />
              </Row>
              <Row label="Autosave" hint="Background version snapshots of open documents">
                <Toggle checked={settings.autosave.enabled} onChange={(v) => void update('autosave.enabled', v)} />
              </Row>
              <Row label="Autosave interval (minutes)">
                <NumberInput value={settings.autosave.intervalMinutes} onChange={(v) => void update('autosave.intervalMinutes', Math.max(1, v))} min={1} max={60} />
              </Row>
              <Row label="Versions kept per document">
                <NumberInput value={settings.autosave.maxVersionsPerDocument} onChange={(v) => void update('autosave.maxVersionsPerDocument', Math.max(1, v))} min={1} max={100} />
              </Row>
            </>
          )}
          {category === 'appearance' && (
            <>
              <Row label="Theme">
                <Select value={settings.appearance.theme}
                  onChange={(v) => { void update('appearance.theme', v); void commands.execute(`view.theme.${v as ThemeName}`); }}
                  options={[
                    { value: 'system', label: 'Follow system' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'high-contrast', label: 'High contrast' }
                  ]} />
              </Row>
              <Row label="Animations">
                <Toggle checked={settings.appearance.animationsEnabled} onChange={(v) => {
                  void update('appearance.animationsEnabled', v);
                  document.documentElement.setAttribute('data-animations', v ? 'on' : 'off');
                }} />
              </Row>
              <Row label="Show status bar">
                <Toggle checked={settings.appearance.showStatusBar} onChange={(v) => void update('appearance.showStatusBar', v)} />
              </Row>
              <Row label="Default view mode">
                <Select value={settings.viewer.defaultViewMode} onChange={(v) => void update('viewer.defaultViewMode', v)}
                  options={[
                    { value: 'continuous', label: 'Continuous' },
                    { value: 'single', label: 'Single page' },
                    { value: 'facing', label: 'Facing pages' },
                    { value: 'book', label: 'Book' }
                  ]} />
              </Row>
            </>
          )}
          {category === 'ocr' && (
            <>
              <Row label="Default mode">
                <Select value={settings.ocr.mode} onChange={(v) => void update('ocr.mode', v)}
                  options={[{ value: 'fast', label: 'Fast' }, { value: 'balanced', label: 'Balanced' }, { value: 'accurate', label: 'Accurate' }]} />
              </Row>
              <Row label="Default languages" hint="Comma-separated tesseract codes (eng, hin, fra, deu, spa, chi_sim, jpn)">
                <TextInput value={settings.ocr.defaultLanguages.join(', ')}
                  onChange={(v) => void update('ocr.defaultLanguages', v.split(/[\s,]+/).filter(Boolean))} />
              </Row>
            </>
          )}
          {category === 'security' && (
            <>
              <Row label="Default encryption algorithm">
                <Select value={settings.security.defaultAlgorithm} onChange={(v) => void update('security.defaultAlgorithm', v)}
                  options={[{ value: 'aes-256', label: 'AES-256' }, { value: 'aes-128', label: 'AES-128' }]} />
              </Row>
              <Row label="Redaction render DPI" hint="Higher = sharper redacted pages, larger files">
                <NumberInput value={settings.security.redactionDpi} onChange={(v) => void update('security.redactionDpi', Math.max(72, v))} min={72} max={600} />
              </Row>
              <Row label="Audit logging" hint="Record security-relevant events">
                <Toggle checked={settings.security.auditLoggingEnabled} onChange={(v) => void update('security.auditLoggingEnabled', v)} />
              </Row>
            </>
          )}
          {category === 'performance' && (
            <>
              <Row label="Worker threads" hint="0 = automatic (CPU cores − 1)">
                <NumberInput value={settings.performance.workerThreads} onChange={(v) => void update('performance.workerThreads', Math.max(0, v))} min={0} max={8} />
              </Row>
              <Row label="Undo history depth">
                <NumberInput value={settings.performance.undoHistoryLimit} onChange={(v) => void update('performance.undoHistoryLimit', Math.max(5, v))} min={5} max={100} />
              </Row>
              <Row label="Hardware acceleration" hint="Takes effect after restart">
                <Toggle checked={settings.performance.hardwareAcceleration} onChange={(v) => void update('performance.hardwareAcceleration', v)} />
              </Row>
            </>
          )}
          {category === 'ai' && (
            <>
              <Row label="Provider">
                <Select value={settings.ai.provider} onChange={(v) => void update('ai.provider', v)}
                  options={[
                    { value: 'offline', label: 'Built-in engine (offline)' },
                    { value: 'ollama', label: 'Ollama' },
                    { value: 'openai-compatible', label: 'OpenAI-compatible' }
                  ]} />
              </Row>
              {settings.ai.provider === 'ollama' && (
                <>
                  <Row label="Ollama URL"><TextInput value={settings.ai.ollamaUrl} onChange={(v) => void update('ai.ollamaUrl', v)} /></Row>
                  <Row label="Model"><TextInput value={settings.ai.ollamaModel} onChange={(v) => void update('ai.ollamaModel', v)} /></Row>
                </>
              )}
              {settings.ai.provider === 'openai-compatible' && (
                <>
                  <Row label="Base URL" hint="e.g. https://api.example.com"><TextInput value={settings.ai.openAiBaseUrl} onChange={(v) => void update('ai.openAiBaseUrl', v)} /></Row>
                  <Row label="Model"><TextInput value={settings.ai.openAiModel} onChange={(v) => void update('ai.openAiModel', v)} /></Row>
                  <Row label="API key"><TextInput type="password" value={settings.ai.openAiApiKey} onChange={(v) => void update('ai.openAiApiKey', v)} /></Row>
                </>
              )}
              <Row label="Store conversation history">
                <Toggle checked={settings.ai.storeHistory} onChange={(v) => void update('ai.storeHistory', v)} />
              </Row>
            </>
          )}
          {category === 'plugins' && (
            <>
              <Row label="Enable plugins" hint="Loads validated plugins from the plugins folder at startup">
                <Toggle checked={settings.plugins.enabled} onChange={(v) => void update('plugins.enabled', v)} />
              </Row>
              <Row label="Plugins folder">
                <Button onClick={() => void ipc.plugins.openFolder()}>Open folder</Button>
              </Row>
            </>
          )}
          {category === 'shortcuts' && <ShortcutsList compact />}
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── Shortcuts ─────────────────────────

function ShortcutsList({ compact }: { compact?: boolean }) {
  const all = commands.all().filter((c) => c.shortcut);
  return (
    <div className={compact ? '' : 'columns-2 gap-6'}>
      {all.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 border-b border-app-border py-1.5 text-xs">
          <span>{c.label}</span>
          <kbd className="rounded border border-app-border-strong bg-app-surface-2 px-1.5 py-0.5 font-mono text-2xs">
            {c.shortcut}
          </kbd>
        </div>
      ))}
    </div>
  );
}

export function ShortcutsDialog() {
  const close = useDialogStore((s) => s.close);
  return (
    <Modal title="Keyboard Shortcuts" icon="keyboard" onClose={close} width={620} footer={<Button variant="primary" onClick={close}>Done</Button>}>
      <ShortcutsList />
    </Modal>
  );
}

// ───────────────────────── About ─────────────────────────

export function AboutDialog() {
  const close = useDialogStore((s) => s.close);
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    void ipc.app.getInfo().then(setInfo);
  }, []);

  return (
    <Modal title={`About ${APP_NAME}`} icon="info" onClose={close} footer={<Button variant="primary" onClick={close}>Close</Button>}>
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-accent text-2xl font-bold text-app-accent-text">V</div>
        <h3 className="text-lg font-bold">{APP_NAME}</h3>
        <p className="text-xs text-app-text-muted">{TAGLINE}</p>
        {info && (
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-2xs text-app-text-muted">
            <dt>Version</dt><dd className="select-text">{info.version}</dd>
            <dt>Electron</dt><dd>{info.electron}</dd>
            <dt>Chromium</dt><dd>{info.chrome}</dd>
            <dt>Node</dt><dd>{info.node}</dd>
          </dl>
        )}
        <p className="mt-3 text-2xs text-app-text-faint">© 2026 {COMPANY}. All rights reserved.</p>
        <Button variant="ghost" onClick={() => void commands.execute('app.checkUpdates')}>Check for updates</Button>
      </div>
    </Modal>
  );
}

// ───────────────────────── Version history ─────────────────────────

export function VersionHistoryDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [versions, setVersions] = useState<VersionEntry[] | null>(null);

  useEffect(() => {
    if (doc?.path) void ipc.versions.list(doc.path).then(setVersions);
  }, [doc?.path]);

  if (!doc?.path) return null;

  const restore = async (entry: VersionEntry): Promise<void> => {
    const bytes = await ipc.versions.read(entry.versionFile);
    await documentService.openFromBytes(bytes, { title: `${doc.title} (version)` });
    toast.success('Version opened as a new tab', 'Use Save As to keep it');
    close();
  };

  return (
    <Modal title="Version History" icon="history" onClose={close} width={500} footer={<Button onClick={close}>Close</Button>}>
      {versions === null ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : versions.length === 0 ? (
        <EmptyState icon="history" title="No versions yet" hint="Autosave snapshots appear here while you edit." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-md border border-app-border px-2.5 py-2 text-xs">
              <Icon name={v.reason === 'autosave' ? 'clock' : v.reason === 'manual' ? 'save' : 'warning'} size={14} className="text-app-accent" />
              <div className="flex-1">
                <div className="font-medium capitalize">{v.reason.replace('-', ' ')}</div>
                <div className="text-2xs text-app-text-faint">{formatTimeAgo(v.createdAt)} · {formatFileSize(v.fileSize)}</div>
              </div>
              <Button variant="ghost" onClick={() => void restore(v)}>Open</Button>
              <Button variant="ghost" onClick={() => void ipc.versions.remove(v.id).then(() => setVersions((list) => list?.filter((x) => x.id !== v.id) ?? null))}>
                <Icon name="close" size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ───────────────────────── Template picker (File ▸ New) ─────────────────────────

export function TemplatePickerDialog() {
  const close = useDialogStore((s) => s.close);
  const [busy, setBusy] = useState(false);

  const create = async (kind: 'blank-a4' | 'blank-letter' | 'letterhead' | 'invoice'): Promise<void> => {
    setBusy(true);
    try {
      let bytes: Uint8Array;
      let title = 'Untitled.pdf';
      switch (kind) {
        case 'blank-a4':
          bytes = await createBlankPdf(1, PAGE_SIZES.A4!);
          break;
        case 'blank-letter':
          bytes = await createBlankPdf(1, PAGE_SIZES.Letter!);
          break;
        case 'letterhead':
          bytes = await textToPdf(
            'Vikings Technologies\n\n\n\nDate: {date}\n\nDear ____________,\n\n\n\n\n\nKind regards,\n\n____________',
            { title: 'Letterhead' }
          );
          title = 'Letterhead.pdf';
          break;
        case 'invoice':
          bytes = await textToPdf(
            'INVOICE\n\nInvoice #: INV-0001\tDate: ________\nBill To: ____________________\n\n' +
              'Description\tQty\tRate\tAmount\n' +
              '____________\t__\t____\t______\n____________\t__\t____\t______\n\n' +
              'Subtotal: ________\nTax: ________\nTOTAL: ________\n\nPayment terms: Net 30',
            { title: 'Invoice', font: 'Courier' }
          );
          title = 'Invoice.pdf';
          break;
      }
      await documentService.openFromBytes(bytes, { title });
      close();
    } finally {
      setBusy(false);
    }
  };

  const Card = ({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void }) => (
    <button onClick={onClick} disabled={busy}
      className="flex flex-col items-center gap-2 rounded-lg border border-app-border p-4 transition-colors hover:border-app-accent hover:bg-app-surface-2">
      <Icon name={icon} size={26} className="text-app-accent" strokeWidth={1.3} />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-center text-2xs text-app-text-faint">{hint}</span>
    </button>
  );

  return (
    <Modal title="New PDF" icon="file-plus" onClose={close} width={460} footer={<Button onClick={close}>Cancel</Button>}>
      <div className="grid grid-cols-2 gap-2">
        <Card icon="file" label="Blank (A4)" hint="210 × 297 mm" onClick={() => void create('blank-a4')} />
        <Card icon="file" label="Blank (Letter)" hint="8.5 × 11 in" onClick={() => void create('blank-letter')} />
        <Card icon="type" label="Letterhead" hint="Simple letter starter" onClick={() => void create('letterhead')} />
        <Card icon="bates" label="Invoice" hint="Tabular invoice starter" onClick={() => void create('invoice')} />
      </div>
    </Modal>
  );
}

// ───────────────────────── Signature manager / placement ─────────────────────────

export function SignatureManagerDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const payload = useDialogStore((s) => s.payload) as { placing?: boolean } | undefined;
  const [signatures, setSignatures] = useState<SavedSignature[] | null>(null);
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    void ipc.galleries.signatures.list().then(setSignatures);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'draw') return;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b2a6b';
    const pos = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
    };
    const down = (e: PointerEvent): void => {
      drawingRef.current = true;
      const [x, y] = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: PointerEvent): void => {
      if (!drawingRef.current) return;
      const [x, y] = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const up = (): void => {
      drawingRef.current = false;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [mode]);

  const saveCurrent = async (): Promise<void> => {
    let png: Uint8Array;
    let name: string;
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      png = await canvasToPngBytes(canvas);
      name = `Drawn ${new Date().toLocaleDateString()}`;
    } else {
      if (!typed.trim()) return;
      const canvas = document.createElement('canvas');
      canvas.width = 560;
      canvas.height = 140;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#1b2a6b';
      ctx.font = 'italic 64px "Segoe Script", "Brush Script MT", cursive';
      ctx.textBaseline = 'middle';
      ctx.fillText(typed, 16, 74);
      png = await canvasToPngBytes(canvas);
      name = typed;
    }
    await ipc.galleries.signatures.save({ id: uid('sig'), name, kind: mode, imagePng: png });
    setSignatures(await ipc.galleries.signatures.list());
    toast.success('Signature saved');
  };

  const upload = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({ filters: [{ name: 'Signature image', extensions: ['png'] }] });
    if (!paths?.[0]) return;
    await ipc.galleries.signatures.save({
      id: uid('sig'),
      name: baseName(paths[0]),
      kind: 'upload',
      imagePng: await ipc.files.read(paths[0])
    });
    setSignatures(await ipc.galleries.signatures.list());
  };

  const place = async (sig: SavedSignature): Promise<void> => {
    if (!doc) {
      toast.warning('Open a document first');
      return;
    }
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    const page = await runtime.pdf.getPage(doc.view.page);
    const vp = page.getViewport({ scale: 1 });
    const w = 160;
    const h = 56;
    await documentService.applyServerOp(
      doc.id,
      'Place signature',
      {
        kind: 'composePageContent',
        ops: [
          {
            pageIndex: doc.view.page - 1,
            op: { kind: 'image', x: vp.width - w - 48, y: 48, width: w, height: h, bytes: sig.imagePng, format: 'png' }
          }
        ]
      },
      [doc.view.page - 1]
    );
    toast.success('Signature placed', `Page ${doc.view.page} — drag-place coming to the Edit tab`);
    close();
  };

  return (
    <Modal title={payload?.placing ? 'Place Signature' : 'My Signatures'} icon="signature" onClose={close} width={520}
      footer={<Button onClick={close}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Saved signatures</h3>
          {signatures === null ? (
            <Spinner />
          ) : signatures.length === 0 ? (
            <p className="text-xs text-app-text-faint">None yet — create one below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {signatures.map((sig) => (
                <div key={sig.id} className="flex flex-col items-center gap-1 rounded-md border border-app-border p-2">
                  <img
                    alt={sig.name}
                    src={URL.createObjectURL(new Blob([sig.imagePng.slice().buffer as ArrayBuffer], { type: 'image/png' }))}
                    className="h-12 w-36 bg-white object-contain"
                  />
                  <div className="flex gap-1">
                    <Button variant="ghost" className="h-6 px-2 text-2xs" onClick={() => void place(sig)}>Place on page</Button>
                    <Button variant="ghost" className="h-6 px-2 text-2xs text-app-danger"
                      onClick={() => void ipc.galleries.signatures.remove(sig.id).then(() => ipc.galleries.signatures.list().then(setSignatures))}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-lg border border-app-border p-3">
          <div className="mb-2 flex gap-1">
            <Button variant={mode === 'draw' ? 'primary' : 'secondary'} className="h-7 px-3 text-2xs" onClick={() => setMode('draw')}>Draw</Button>
            <Button variant={mode === 'type' ? 'primary' : 'secondary'} className="h-7 px-3 text-2xs" onClick={() => setMode('type')}>Type</Button>
            <Button variant="secondary" className="h-7 px-3 text-2xs" onClick={() => void upload()}>Upload PNG</Button>
          </div>
          {mode === 'draw' ? (
            <>
              <canvas ref={canvasRef} width={560} height={140} className="w-full cursor-crosshair rounded-md border border-dashed border-app-border-strong bg-white" />
              <div className="mt-2 flex gap-2">
                <Button onClick={() => {
                  const c = canvasRef.current;
                  c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
                }}>Clear</Button>
                <Button variant="primary" onClick={() => void saveCurrent()}>Save signature</Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <TextInput value={typed} onChange={setTyped} placeholder="Type your name…" />
              <Button variant="primary" onClick={() => void saveCurrent()} disabled={!typed.trim()}>Save</Button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

// ───────────────────────── Metadata / attach / link / form field ─────────────────────────

export function MetadataEditDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [meta, setMeta] = useState({ title: '', author: '', subject: '', keywords: '' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!doc) return;
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      const m = await readMetadata(runtime.bytes);
      setMeta({ title: m.title ?? '', author: m.author ?? '', subject: m.subject ?? '', keywords: m.keywords ?? '' });
      setLoaded(true);
    })();
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return null;

  const save = async (): Promise<void> => {
    await documentService.applyServerOp(doc.id, 'Edit metadata', { kind: 'writeMetadata', meta });
    toast.success('Metadata updated');
    close();
  };

  return (
    <Modal title="Edit Metadata" icon="properties" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void save()} disabled={!loaded}>Save</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Title"><TextInput value={meta.title} onChange={(v) => setMeta({ ...meta, title: v })} /></Field>
        <Field label="Author"><TextInput value={meta.author} onChange={(v) => setMeta({ ...meta, author: v })} /></Field>
        <Field label="Subject"><TextInput value={meta.subject} onChange={(v) => setMeta({ ...meta, subject: v })} /></Field>
        <Field label="Keywords" hint="Comma separated"><TextInput value={meta.keywords} onChange={(v) => setMeta({ ...meta, keywords: v })} /></Field>
      </div>
    </Modal>
  );
}

export function AttachFileDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  if (!doc) return null;

  const attach = async (): Promise<void> => {
    if (!path) return;
    const bytes = await ipc.files.read(path);
    await documentService.applyServerOp(doc.id, 'Attach file', {
      kind: 'addAttachment',
      fileBytes: bytes,
      fileName: baseName(path),
      options: { description }
    });
    toast.success('File attached', baseName(path));
    close();
  };

  return (
    <Modal title="Attach File" icon="attachment" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void attach()} disabled={!path}>Attach</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="File">
          <div className="flex gap-2">
            <TextInput value={path ? baseName(path) : ''} onChange={() => undefined} disabled placeholder="Any document, image or ZIP…" />
            <Button onClick={() => void ipc.files.openDialog({}).then((p) => p?.[0] && setPath(p[0]))}>Browse</Button>
          </div>
        </Field>
        <Field label="Description (optional)"><TextInput value={description} onChange={setDescription} /></Field>
      </div>
    </Modal>
  );
}

export function LinkDialog() {
  const close = useDialogStore((s) => s.close);
  const payload = useDialogStore((s) => s.payload) as
    | { docId: string; pageIndex: number; rect: { x: number; y: number; w: number; h: number } }
    | undefined;
  const [url, setUrl] = useState('https://');
  if (!payload) return null;

  const apply = async (): Promise<void> => {
    const runtime = documentService.runtime(payload.docId);
    if (!runtime) return;
    const page = await runtime.pdf.getPage(payload.pageIndex + 1);
    const vp = page.getViewport({ scale: 1 });
    await documentService.applyServerOp(
      payload.docId,
      'Add link',
      {
        kind: 'addAnnotations',
        annots: [
          {
            kind: 'link', id: uid('link'), pageIndex: payload.pageIndex, color: '#2563eb', opacity: 1,
            rect: {
              x: payload.rect.x,
              y: vp.height - payload.rect.y - payload.rect.h,
              width: payload.rect.w,
              height: payload.rect.h
            },
            url
          }
        ]
      },
      [payload.pageIndex]
    );
    toast.success('Link added');
    close();
  };

  return (
    <Modal title="Add Hyperlink" icon="link" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void apply()}>Add Link</Button></>}>
      <Field label="Target URL"><TextInput value={url} onChange={setUrl} autoFocus onEnter={() => void apply()} /></Field>
    </Modal>
  );
}

export function FormFieldDialog() {
  const close = useDialogStore((s) => s.close);
  const payload = useDialogStore((s) => s.payload) as { docId: string; fieldId: string } | undefined;
  const field = useFormsStore((s) =>
    payload ? (s.byDoc[payload.docId] ?? []).find((f) => f.id === payload.fieldId) : undefined
  );
  const [name, setName] = useState(field?.name ?? '');
  const [options, setOptions] = useState(field?.options.join('\n') ?? '');
  const [required, setRequired] = useState(field?.required ?? false);
  const [multiline, setMultiline] = useState(field?.multiline ?? false);
  if (!payload || !field) return null;

  const save = (): void => {
    useFormsStore.getState().update(payload.docId, payload.fieldId, {
      name: name.trim() || field.name,
      options: options.split('\n').map((o) => o.trim()).filter(Boolean),
      required,
      multiline
    });
    close();
  };

  return (
    <Modal title={`Field Properties — ${field.kind}`} icon="inspector" onClose={close}
      footer={<>
        <Button variant="danger" onClick={() => { useFormsStore.getState().remove(payload.docId, payload.fieldId); close(); }}>Delete field</Button>
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" onClick={save}>Save</Button>
      </>}>
      <div className="flex flex-col gap-3">
        <Field label="Field name"><TextInput value={name} onChange={setName} /></Field>
        {['dropdown', 'listbox', 'radio'].includes(field.kind) && (
          <Field label="Options (one per line)">
            <textarea value={options} onChange={(e) => setOptions(e.target.value)} rows={4}
              className="w-full rounded-md border border-app-border-strong bg-app-surface px-2.5 py-1.5 text-sm focus:border-app-accent focus:outline-none" />
          </Field>
        )}
        <Checkbox checked={required} onChange={setRequired} label="Required field" />
        {field.kind === 'text' && <Checkbox checked={multiline} onChange={setMultiline} label="Multiline text" />}
      </div>
    </Modal>
  );
}

// ───────────────────────── Plugin manager / audit log / properties ─────────────────────────

export function PluginManagerDialog() {
  const close = useDialogStore((s) => s.close);
  const records = usePluginStore((s) => s.records);
  const loaded = usePluginStore((s) => s.loaded);

  useEffect(() => {
    void ipc.plugins.list().then((r) => usePluginStore.getState().setRecords(r));
  }, []);

  return (
    <Modal title="Plugin Manager" icon="plugin" onClose={close} width={520}
      footer={<>
        <Button onClick={() => void ipc.plugins.openFolder()}>Open plugins folder</Button>
        <Button variant="primary" onClick={close}>Done</Button>
      </>}>
      {records.length === 0 ? (
        <EmptyState icon="plugin" title="No plugins installed"
          hint="Drop a plugin folder (with vikings-plugin.json) into the plugins directory and restart." />
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => (
            <div key={r.manifest.id} className="rounded-lg border border-app-border p-3">
              <div className="flex items-center gap-2">
                <Icon name="plugin" size={16} className={r.error ? 'text-app-danger' : 'text-app-accent'} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{r.manifest.name} <span className="text-2xs text-app-text-faint">v{r.manifest.version}</span></div>
                  <div className="text-2xs text-app-text-faint">{r.manifest.description ?? r.manifest.id}</div>
                </div>
                {r.error ? (
                  <span className="text-2xs text-app-danger">{r.error}</span>
                ) : loaded.includes(r.manifest.id) ? (
                  <span className="text-2xs text-app-success">Loaded</span>
                ) : (
                  <Button variant="ghost" onClick={() => void pluginRuntime.load(r)}>Load</Button>
                )}
              </div>
              {r.manifest.permissions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.manifest.permissions.map((p) => (
                    <span key={p} className="rounded bg-app-surface-3 px-1.5 py-0.5 text-2xs text-app-text-muted">{p}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function AuditLogDialog() {
  const close = useDialogStore((s) => s.close);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  useEffect(() => {
    void ipc.log.listAudit().then(setEntries);
  }, []);

  return (
    <Modal title="Audit Log" icon="audit" onClose={close} width={560}
      footer={<>
        <Button onClick={() => void commands.execute('tools.exportLogs')}>Export logs…</Button>
        <Button variant="primary" onClick={close}>Close</Button>
      </>}>
      {entries === null ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon="audit" title="No audit events yet" />
      ) : (
        <div className="max-h-96 overflow-y-auto font-mono text-2xs">
          {entries.map((e) => (
            <div key={e.id} className="flex gap-3 border-b border-app-border py-1.5">
              <span className="shrink-0 text-app-text-faint">{new Date(e.createdAt ?? 0).toLocaleString()}</span>
              <span className="shrink-0 font-semibold text-app-accent">{e.event}</span>
              <span className="select-text truncate text-app-text-muted">{e.detail ? JSON.stringify(e.detail) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function DocumentPropertiesDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  if (!doc) return null;
  return (
    <Modal title="Document Properties" icon="properties" onClose={close} footer={<Button variant="primary" onClick={close}>Close</Button>}>
      <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-xs">
        <dt className="text-app-text-faint">Title</dt><dd className="select-text">{doc.title}</dd>
        <dt className="text-app-text-faint">Location</dt><dd className="select-text break-all">{doc.path ?? 'Not saved'}</dd>
        <dt className="text-app-text-faint">Pages</dt><dd>{doc.pageCount}</dd>
        <dt className="text-app-text-faint">File size</dt><dd>{formatFileSize(doc.fileSize)}</dd>
        <dt className="text-app-text-faint">Encrypted</dt><dd>{doc.encrypted ? 'Yes' : 'No'}</dd>
        <dt className="text-app-text-faint">Signed</dt><dd>{doc.signed ? 'Yes' : 'No'}</dd>
        <dt className="text-app-text-faint">OCR layer</dt><dd>{doc.ocrApplied ? 'Yes' : 'No'}</dd>
      </dl>
    </Modal>
  );
}
