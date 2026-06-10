/** Formatting panel — live style controls for the active annotation tool. */
import { useToolStore } from '../../../stores/ui-stores';
import { Field, ColorPicker, Slider, TextInput, Select } from '../../common/controls';

export function FormattingPanel() {
  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const strokeWidth = useToolStore((s) => s.strokeWidth);
  const opacity = useToolStore((s) => s.opacity);
  const fontSize = useToolStore((s) => s.fontSize);
  const author = useToolStore((s) => s.author);
  const setStyle = useToolStore((s) => s.setStyle);
  const setAuthor = useToolStore((s) => s.setAuthor);

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="rounded-md bg-app-surface-2 px-2.5 py-2 text-xs text-app-text-muted">
        Active tool: <span className="font-semibold text-app-text">{tool}</span>
      </div>
      <Field label="Color">
        <ColorPicker value={color} onChange={(c) => setStyle({ color: c })} />
      </Field>
      <Field label="Stroke width">
        <Slider value={strokeWidth} onChange={(v) => setStyle({ strokeWidth: v })} min={0.5} max={18} step={0.5} format={(v) => `${v} pt`} />
      </Field>
      <Field label="Opacity">
        <Slider value={Math.round(opacity * 100)} onChange={(v) => setStyle({ opacity: v / 100 })} min={5} max={100} format={(v) => `${v}%`} />
      </Field>
      <Field label="Font size (text tools)">
        <Select
          value={String(fontSize)}
          onChange={(v) => setStyle({ fontSize: parseInt(v, 10) })}
          options={[8, 9, 10, 11, 12, 14, 16, 18, 24, 32, 48].map((n) => ({ value: String(n), label: `${n} pt` }))}
        />
      </Field>
      <Field label="Author name" hint="Stamped into new comments and replies.">
        <TextInput value={author} onChange={setAuthor} placeholder="Your name" />
      </Field>
    </div>
  );
}
