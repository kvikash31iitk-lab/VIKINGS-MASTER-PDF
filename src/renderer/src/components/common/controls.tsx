/** Shared form controls used across dialogs and panels (Fluent-flavored). */
import { useId, useState, useRef, useEffect } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import { cx } from '../../utils';
import { Icon } from './Icon';

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  className,
  title,
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-app-accent text-app-accent-text hover:bg-app-accent-hover',
        variant === 'secondary' &&
          'border border-app-border-strong bg-app-surface text-app-text hover:bg-app-surface-3',
        variant === 'danger' && 'bg-app-danger text-white hover:opacity-90',
        variant === 'ghost' && 'text-app-text hover:bg-app-surface-3',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-app-text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-2xs text-app-text-faint">{hint}</span>}
    </label>
  );
}

const inputCls =
  'h-8 w-full rounded-md border border-app-border-strong bg-app-surface px-2.5 text-sm text-app-text ' +
  'placeholder:text-app-text-faint focus:border-app-accent focus:outline-none';

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  autoFocus,
  onEnter
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      className={inputCls}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={inputCls}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className={cx(inputCls, 'cursor-pointer')}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--vk-accent)]"
      />
      <label htmlFor={id} className="cursor-pointer select-none text-sm text-app-text">
        {label}
      </label>
    </div>
  );
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  inline
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; description?: string }>;
  inline?: boolean;
}) {
  return (
    <div className={cx('gap-2', inline ? 'flex flex-wrap' : 'flex flex-col')}>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-0.5 h-4 w-4 accent-[var(--vk-accent)]"
          />
          <span className="text-sm">
            {o.label}
            {o.description && <span className="block text-2xs text-app-text-faint">{o.description}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  format
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-[var(--vk-accent)]"
      />
      <span className="w-12 text-right text-xs tabular-nums text-app-text-muted">
        {format ? format(value) : value}
      </span>
    </div>
  );
}

const SWATCHES = [
  '#d13438', '#f0b35c', '#ffe066', '#107c10', '#2563eb', '#8961d6',
  '#e44fb0', '#111111', '#5a6271', '#ffffff'
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={cx(
            'h-5.5 h-6 w-6 rounded-md border',
            value.toLowerCase() === c ? 'border-app-accent ring-2 ring-app-accent' : 'border-app-border-strong'
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Custom color"
        className="h-6 w-8 cursor-pointer rounded border border-app-border-strong bg-transparent"
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-5 w-9 rounded-full transition-colors',
        checked ? 'bg-app-accent' : 'bg-app-border-strong'
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4.5 translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

/** Simple dropdown menu anchored to its trigger. */
export function Menu({
  trigger,
  items,
  align = 'left'
}: {
  trigger: ReactNode;
  items: Array<{ label: string; icon?: string; onClick: () => void; disabled?: boolean } | 'separator'>;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={cx(
            'absolute z-50 mt-1 min-w-44 animate-slide-down rounded-lg border border-app-border bg-app-surface p-1 shadow-flyout',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          role="menu"
        >
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={i} className="my-1 h-px bg-app-border" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-app-surface-3 disabled:opacity-40"
              >
                {item.icon && <Icon name={item.icon} size={14} className="text-app-text-muted" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <Icon
      name="spinner"
      size={size}
      className="animate-spin text-app-accent"
      strokeWidth={2.2}
    />
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Icon name={icon} size={32} className="text-app-text-faint" strokeWidth={1.2} />
      <p className="text-sm font-medium text-app-text-muted">{title}</p>
      {hint && <p className="text-xs text-app-text-faint">{hint}</p>}
    </div>
  );
}
