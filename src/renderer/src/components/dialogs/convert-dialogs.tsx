/** Conversion dialogs: Export, Create PDF, Compress, PDF/A, OCR. */
import { useState } from 'react';
import { exportService, type ExportFormat } from '../../services/export-service';
import { ocrService } from '../../services/ocr-service';
import { documentService } from '../../services/document-service';
import { compressPdf, COMPRESSION_PROFILES } from '@core/pdf/compression';
import type { ImageCodec } from '@core/pdf/compression';
import { convertToPdfA, validatePdfA, type PdfALevel, type PdfAValidationReport } from '@core/pdf/pdfa';
import { imagesToPdf } from '@core/convert/image-to-pdf';
import { textToPdf } from '@core/convert/text-to-pdf';
import { rtfToText } from '@core/convert/rtf';
import { ipc } from '../../services/ipc';
import { useActiveDoc } from '../../stores/documents-store';
import { useDialogStore, useOcrStore, toast } from '../../stores/ui-stores';
import { useSettingsStore } from '../../stores/settings-store';
import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { Button, Field, TextInput, Select, RadioGroup, Checkbox, Slider, Spinner } from '../common/controls';
import { OCR_LANGUAGES, IMAGE_FILTERS, OFFICE_FILTERS } from '@shared/constants';
import { baseName, formatFileSize, canvasToJpegBytes } from '../../utils';

export function ConvertExportDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [format, setFormat] = useState<ExportFormat>('docx');
  const [range, setRange] = useState('');
  const [dpi, setDpi] = useState(150);
  const [htmlMode, setHtmlMode] = useState<'layout' | 'flow'>('layout');
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const done = await exportService.export(doc.id, {
        format,
        ...(range ? { pageRange: range } : {}),
        dpi,
        htmlMode
      });
      if (done) close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Export Document" icon="export" onClose={close} width={440}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void run()} disabled={busy}>{busy ? 'Exporting…' : 'Export'}</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Format">
          <Select value={format} onChange={setFormat} options={[
            { value: 'docx', label: 'Word Document (.docx)' },
            { value: 'xlsx', label: 'Excel Workbook (.xlsx)' },
            { value: 'pptx', label: 'PowerPoint (.pptx)' },
            { value: 'png', label: 'PNG images' },
            { value: 'jpg', label: 'JPEG images' },
            { value: 'tiff', label: 'TIFF (multi-page)' },
            { value: 'html', label: 'HTML' },
            { value: 'txt', label: 'Plain text (.txt)' },
            { value: 'rtf', label: 'Rich text (.rtf)' }
          ]} />
        </Field>
        <Field label="Pages" hint="Empty = all pages"><TextInput value={range} onChange={setRange} placeholder="All" /></Field>
        {['png', 'jpg', 'tiff', 'pptx'].includes(format) && (
          <Field label="Resolution"><Slider value={dpi} onChange={setDpi} min={72} max={600} step={6} format={(v) => `${v} DPI`} /></Field>
        )}
        {format === 'html' && (
          <Field label="HTML mode">
            <RadioGroup value={htmlMode} onChange={setHtmlMode} options={[
              { value: 'layout', label: 'Layout-preserving', description: 'Positioned spans matching the page' },
              { value: 'flow', label: 'Flowing article', description: 'Clean paragraphs for re-use' }
            ]} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function CreatePdfDialog() {
  const close = useDialogStore((s) => s.close);
  const [busy, setBusy] = useState(false);

  const openResult = async (bytes: Uint8Array, title: string): Promise<void> => {
    await documentService.openFromBytes(bytes, { title });
    toast.success('PDF created', title);
    close();
  };

  const fromImages = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({ title: 'Images to PDF', filters: IMAGE_FILTERS, multi: true });
    if (!paths || paths.length === 0) return;
    setBusy(true);
    try {
      const images = [];
      for (const path of paths) {
        let bytes = await ipc.files.read(path);
        let format: 'png' | 'jpg' = /\.jpe?g$/i.test(path) ? 'jpg' : 'png';
        if (!/\.(png|jpe?g)$/i.test(path)) {
          const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer as ArrayBuffer]));
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
          const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
          bytes = new Uint8Array(await blob!.arrayBuffer());
          format = 'png';
        }
        images.push({ bytes, format, name: baseName(path) });
      }
      await openResult(await imagesToPdf(images), 'Images.pdf');
    } finally {
      setBusy(false);
    }
  };

  const fromTextFile = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({
      title: 'Text/RTF to PDF',
      filters: [{ name: 'Text Documents', extensions: ['txt', 'rtf', 'md', 'log', 'csv'] }]
    });
    if (!paths?.[0]) return;
    setBusy(true);
    try {
      const raw = new TextDecoder().decode(await ipc.files.read(paths[0]));
      const text = paths[0].toLowerCase().endsWith('.rtf') ? rtfToText(raw) : raw;
      await openResult(await textToPdf(text, { title: baseName(paths[0]) }), baseName(paths[0]).replace(/\.[^.]+$/, '.pdf'));
    } finally {
      setBusy(false);
    }
  };

  const fromHtmlFile = async (): Promise<void> => {
    const paths = await ipc.files.openDialog({ title: 'HTML to PDF', filters: [{ name: 'HTML', extensions: ['html', 'htm'] }] });
    if (!paths?.[0]) return;
    setBusy(true);
    try {
      const html = new TextDecoder().decode(await ipc.files.read(paths[0]));
      await openResult(await ipc.convert.htmlToPdf({ html }), baseName(paths[0]).replace(/\.[^.]+$/, '.pdf'));
    } finally {
      setBusy(false);
    }
  };

  const fromOffice = async (): Promise<void> => {
    const probe = await ipc.convert.probeOffice();
    if (!probe.available) {
      toast.error('LibreOffice required', 'Install LibreOffice to convert Office documents (libreoffice.org).');
      return;
    }
    const paths = await ipc.files.openDialog({ title: 'Office to PDF', filters: OFFICE_FILTERS });
    if (!paths?.[0]) return;
    setBusy(true);
    try {
      const info = await ipc.app.getInfo();
      const result = await ipc.convert.officeToPdf({ inputPath: paths[0], outputDir: `${info.userDataPath}/conversions` });
      await openResult(result.bytes, baseName(result.path));
    } catch (e) {
      toast.error('Conversion failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fromClipboard = async (): Promise<void> => {
    setBusy(true);
    try {
      const content = await ipc.convert.readClipboard();
      if (content.imagePng) {
        await openResult(await imagesToPdf([{ bytes: content.imagePng, format: 'png' }]), 'Clipboard.pdf');
      } else if (content.text?.trim()) {
        await openResult(await textToPdf(content.text, { title: 'Clipboard' }), 'Clipboard.pdf');
      } else {
        toast.warning('Clipboard is empty');
      }
    } finally {
      setBusy(false);
    }
  };

  const Source = ({ icon, label, hint, onClick }: { icon: string; label: string; hint: string; onClick: () => void }) => (
    <button onClick={onClick} disabled={busy}
      className="flex items-start gap-3 rounded-lg border border-app-border p-3 text-left transition-colors hover:border-app-accent hover:bg-app-surface-2 disabled:opacity-50">
      <span className="text-app-accent">{busy ? <Spinner /> : <Icon name={icon} size={20} />}</span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-2xs text-app-text-faint">{hint}</span>
      </span>
    </button>
  );

  return (
    <Modal title="Create PDF" icon="file-plus" onClose={close} width={460} footer={<Button onClick={close}>Close</Button>}>
      <div className="grid grid-cols-1 gap-2">
        <Source icon="image" label="From images" hint="PNG, JPEG, BMP, GIF, WebP, TIFF — one page per image" onClick={() => void fromImages()} />
        <Source icon="type" label="From text / RTF" hint="Paginated with word wrapping" onClick={() => void fromTextFile()} />
        <Source icon="html" label="From HTML" hint="Rendered through the Chromium engine" onClick={() => void fromHtmlFile()} />
        <Source icon="word" label="From Office documents" hint="Word, Excel, PowerPoint via LibreOffice" onClick={() => void fromOffice()} />
        <Source icon="note" label="From clipboard" hint="Current clipboard text or image" onClick={() => void fromClipboard()} />
      </div>
    </Modal>
  );
}

export function CompressDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [profileId, setProfileId] = useState<'web' | 'office' | 'print'>('office');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  if (!doc) return null;

  const codec: ImageCodec = {
    async reencodeJpeg(jpegBytes, opts) {
      try {
        const bitmap = await createImageBitmap(new Blob([jpegBytes.slice().buffer as ArrayBuffer]));
        const scale = Math.min(1, opts.maxWidth / bitmap.width, opts.maxHeight / bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const bytes = await canvasToJpegBytes(canvas, opts.quality);
        return { bytes, width: canvas.width, height: canvas.height };
      } catch {
        return null; // unsupported JPEG variant — leave untouched
      }
    }
  };

  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      await documentService.applyOperation(doc.id, 'Compress', async (bytes) => {
        const result = await compressPdf(bytes, {
          profile: COMPRESSION_PROFILES[profileId]!,
          codec,
          hasher: async (data) => {
            const digest = await crypto.subtle.digest('SHA-256', data.slice().buffer as ArrayBuffer);
            return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
          }
        });
        setReport(
          `${formatFileSize(result.before)} → ${formatFileSize(result.after)} ` +
          `(${Math.round((1 - result.after / result.before) * 100)}% smaller) · ` +
          `${result.imagesRecoded} image(s) re-encoded · ${result.duplicatesRemoved} duplicate(s) removed`
        );
        return result.bytes;
      });
      toast.success('Compression complete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Compress PDF" icon="compress" onClose={close}
      footer={<><Button onClick={close}>Close</Button><Button variant="primary" onClick={() => void run()} disabled={busy}>{busy ? 'Compressing…' : 'Compress'}</Button></>}>
      <div className="flex flex-col gap-3">
        <RadioGroup value={profileId} onChange={setProfileId} options={[
          { value: 'web', label: 'Web', description: '96 DPI images, metadata stripped — smallest output' },
          { value: 'office', label: 'Office', description: '150 DPI — balanced for everyday sharing' },
          { value: 'print', label: 'Print', description: '300 DPI — visually lossless for printing' }
        ]} />
        {report && <p className="rounded-md bg-app-surface-2 px-2.5 py-2 text-xs text-app-success">{report}</p>}
      </div>
    </Modal>
  );
}

export function PdfaDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [level, setLevel] = useState<PdfALevel>('A-2b');
  const [report, setReport] = useState<PdfAValidationReport | null>(null);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const validate = async (): Promise<void> => {
    const runtime = documentService.runtime(doc.id);
    if (!runtime) return;
    setBusy(true);
    try {
      setReport(await validatePdfA(runtime.bytes, level));
    } finally {
      setBusy(false);
    }
  };

  const convert = async (): Promise<void> => {
    setBusy(true);
    try {
      await documentService.applyOperation(doc.id, `Convert to PDF/${level}`, (bytes) =>
        convertToPdfA(bytes, { level, title: doc.title })
      );
      toast.success(`Converted toward PDF/${level}`, 'Run validation to review remaining issues');
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="PDF/A Archival" icon="shield-check" onClose={close} width={500}
      footer={<>
        <Button onClick={() => void validate()} disabled={busy}>Validate</Button>
        <Button variant="primary" onClick={() => void convert()} disabled={busy}>Convert</Button>
      </>}>
      <div className="flex flex-col gap-3">
        <Field label="Conformance level">
          <RadioGroup value={level} onChange={setLevel} options={[
            { value: 'A-1b', label: 'PDF/A-1b', description: 'Maximum compatibility (ISO 19005-1)' },
            { value: 'A-2b', label: 'PDF/A-2b', description: 'Modern features, JPEG2000, layers (ISO 19005-2)' },
            { value: 'A-3b', label: 'PDF/A-3b', description: 'Allows embedded attachments (ISO 19005-3)' }
          ]} />
        </Field>
        {report && (
          <div className="rounded-lg border border-app-border p-3">
            <div className={`mb-2 text-sm font-semibold ${report.conformant ? 'text-app-success' : 'text-app-danger'}`}>
              {report.conformant ? `Structurally conformant to PDF/${report.level}` : `${report.violations.filter((v) => v.severity === 'error').length} error(s) found`}
            </div>
            <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto text-2xs">
              {report.violations.map((v, i) => (
                <li key={i} className={v.severity === 'error' ? 'text-app-danger' : 'text-app-warning'}>
                  [{v.rule}] {v.message} {v.location ? `(${v.location})` : ''}
                </li>
              ))}
              {report.violations.length === 0 && <li className="text-app-text-muted">No issues detected.</li>}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function OcrDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const settings = useSettingsStore((s) => s.settings.ocr);
  const running = useOcrStore((s) => s.running);
  const progress = useOcrStore((s) => ({ page: s.page, pageCount: s.pageCount }));
  const [languages, setLanguages] = useState<string[]>(settings.defaultLanguages);
  const [mode, setMode] = useState<'fast' | 'balanced' | 'accurate'>(settings.mode);
  const [output, setOutput] = useState<'searchable' | 'editable'>('searchable');
  const [range, setRange] = useState('');
  if (!doc) return null;

  const run = (): void => {
    void ocrService.run(doc.id, {
      languages: languages.length > 0 ? languages : ['eng'],
      mode,
      output,
      ...(range ? { pageRange: range } : {})
    });
  };

  return (
    <Modal title="Recognize Text (OCR)" icon="ocr" onClose={close} width={460}
      footer={running
        ? <><span className="mr-auto text-xs text-app-text-muted">Page {progress.page} of {progress.pageCount}…</span><Button onClick={() => ocrService.cancel()}>Cancel OCR</Button></>
        : <><Button onClick={close}>Close</Button><Button variant="primary" onClick={run}>Start OCR</Button></>}>
      <div className="flex flex-col gap-3">
        <Field label="Languages">
          <div className="grid grid-cols-2 gap-1.5">
            {OCR_LANGUAGES.map((lang) => (
              <Checkbox key={lang.code} checked={languages.includes(lang.code)} label={lang.label}
                onChange={(v) => setLanguages(v ? [...languages, lang.code] : languages.filter((c) => c !== lang.code))} />
            ))}
          </div>
        </Field>
        <Field label="Mode">
          <RadioGroup value={mode} onChange={setMode} options={[
            { value: 'fast', label: 'Fast', description: '150 DPI — quick drafts' },
            { value: 'balanced', label: 'Balanced', description: '220 DPI — recommended' },
            { value: 'accurate', label: 'Accurate', description: '300 DPI — best quality, slower' }
          ]} />
        </Field>
        <Field label="Output">
          <RadioGroup value={output} onChange={setOutput} options={[
            { value: 'searchable', label: 'Searchable PDF', description: 'Invisible text layer under the scan' },
            { value: 'editable', label: 'Editable text', description: 'Visible text boxes you can edit' }
          ]} />
        </Field>
        <Field label="Pages" hint="Language data downloads once and is cached locally.">
          <TextInput value={range} onChange={setRange} placeholder="All pages" />
        </Field>
      </div>
    </Modal>
  );
}
