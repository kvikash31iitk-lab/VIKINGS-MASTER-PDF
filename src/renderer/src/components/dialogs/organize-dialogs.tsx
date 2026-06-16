/** Organize dialogs: Split, Merge, Insert Pages, Crop, Go To Page, Compare, Batch. */
import { useState } from 'react';
import { splitByRanges, splitEveryN } from '@core/pdf/page-ops';
import { compareDocumentText, buildComparisonReportPdf } from '@core/compare/compare';
import { documentService } from '../../services/document-service';
import { ipc } from '../../services/ipc';
import { useActiveDoc, useDocumentsStore } from '../../stores/documents-store';
import { useDialogStore, useBatchStore, toast } from '../../stores/ui-stores';
import { Modal } from '../common/Modal';
import { Button, Field, TextInput, NumberInput, RadioGroup, Checkbox, Select } from '../common/controls';
import { Icon } from '../common/Icon';
import { PDF_FILTERS } from '@shared/constants';
import { baseName, uid } from '../../utils';
import type { BatchStep } from '@shared/types';

export function SplitDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [mode, setMode] = useState<'ranges' | 'every'>('ranges');
  const [ranges, setRanges] = useState('1-2, 3-');
  const [every, setEvery] = useState(1);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const run = async (): Promise<void> => {
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    const dir = await ipc.files.saveDialog({
      title: 'Choose output base name',
      filters: PDF_FILTERS,
      defaultPath: doc.title.replace(/\.pdf$/i, '-split.pdf')
    });
    if (!dir) return;
    setBusy(true);
    try {
      const parts =
        mode === 'ranges'
          ? await splitByRanges(runtime.bytes, ranges.split(';').flatMap((r) => r.split('|')).map((r) => r.trim()).filter(Boolean))
          : await splitEveryN(runtime.bytes, every);
      const stem = dir.replace(/\.pdf$/i, '');
      for (const part of parts) {
        await ipc.files.write(`${stem}-${part.label.replace(/[^\w-]/g, '_')}.pdf`, part.bytes);
      }
      toast.success('Split complete', `${parts.length} file(s) written`);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Split Document" icon="split" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void run()} disabled={busy}>Split</Button></>}>
      <div className="flex flex-col gap-3">
        <RadioGroup value={mode} onChange={setMode} options={[
          { value: 'ranges', label: 'By page ranges', description: 'Separate expressions with ; — e.g. 1-2; 3-' },
          { value: 'every', label: 'Every N pages' }
        ]} />
        {mode === 'ranges'
          ? <Field label="Ranges"><TextInput value={ranges} onChange={setRanges} /></Field>
          : <Field label="Pages per file"><NumberInput value={every} onChange={setEvery} min={1} max={doc.pageCount} /></Field>}
      </div>
    </Modal>
  );
}

export function MergeDialog() {
  const close = useDialogStore((s) => s.close);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const add = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({ title: 'Add PDFs', filters: PDF_FILTERS, multi: true });
    if (paths) setFiles((f) => [...f, ...paths.filter((p) => !f.includes(p))]);
  };

  const move = (index: number, delta: number): void => {
    setFiles((f) => {
      const next = [...f];
      const target = index + delta;
      if (target < 0 || target >= next.length) return f;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  };

  const run = async (): Promise<void> => {
    if (files.length < 2) {
      toast.warning('Add at least two PDFs');
      return;
    }
    setBusy(true);
    try {
      const buffers = [];
      for (const path of files) buffers.push(await ipc.files.read(path));
      const merged = await ipc.pdf.mergeFiles(buffers);
      await documentService.openFromBytes(merged, { title: 'Merged.pdf' });
      toast.success('Merge complete', `${files.length} documents combined`);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Merge PDFs" icon="merge" onClose={close} width={480}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void run()} disabled={busy || files.length < 2}>{busy ? 'Merging…' : 'Merge'}</Button></>}>
      <div className="flex flex-col gap-2">
        <Button onClick={() => void add()}><Icon name="plus" size={13} /> Add files…</Button>
        {files.map((path, i) => (
          <div key={path} className="flex items-center gap-1.5 rounded-md border border-app-border px-2 py-1.5 text-xs">
            <span className="w-5 text-app-text-faint">{i + 1}.</span>
            <span className="flex-1 truncate" title={path}>{baseName(path)}</span>
            <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded p-0.5 hover:bg-app-surface-3"><Icon name="chevron-up" size={12} /></button>
            <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded p-0.5 hover:bg-app-surface-3"><Icon name="chevron-down" size={12} /></button>
            <button onClick={() => setFiles((f) => f.filter((p) => p !== path))} aria-label="Remove" className="rounded p-0.5 hover:bg-app-surface-3"><Icon name="close" size={12} /></button>
          </div>
        ))}
        {files.length === 0 && <p className="py-4 text-center text-xs text-app-text-faint">No files added yet.</p>}
      </div>
    </Modal>
  );
}

export function InsertPagesDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [sourcePath, setSourcePath] = useState('');
  const [position, setPosition] = useState<'before' | 'after' | 'end'>('after');
  const [range, setRange] = useState('');
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const run = async (): Promise<void> => {
    if (!sourcePath) {
      toast.warning('Choose a source PDF');
      return;
    }
    setBusy(true);
    try {
      const source = await ipc.files.read(sourcePath);
      const at = position === 'end' ? doc.pageCount : position === 'before' ? doc.view.page - 1 : doc.view.page;
      await documentService.applyServerOp(doc.id, 'Insert pages', {
        kind: 'insertPagesFromPdf',
        sourceBytes: source,
        index: at,
        sourceRange: range || undefined
      });
      toast.success('Pages inserted');
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Insert Pages From File" icon="insert-page" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void run()} disabled={busy}>Insert</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Source PDF">
          <div className="flex gap-2">
            <TextInput value={sourcePath ? baseName(sourcePath) : ''} onChange={() => undefined} disabled placeholder="Choose file…" />
            <Button onClick={() => void ipc.files.openDialog({ filters: PDF_FILTERS }).then((p) => p?.[0] && setSourcePath(p[0]))}>Browse</Button>
          </div>
        </Field>
        <Field label="Pages from source" hint="Empty = all pages"><TextInput value={range} onChange={setRange} placeholder="All" /></Field>
        <Field label="Insert position">
          <RadioGroup value={position} onChange={setPosition} options={[
            { value: 'before', label: `Before page ${doc.view.page}` },
            { value: 'after', label: `After page ${doc.view.page}` },
            { value: 'end', label: 'At the end' }
          ]} />
        </Field>
      </div>
    </Modal>
  );
}

export function CropDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const payload = useDialogStore((s) => s.payload) as
    | { docId: string; pageIndex: number; rect: { x: number; y: number; w: number; h: number } }
    | undefined;
  const [applyAll, setApplyAll] = useState(false);
  const [margin, setMargin] = useState(36);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      const targetPage = payload?.pageIndex ?? doc.view.page - 1;
      const page = await runtime.pdf.getPage(targetPage + 1);
      const vp = page.getViewport({ scale: 1 });
      // Payload rect arrives in viewer space (y-down) — convert to PDF space.
      const box = payload
        ? { x: payload.rect.x, y: vp.height - payload.rect.y - payload.rect.h, width: payload.rect.w, height: payload.rect.h }
        : { x: margin, y: margin, width: vp.width - margin * 2, height: vp.height - margin * 2 };
      const indices = applyAll ? Array.from({ length: doc.pageCount }, (_, i) => i) : [targetPage];
      await documentService.applyServerOp(doc.id, 'Crop pages', { kind: 'cropPages', indices, box }, indices);
      toast.success('Crop applied', applyAll ? 'All pages' : `Page ${targetPage + 1}`);
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Crop Pages" icon="crop-t" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void run()} disabled={busy}>Crop</Button></>}>
      <div className="flex flex-col gap-3">
        {payload
          ? <p className="text-xs text-app-text-muted">Using the rectangle you drew on page {payload.pageIndex + 1}.</p>
          : <Field label="Margin to trim (pt)"><NumberInput value={margin} onChange={setMargin} min={0} max={200} /></Field>}
        <Checkbox checked={applyAll} onChange={setApplyAll} label="Apply to all pages" />
        <p className="text-2xs text-app-text-faint">Cropping adjusts the visible area (CropBox); content is preserved.</p>
      </div>
    </Modal>
  );
}

export function GoToPageDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const updateView = useDocumentsStore((s) => s.updateView);
  const [value, setValue] = useState('');
  if (!doc) return null;

  const go = (): void => {
    const n = parseInt(value, 10);
    if (!Number.isNaN(n)) {
      updateView(doc.id, { page: Math.min(doc.pageCount, Math.max(1, n)) });
      close();
    }
  };

  return (
    <Modal title="Go To Page" icon="pages" onClose={close}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={go}>Go</Button></>}>
      <Field label={`Page number (1 – ${doc.pageCount})`}>
        <TextInput value={value} onChange={setValue} autoFocus onEnter={go} placeholder={String(doc.view.page)} />
      </Field>
    </Modal>
  );
}

export function CompareDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [otherPath, setOtherPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  if (!doc) return null;

  const run = async (): Promise<void> => {
    if (!otherPath) {
      toast.warning('Choose a document to compare against');
      return;
    }
    setBusy(true);
    try {
      const currentPages = await documentService.allPagesText(doc.id);
      const otherId = await documentService.openFromPath(otherPath);
      const otherPages = await documentService.allPagesText(otherId);
      useDocumentsStore.getState().setActive(doc.id);

      const result = compareDocumentText(currentPages, otherPages);
      setSummary(
        result.identical
          ? 'No textual differences detected.'
          : `${result.changedPages.length} changed page(s): ${result.changedPages.map((p) => p + 1).join(', ')} — ` +
            `${result.totalInsertions} insertion(s), ${result.totalDeletions} deletion(s).`
      );
      const report = await buildComparisonReportPdf(result, {
        originalName: doc.title,
        revisedName: baseName(otherPath)
      });
      await documentService.openFromBytes(report, { title: 'Comparison Report.pdf' });
      toast.success('Comparison complete', 'Both documents and the report are open side-by-side in tabs');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Compare Documents" icon="compare" onClose={close} width={460}
      footer={<><Button onClick={close}>Close</Button><Button variant="primary" onClick={() => void run()} disabled={busy}>{busy ? 'Comparing…' : 'Compare'}</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Original"><TextInput value={doc.title} onChange={() => undefined} disabled /></Field>
        <Field label="Revised document">
          <div className="flex gap-2">
            <TextInput value={otherPath ? baseName(otherPath) : ''} onChange={() => undefined} disabled placeholder="Choose file…" />
            <Button onClick={() => void ipc.files.openDialog({ filters: PDF_FILTERS }).then((p) => p?.[0] && setOtherPath(p[0]))}>Browse</Button>
          </div>
        </Field>
        {summary && <p className="rounded-md bg-app-surface-2 px-2.5 py-2 text-xs">{summary}</p>}
      </div>
    </Modal>
  );
}

export function BatchDialog() {
  const close = useDialogStore((s) => s.close);
  const batch = useBatchStore();
  const [inputs, setInputs] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState('');
  const [stepKinds, setStepKinds] = useState<string[]>([]);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [renamePattern, setRenamePattern] = useState('{name}-{n}');
  const [compressProfile, setCompressProfile] = useState<'web' | 'office' | 'print'>('office');
  const [encryptPassword, setEncryptPassword] = useState('');

  const addFiles = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({ title: 'Batch input PDFs', filters: PDF_FILTERS, multi: true });
    if (paths) setInputs((f) => [...new Set([...f, ...paths])]);
  };

  const chooseOutput = async (): Promise<void> => {
    const target = await ipc.files.saveDialog({ title: 'Choose output folder (type any name)', defaultPath: 'output-folder' });
    if (target) setOutputDir(target.replace(/[\\/][^\\/]*$/, ''));
  };

  const run = async (): Promise<void> => {
    if (inputs.length === 0 || !outputDir) {
      toast.warning('Add input files and choose an output folder');
      return;
    }
    const steps: BatchStep[] = [];
    if (stepKinds.includes('watermark')) {
      steps.push({
        kind: 'watermark',
        options: { kind: 'text', text: watermarkText, fontSize: 48, color: '#d13438', opacity: 0.3, rotation: 45, zone: 'center', tiled: false, behindContent: false }
      });
    }
    if (stepKinds.includes('bates')) {
      steps.push({ kind: 'bates', options: { prefix: 'VIK-', suffix: '', startNumber: 1, padWidth: 6, position: 'bottom-right', fontSize: 10, color: '#000000', margin: 28 } });
    }
    if (stepKinds.includes('compress')) steps.push({ kind: 'compress', options: { profile: compressProfile } });
    if (stepKinds.includes('encrypt') && encryptPassword) {
      steps.push({
        kind: 'encrypt',
        options: {
          algorithm: 'aes-256', userPassword: encryptPassword, ownerPassword: encryptPassword,
          permissions: { printing: true, copying: false, modifying: false, annotating: true, formFilling: true }
        }
      });
    }
    if (stepKinds.includes('merge-into')) steps.push({ kind: 'merge-into', options: {} });
    if (steps.length === 0) {
      toast.warning('Choose at least one operation');
      return;
    }
    const jobId = uid('batch');
    useBatchStore.getState().set({ running: true, jobId, events: [] });
    await ipc.batch.run({ id: jobId, inputPaths: inputs, outputDir, steps, renamePattern });
  };

  const StepBox = ({ id, label }: { id: string; label: string }) => (
    <Checkbox checked={stepKinds.includes(id)} label={label}
      onChange={(v) => setStepKinds(v ? [...stepKinds, id] : stepKinds.filter((s) => s !== id))} />
  );

  return (
    <Modal title="Batch Processing" icon="batch" onClose={close} width={520}
      footer={batch.running
        ? <><span className="mr-auto text-xs text-app-text-muted">Processing…</span><Button onClick={() => batch.jobId && void ipc.batch.cancel(batch.jobId)}>Cancel</Button></>
        : <><Button onClick={close}>Close</Button><Button variant="primary" onClick={() => void run()}>Run Batch</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label={`Input files (${inputs.length})`}>
          <div className="flex gap-2">
            <Button onClick={() => void addFiles()}><Icon name="plus" size={13} /> Add PDFs…</Button>
            {inputs.length > 0 && <Button variant="ghost" onClick={() => setInputs([])}>Clear</Button>}
          </div>
        </Field>
        <Field label="Output folder">
          <div className="flex gap-2">
            <TextInput value={outputDir} onChange={setOutputDir} placeholder="Choose folder…" />
            <Button onClick={() => void chooseOutput()}>Browse</Button>
          </div>
        </Field>
        <Field label="Operations (run in order)">
          <div className="grid grid-cols-2 gap-1.5">
            <StepBox id="watermark" label="Watermark" />
            <StepBox id="bates" label="Bates numbering" />
            <StepBox id="compress" label="Compress" />
            <StepBox id="encrypt" label="Encrypt (AES-256)" />
            <StepBox id="merge-into" label="Merge into one PDF" />
          </div>
        </Field>
        {stepKinds.includes('watermark') && (
          <Field label="Watermark text"><TextInput value={watermarkText} onChange={setWatermarkText} /></Field>
        )}
        {stepKinds.includes('compress') && (
          <Field label="Compression profile">
            <Select value={compressProfile} onChange={setCompressProfile}
              options={[{ value: 'web', label: 'Web (96 DPI)' }, { value: 'office', label: 'Office (150 DPI)' }, { value: 'print', label: 'Print (300 DPI)' }]} />
          </Field>
        )}
        {stepKinds.includes('encrypt') && (
          <Field label="Password"><TextInput type="password" value={encryptPassword} onChange={setEncryptPassword} /></Field>
        )}
        <Field label="Rename pattern" hint="Tokens: {name} {n} {date}">
          <TextInput value={renamePattern} onChange={setRenamePattern} />
        </Field>
        {batch.events.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-md bg-app-surface-2 p-2 font-mono text-2xs">
            {batch.events.slice(-30).map((e, i) => (
              <div key={i} className={e.status === 'file-error' ? 'text-app-danger' : e.status === 'done' ? 'text-app-success' : 'text-app-text-muted'}>
                {e.status === 'done'
                  ? '✓ Batch finished'
                  : e.status === 'cancelled'
                    ? '✕ Cancelled'
                    : `${e.fileIndex + 1}/${e.fileCount} ${baseName(e.filePath)} ${e.stepKind ?? ''} ${e.status}${e.message ? ` — ${e.message}` : ''}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
