/**
 * FormDesignerLayer — grid-snapped field placement with drag-to-draw,
 * move/resize handles and alignment guides (Forms workspace mode).
 */
import { useRef, useState } from 'react';
import { useFormsStore, useDialogStore } from '../../stores/ui-stores';
import { uid, cx, clamp, EMPTY } from '../../utils';
import type { FormFieldDraft } from '../../types';

const FIELD_COLORS: Record<FormFieldDraft['kind'], string> = {
  text: '#2563eb',
  checkbox: '#107c10',
  radio: '#8961d6',
  dropdown: '#b45309',
  listbox: '#0e7490',
  date: '#be185d',
  signature: '#d13438'
};

export function FormDesignerLayer({
  docId,
  pageIndex,
  scale
}: {
  docId: string;
  pageIndex: number;
  scale: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fields = useFormsStore((s) => s.byDoc[docId] ?? EMPTY);
  const selectedId = useFormsStore((s) => s.selectedFieldId);
  const pendingKind = useFormsStore((s) => s.pendingKind);
  const gridSnap = useFormsStore((s) => s.gridSnap);
  const gridSize = useFormsStore((s) => s.gridSize);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const drag = useRef<{
    mode: 'draw' | 'move' | 'resize';
    fieldId?: string;
    startX: number;
    startY: number;
    orig?: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const [guides, setGuides] = useState<{ v: number | null; h: number | null }>({ v: null, h: null });

  const pageFields = fields.filter((f) => f.pageIndex === pageIndex);
  const snap = (v: number): number => (gridSnap ? Math.round(v / gridSize) * gridSize : v);

  const toPt = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = hostRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return;
    const p = toPt(e);
    hostRef.current?.setPointerCapture(e.pointerId);
    if (pendingKind) {
      drag.current = { mode: 'draw', startX: snap(p.x), startY: snap(p.y) };
      setDrawRect({ x: snap(p.x), y: snap(p.y), w: 0, h: 0 });
    } else {
      useFormsStore.getState().select(null);
    }
  };

  const startMove = (e: React.PointerEvent, field: FormFieldDraft): void => {
    e.stopPropagation();
    hostRef.current?.setPointerCapture(e.pointerId);
    const p = toPt(e);
    useFormsStore.getState().select(field.id);
    drag.current = {
      mode: 'move',
      fieldId: field.id,
      startX: p.x,
      startY: p.y,
      orig: { x: field.x, y: field.y, w: field.w, h: field.h }
    };
  };

  const startResize = (e: React.PointerEvent, field: FormFieldDraft): void => {
    e.stopPropagation();
    hostRef.current?.setPointerCapture(e.pointerId);
    const p = toPt(e);
    drag.current = {
      mode: 'resize',
      fieldId: field.id,
      startX: p.x,
      startY: p.y,
      orig: { x: field.x, y: field.y, w: field.w, h: field.h }
    };
  };

  const onPointerMove = (e: React.PointerEvent): void => {
    const state = drag.current;
    if (!state) return;
    const p = toPt(e);

    if (state.mode === 'draw') {
      setDrawRect({
        x: Math.min(state.startX, snap(p.x)),
        y: Math.min(state.startY, snap(p.y)),
        w: Math.abs(snap(p.x) - state.startX),
        h: Math.abs(snap(p.y) - state.startY)
      });
      return;
    }
    if (!state.fieldId || !state.orig) return;
    const dx = p.x - state.startX;
    const dy = p.y - state.startY;
    if (state.mode === 'move') {
      const nx = snap(state.orig.x + dx);
      const ny = snap(state.orig.y + dy);
      // Alignment guides against sibling fields.
      let v: number | null = null;
      let h: number | null = null;
      for (const other of pageFields) {
        if (other.id === state.fieldId) continue;
        if (Math.abs(other.x - nx) < 3) v = other.x;
        if (Math.abs(other.y - ny) < 3) h = other.y;
      }
      setGuides({ v, h });
      useFormsStore.getState().update(docId, state.fieldId, { x: v ?? nx, y: h ?? ny });
    } else {
      useFormsStore.getState().update(docId, state.fieldId, {
        w: clamp(snap(state.orig.w + dx), 16, 2000),
        h: clamp(snap(state.orig.h + dy), 12, 2000)
      });
    }
  };

  const onPointerUp = (): void => {
    const state = drag.current;
    drag.current = null;
    setGuides({ v: null, h: null });
    if (state?.mode === 'draw' && drawRect && pendingKind) {
      const rect = drawRect;
      setDrawRect(null);
      const w = rect.w < 8 ? defaultSize(pendingKind).w : rect.w;
      const h = rect.h < 8 ? defaultSize(pendingKind).h : rect.h;
      const field: FormFieldDraft = {
        id: uid('field'),
        kind: pendingKind,
        name: `${pendingKind}_${fields.length + 1}`,
        pageIndex,
        x: rect.x,
        y: rect.y,
        w,
        h,
        options: pendingKind === 'dropdown' || pendingKind === 'listbox' || pendingKind === 'radio' ? ['Option 1', 'Option 2'] : [],
        required: false,
        multiline: false
      };
      useFormsStore.getState().add(docId, field);
      useFormsStore.getState().setPendingKind(null);
    }
  };

  return (
    <div
      ref={hostRef}
      className="absolute inset-0"
      style={{ cursor: pendingKind ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      aria-label="Form designer layer"
    >
      {/* Grid */}
      {gridSnap && (
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--vk-accent) 0.5px, transparent 0.5px), linear-gradient(to bottom, var(--vk-accent) 0.5px, transparent 0.5px)',
            backgroundSize: `${gridSize * scale}px ${gridSize * scale}px`
          }}
        />
      )}

      {/* Alignment guides */}
      {guides.v !== null && (
        <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-app-danger" style={{ left: guides.v * scale }} />
      )}
      {guides.h !== null && (
        <div className="pointer-events-none absolute left-0 right-0 h-px bg-app-danger" style={{ top: guides.h * scale }} />
      )}

      {/* Fields */}
      {pageFields.map((field) => (
        <div
          key={field.id}
          onPointerDown={(e) => startMove(e, field)}
          onDoubleClick={() => useDialogStore.getState().show('form-field', { docId, fieldId: field.id })}
          className={cx(
            'absolute flex cursor-move items-center justify-center border-2 text-2xs font-medium',
            selectedId === field.id ? 'z-10' : ''
          )}
          style={{
            left: field.x * scale,
            top: field.y * scale,
            width: field.w * scale,
            height: field.h * scale,
            borderColor: FIELD_COLORS[field.kind],
            background: `color-mix(in srgb, ${FIELD_COLORS[field.kind]} 12%, transparent)`,
            color: FIELD_COLORS[field.kind],
            borderStyle: selectedId === field.id ? 'solid' : 'dashed'
          }}
          title={`${field.name} (double-click for properties)`}
        >
          <span className="truncate px-1">{field.name}</span>
          {selectedId === field.id && (
            <div
              onPointerDown={(e) => startResize(e, field)}
              className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-se-resize rounded-sm border border-white"
              style={{ background: FIELD_COLORS[field.kind] }}
            />
          )}
        </div>
      ))}

      {/* Drawing preview */}
      {drawRect && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-app-accent bg-app-accent-muted/40"
          style={{
            left: drawRect.x * scale,
            top: drawRect.y * scale,
            width: drawRect.w * scale,
            height: drawRect.h * scale
          }}
        />
      )}
    </div>
  );
}

function defaultSize(kind: FormFieldDraft['kind']): { w: number; h: number } {
  switch (kind) {
    case 'checkbox':
    case 'radio':
      return { w: 16, h: 16 };
    case 'listbox':
      return { w: 160, h: 64 };
    case 'signature':
      return { w: 180, h: 48 };
    default:
      return { w: 160, h: 24 };
  }
}
