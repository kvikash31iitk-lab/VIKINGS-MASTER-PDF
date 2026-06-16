/** Decoration dialogs: Watermark, Header & Footer, Bates numbering, Stamps. */
import { useState } from 'react';
import type { WatermarkZone } from '@core/pdf/watermark';
import { defaultHeaderFooterOptions } from '@core/pdf/header-footer';
import { applyBatesNumbering, defaultBatesOptions, formatBates } from '@core/pdf/bates';
import { BUILT_IN_STAMP_SPECS, type StampSpec } from '@core/pdf/stamps';
import { documentService } from '../../services/document-service';
import { useActiveDoc } from '../../stores/documents-store';
import { useDialogStore, toast } from '../../stores/ui-stores';
import { ipc } from '../../services/ipc';
import { Modal } from '../common/Modal';
import { Button, Field, TextInput, NumberInput, Select, Checkbox, Slider, ColorPicker, RadioGroup } from '../common/controls';
import { uid } from '../../utils';
import { IMAGE_FILTERS } from '@shared/constants';
import type { StampDefinition } from '@shared/types';

const ZONES: Array<{ value: WatermarkZone; label: string }> = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'middle-left', label: 'Middle Left' },
  { value: 'center', label: 'Center' },
  { value: 'middle-right', label: 'Middle Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' }
];

export function WatermarkDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [kind, setKind] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState('#d13438');
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(45);
  const [zone, setZone] = useState<WatermarkZone>('center');
  const [tiled, setTiled] = useState(false);
  const [behind, setBehind] = useState(false);
  const [range, setRange] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [scale, setScale] = useState(100);
  const [busy, setBusy] = useState(false);

  if (!doc) return null;

  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      if (kind === 'text') {
        await documentService.applyServerOp(doc.id, 'Watermark', {
          kind: 'applyWatermark',
          options: {
            kind: 'text', text, fontSize, color, opacity: opacity / 100, rotation, zone,
            tiled, behindContent: behind, ...(range ? { pageRange: range } : {})
          }
        });
      } else {
        if (!imagePath) {
          toast.warning('Choose an image first');
          return;
        }
        const bytes = await ipc.files.read(imagePath);
        const format = /\.jpe?g$/i.test(imagePath) ? 'jpg' : 'png';
        await documentService.applyServerOp(doc.id, 'Watermark', {
          kind: 'applyWatermark',
          options: {
            kind: 'image', imageBytes: bytes, imageFormat: format, scale: scale / 100,
            opacity: opacity / 100, rotation, zone, tiled, behindContent: behind,
            ...(range ? { pageRange: range } : {})
          }
        });
      }
      toast.success('Watermark applied');
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add Watermark" icon="watermark" onClose={close} width={480}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void apply()} disabled={busy}>Apply</Button></>}>
      <div className="flex flex-col gap-3">
        <RadioGroup inline value={kind} onChange={setKind}
          options={[{ value: 'text', label: 'Text' }, { value: 'image', label: 'Image' }]} />
        {kind === 'text' ? (
          <>
            <Field label="Text"><TextInput value={text} onChange={setText} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Font size"><NumberInput value={fontSize} onChange={setFontSize} min={6} max={300} /></Field>
              <Field label="Color"><ColorPicker value={color} onChange={setColor} /></Field>
            </div>
          </>
        ) : (
          <>
            <Field label="Image file">
              <div className="flex gap-2">
                <TextInput value={imagePath} onChange={setImagePath} placeholder="Choose PNG or JPEG…" />
                <Button onClick={() => void ipc.files.openDialog({ filters: IMAGE_FILTERS }).then((p) => p?.[0] && setImagePath(p[0]))}>
                  Browse
                </Button>
              </div>
            </Field>
            <Field label="Scale"><Slider value={scale} onChange={setScale} min={5} max={400} format={(v) => `${v}%`} /></Field>
          </>
        )}
        <Field label="Opacity"><Slider value={opacity} onChange={setOpacity} min={5} max={100} format={(v) => `${v}%`} /></Field>
        <Field label="Rotation"><Slider value={rotation} onChange={setRotation} min={-180} max={180} format={(v) => `${v}°`} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Position"><Select value={zone} onChange={setZone} options={ZONES} /></Field>
          <Field label="Pages" hint="Empty = all pages. Example: 1-3,5,9-">
            <TextInput value={range} onChange={setRange} placeholder="All pages" />
          </Field>
        </div>
        <div className="flex gap-5">
          <Checkbox checked={tiled} onChange={setTiled} label="Tile entire page" />
          <Checkbox checked={behind} onChange={setBehind} label="Behind content" />
        </div>
      </div>
    </Modal>
  );
}

export function HeaderFooterDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [slots, setSlots] = useState({ headerLeft: '', headerCenter: '', headerRight: '', footerLeft: '', footerCenter: 'Page {page} of {pages}', footerRight: '' });
  const [fontSize, setFontSize] = useState(9);
  const [range, setRange] = useState('');
  const [startNumber, setStartNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      await documentService.applyServerOp(doc.id, 'Header & footer', {
        kind: 'applyHeaderFooter',
        options: {
          ...defaultHeaderFooterOptions(),
          ...Object.fromEntries(Object.entries(slots).filter(([, v]) => v)),
          fontSize,
          fileName: doc.title,
          startNumber,
          ...(range ? { pageRange: range } : {})
        }
      });
      toast.success('Header & footer applied');
      close();
    } finally {
      setBusy(false);
    }
  };

  const Slot = ({ id, label }: { id: keyof typeof slots; label: string }) => (
    <Field label={label}>
      <TextInput value={slots[id]} onChange={(v) => setSlots((s) => ({ ...s, [id]: v }))} placeholder="—" />
    </Field>
  );

  return (
    <Modal title="Header & Footer" icon="header-footer" onClose={close} width={520}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void apply()} disabled={busy}>Apply</Button></>}>
      <div className="flex flex-col gap-3">
        <p className="rounded-md bg-app-surface-2 px-2.5 py-2 text-2xs text-app-text-muted">
          Tokens: <code>{'{page} {pages} {date} {time} {filename}'}</code>
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Slot id="headerLeft" label="Header left" /><Slot id="headerCenter" label="Header center" /><Slot id="headerRight" label="Header right" />
          <Slot id="footerLeft" label="Footer left" /><Slot id="footerCenter" label="Footer center" /><Slot id="footerRight" label="Footer right" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Font size"><NumberInput value={fontSize} onChange={setFontSize} min={6} max={24} /></Field>
          <Field label="First page number"><NumberInput value={startNumber} onChange={setStartNumber} min={0} /></Field>
          <Field label="Pages"><TextInput value={range} onChange={setRange} placeholder="All" /></Field>
        </div>
      </div>
    </Modal>
  );
}

export function BatesDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [opts, setOpts] = useState(defaultBatesOptions());
  const [busy, setBusy] = useState(false);
  if (!doc) return null;

  const apply = async (): Promise<void> => {
    setBusy(true);
    try {
      await documentService.applyOperation(doc.id, 'Bates numbering', async (bytes) => {
        const result = await applyBatesNumbering(bytes, opts);
        toast.success('Bates numbering applied', `${result.applied} page(s); next number ${result.nextNumber}`);
        return result.bytes;
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Bates Numbering" icon="bates" onClose={close} width={440}
      footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" onClick={() => void apply()} disabled={busy}>Apply</Button></>}>
      <div className="flex flex-col gap-3">
        <div className="rounded-md bg-app-surface-2 px-2.5 py-2 text-center font-mono text-sm">
          {formatBates(opts, opts.startNumber)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prefix"><TextInput value={opts.prefix} onChange={(v) => setOpts({ ...opts, prefix: v })} /></Field>
          <Field label="Suffix"><TextInput value={opts.suffix} onChange={(v) => setOpts({ ...opts, suffix: v })} /></Field>
          <Field label="Start number"><NumberInput value={opts.startNumber} onChange={(v) => setOpts({ ...opts, startNumber: v })} min={0} /></Field>
          <Field label="Digits"><NumberInput value={opts.padWidth} onChange={(v) => setOpts({ ...opts, padWidth: v })} min={1} max={12} /></Field>
          <Field label="Position">
            <Select value={opts.position} onChange={(v) => setOpts({ ...opts, position: v })}
              options={[
                { value: 'top-left', label: 'Top Left' }, { value: 'top-center', label: 'Top Center' }, { value: 'top-right', label: 'Top Right' },
                { value: 'bottom-left', label: 'Bottom Left' }, { value: 'bottom-center', label: 'Bottom Center' }, { value: 'bottom-right', label: 'Bottom Right' }
              ]} />
          </Field>
          <Field label="Pages"><TextInput value={opts.pageRange ?? ''} onChange={(v) => setOpts({ ...opts, pageRange: v })} placeholder="All" /></Field>
        </div>
      </div>
    </Modal>
  );
}

export function StampDialog() {
  const doc = useActiveDoc();
  const close = useDialogStore((s) => s.close);
  const [customs, setCustoms] = useState<StampDefinition[] | null>(null);
  const [designerText, setDesignerText] = useState('REVIEWED');
  const [designerColor, setDesignerColor] = useState('#2563eb');
  const [designerBorder, setDesignerBorder] = useState<'solid' | 'double' | 'none'>('solid');
  const [busy, setBusy] = useState(false);

  if (!doc) return null;
  if (customs === null) {
    void ipc.galleries.stamps.list().then(setCustoms).catch(() => setCustoms([]));
  }

  const place = async (spec: StampSpec): Promise<void> => {
    setBusy(true);
    try {
      const runtime = documentService.runtime(doc.id);
      if (!runtime) return;
      const page = await runtime.pdf.getPage(doc.view.page);
      const vp = page.getViewport({ scale: 1 });
      await documentService.applyServerOp(
        doc.id,
        `Stamp ${spec.text}`,
        {
          kind: 'applyStamp',
          spec,
          placement: { pageIndex: doc.view.page - 1, cx: vp.width / 2, cy: vp.height / 2, rotation: 12, opacity: 0.85 }
        },
        [doc.view.page - 1]
      );
      toast.success('Stamp placed', `"${spec.text}" on page ${doc.view.page}`);
      close();
    } finally {
      setBusy(false);
    }
  };

  const saveCustom = async (): Promise<void> => {
    const stamp = { id: uid('stamp'), name: designerText, text: designerText, color: designerColor, borderStyle: designerBorder, fontSize: 22 };
    await ipc.galleries.stamps.save(stamp);
    setCustoms(null); // re-fetch
    toast.success('Custom stamp saved');
  };

  return (
    <Modal title="Stamps" icon="stamp-t" onClose={close} width={460}
      footer={<Button onClick={close}>Close</Button>}>
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Built-in — places on page {doc.view.page}</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(BUILT_IN_STAMP_SPECS).map(([id, spec]) => (
              <button key={id} disabled={busy} onClick={() => void place(spec)}
                className="rounded-md border-2 px-3 py-1 text-xs font-bold tracking-wide hover:opacity-75"
                style={{ borderColor: spec.color, color: spec.color }}>
                {spec.text}
              </button>
            ))}
          </div>
        </section>
        {customs && customs.length > 0 && (
          <section>
            <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-app-text-faint">My stamps</h3>
            <div className="flex flex-wrap gap-2">
              {customs.map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <button disabled={busy}
                    onClick={() => void place({ text: s.text, color: s.color, fontSize: s.fontSize, borderStyle: s.borderStyle })}
                    className="rounded-md border-2 px-3 py-1 text-xs font-bold tracking-wide hover:opacity-75"
                    style={{ borderColor: s.color, color: s.color }}>
                    {s.text}
                  </button>
                  <button onClick={() => void ipc.galleries.stamps.remove(s.id).then(() => setCustoms(null))}
                    className="text-app-text-faint hover:text-app-danger" aria-label={`Delete stamp ${s.name}`}>×</button>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="rounded-lg border border-app-border p-3">
          <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-app-text-faint">Stamp designer</h3>
          <div className="flex flex-col gap-2.5">
            <Field label="Text"><TextInput value={designerText} onChange={(v) => setDesignerText(v.toUpperCase())} /></Field>
            <Field label="Color"><ColorPicker value={designerColor} onChange={setDesignerColor} /></Field>
            <Field label="Border">
              <Select value={designerBorder} onChange={setDesignerBorder}
                options={[{ value: 'solid', label: 'Solid' }, { value: 'double', label: 'Double' }, { value: 'none', label: 'None' }]} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="rounded-md border-2 px-3 py-1 text-xs font-bold tracking-wide" style={{ borderColor: designerColor, color: designerColor, borderStyle: designerBorder === 'none' ? 'hidden' : designerBorder }}>
                {designerText || 'PREVIEW'}
              </span>
              <Button onClick={() => void saveCustom()} disabled={!designerText.trim()}>Save stamp</Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
}
