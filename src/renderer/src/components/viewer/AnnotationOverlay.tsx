/**
 * AnnotationOverlay — Fabric.js interaction layer per page.
 * The tool store's drafts are the single source of truth: fabric objects are
 * projections rebuilt on changes; user edits flow back as draft patches.
 * Markup tools (highlight/underline/…) capture text-layer selections instead.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, Rect, Ellipse, Line, Polyline, Textbox } from 'fabric';
import type { FabricObject, TPointerEventInfo, TPointerEvent , Point } from 'fabric';
import { useToolStore, useRedactionStore, useDialogStore } from '../../stores/ui-stores';
import { documentService } from '../../services/document-service';
import { ipc } from '../../services/ipc';
import { IMAGE_FILTERS } from '@shared/constants';
import { uid, EMPTY } from '../../utils';
import type { AnnotationDraft, ToolId } from '../../types';

const DRAW_TOOLS: ToolId[] = [
  'select', 'note', 'pencil', 'marker', 'line', 'arrow', 'rect', 'ellipse',
  'cloud', 'callout', 'textbox', 'add-text', 'add-image', 'whiteout', 'link',
  'redact-area', 'crop'
];
const MARKUP_TOOLS: ToolId[] = ['highlight', 'underline', 'strikeout', 'squiggly'];

function scenePoint(canvas: Canvas, e: TPointerEvent): { x: number; y: number } {
  const maybe = canvas as unknown as {
    getScenePoint?: (e: TPointerEvent) => Point;
    getPointer?: (e: TPointerEvent) => { x: number; y: number };
  };
  if (typeof maybe.getScenePoint === 'function') return maybe.getScenePoint(e);
  if (typeof maybe.getPointer === 'function') return maybe.getPointer(e);
  return { x: 0, y: 0 };
}

export function AnnotationOverlay({
  docId,
  pageIndex,
  widthCss,
  heightCss,
  scale,
  ptHeight
}: {
  docId: string;
  pageIndex: number;
  widthCss: number;
  heightCss: number;
  scale: number;
  ptHeight: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const objectToDraft = useRef(new Map<FabricObject, { draftId: string; baseLeft: number; baseTop: number }>());
  const drawing = useRef<{
    start: { x: number; y: number };
    object: FabricObject | null;
    points: number[];
  } | null>(null);

  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const strokeWidth = useToolStore((s) => s.strokeWidth);
  const opacity = useToolStore((s) => s.opacity);
  const fontSize = useToolStore((s) => s.fontSize);
  const author = useToolStore((s) => s.author);
  const drafts = useToolStore((s) => s.drafts[docId] ?? EMPTY);
  const pageDrafts = useMemo(() => drafts.filter((d) => d.pageIndex === pageIndex), [drafts, pageIndex]);

  const interactive = DRAW_TOOLS.includes(tool);

  // ── Canvas lifecycle ──
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;
    const canvas = new Canvas(el, {
      selection: tool === 'select',
      width: widthCss,
      height: heightCss,
      renderOnAddRemove: true
    });
    fabricRef.current = canvas;
    const draftMap = objectToDraft.current; // stable Map instance for cleanup
    return () => {
      void canvas.dispose();
      fabricRef.current = null;
      draftMap.clear();
    };
    // Recreate only per page mount — size/zoom handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Size & zoom sync (objects live in pt coordinates) ──
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: widthCss, height: heightCss });
    canvas.setZoom(scale);
    canvas.requestRenderAll();
  }, [widthCss, heightCss, scale]);

  // ── Rebuild objects from drafts ──
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.remove(...canvas.getObjects());
    objectToDraft.current.clear();

    for (const draft of pageDrafts) {
      const objects = draftToObjects(draft);
      for (const obj of objects) {
        obj.set({ opacity: draft.opacity });
        canvas.add(obj);
        objectToDraft.current.set(obj, {
          draftId: draft.id,
          baseLeft: obj.left ?? 0,
          baseTop: obj.top ?? 0
        });
      }
    }
    canvas.requestRenderAll();
  }, [pageDrafts]);

  // ── Selection mode toggle ──
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.selection = tool === 'select';
    for (const obj of canvas.getObjects()) {
      obj.selectable = tool === 'select';
      obj.evented = tool === 'select';
    }
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [tool]);

  // ── Geometry write-back after fabric edits ──
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const onModified = (e: { target?: FabricObject }): void => {
      const obj = e.target;
      if (!obj) return;
      const link = objectToDraft.current.get(obj);
      if (!link) return;
      const draft = (useToolStore.getState().drafts[docId] ?? []).find((d) => d.id === link.draftId);
      if (!draft) return;
      const patch: Partial<AnnotationDraft> = {};
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      if (draft.rect) {
        patch.rect = {
          x: left,
          y: top,
          w: (obj.width ?? draft.rect.w) * (obj.scaleX ?? 1),
          h: (obj.height ?? draft.rect.h) * (obj.scaleY ?? 1)
        };
      } else if (draft.points || draft.x1 !== undefined) {
        const dx = left - link.baseLeft;
        const dy = top - link.baseTop;
        if (draft.points) {
          patch.points = draft.points.map((path) => path.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)));
        } else {
          patch.x1 = (draft.x1 ?? 0) + dx;
          patch.y1 = (draft.y1 ?? 0) + dy;
          patch.x2 = (draft.x2 ?? 0) + dx;
          patch.y2 = (draft.y2 ?? 0) + dy;
        }
      } else if (draft.rects) {
        // markup quads do not move
      }
      if (obj instanceof Textbox) {
        patch.contents = obj.text ?? draft.contents;
        patch.lines = (obj.text ?? '').split('\n');
      }
      // Nothing actually changed (e.g. a fixed markup object) → skip, so undo
      // history isn't polluted with no-op entries.
      if (Object.keys(patch).length === 0) return;
      useToolStore.getState().updateDraft(docId, link.draftId, patch);
    };
    canvas.on('object:modified', onModified);
    return () => {
      canvas.off('object:modified', onModified);
    };
  }, [docId]);

  // ── Drawing interactions ──
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const style = { stroke: color, strokeWidth, fill: 'transparent' };

    const onDown = (opt: TPointerEventInfo): void => {
      if (tool === 'select') return;
      const p = scenePoint(canvas, opt.e);

      if (tool === 'note') {
        useToolStore.getState().addDraft(docId, {
          id: uid('annot'), pageIndex, kind: 'note', color, opacity, strokeWidth: 1,
          author, contents: 'New note', createdAt: Date.now(),
          rect: { x: p.x, y: p.y, w: 20, h: 20 }
        });
        return;
      }
      if (tool === 'add-image') {
        void placeImage(docId, pageIndex, p, ptHeight);
        return;
      }
      if (tool === 'pencil' || tool === 'marker') {
        drawing.current = { start: p, object: null, points: [p.x, p.y] };
        return;
      }
      drawing.current = { start: p, object: null, points: [] };
    };

    const onMove = (opt: TPointerEventInfo): void => {
      const state = drawing.current;
      if (!state) return;
      const canvasObj = fabricRef.current;
      if (!canvasObj) return;
      const p = scenePoint(canvasObj, opt.e);
      const { start } = state;
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);

      if (state.object) canvasObj.remove(state.object);

      let obj: FabricObject | null = null;
      switch (tool) {
        case 'pencil':
        case 'marker': {
          state.points.push(p.x, p.y);
          const pts = [];
          for (let i = 0; i + 1 < state.points.length; i += 2) {
            pts.push({ x: state.points[i]!, y: state.points[i + 1]! });
          }
          obj = new Polyline(pts, {
            ...style,
            strokeWidth: tool === 'marker' ? Math.max(strokeWidth, 8) : strokeWidth,
            opacity: tool === 'marker' ? 0.45 : 1,
            fill: 'transparent'
          });
          break;
        }
        case 'line':
        case 'arrow':
          obj = new Line([start.x, start.y, p.x, p.y], style);
          break;
        case 'rect':
        case 'cloud':
        case 'textbox':
        case 'callout':
        case 'link':
        case 'crop':
          obj = new Rect({ left: x, top: y, width: w, height: h, ...style, strokeDashArray: tool === 'crop' || tool === 'link' ? [5, 4] : undefined });
          break;
        case 'whiteout':
          obj = new Rect({ left: x, top: y, width: w, height: h, fill: '#ffffff', stroke: '#cccccc', strokeWidth: 0.5 });
          break;
        case 'redact-area':
          obj = new Rect({ left: x, top: y, width: w, height: h, fill: 'rgba(209,52,56,0.3)', stroke: '#d13438', strokeWidth: 1.5, strokeDashArray: [4, 3] });
          break;
        case 'ellipse':
          obj = new Ellipse({ left: x, top: y, rx: w / 2, ry: h / 2, ...style });
          break;
        default:
          break;
      }
      if (obj) {
        obj.selectable = false;
        obj.evented = false;
        canvasObj.add(obj);
        state.object = obj;
        canvasObj.requestRenderAll();
      }
    };

    const onUp = (opt: TPointerEventInfo): void => {
      const state = drawing.current;
      drawing.current = null;
      if (!state) return;
      const canvasObj = fabricRef.current;
      if (!canvasObj) return;
      if (state.object) canvasObj.remove(state.object);
      const p = scenePoint(canvasObj, opt.e);
      const { start } = state;
      const rect = {
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y)
      };
      const tiny = rect.w < 3 && rect.h < 3;
      const base = {
        id: uid('annot'), pageIndex, color, opacity, strokeWidth, author,
        contents: '', createdAt: Date.now()
      };
      const add = (draft: AnnotationDraft): void => useToolStore.getState().addDraft(docId, draft);

      switch (tool) {
        case 'pencil':
        case 'marker':
          if (state.points.length >= 4) {
            add({ ...base, kind: tool === 'marker' ? 'marker' : 'ink', points: [state.points], opacity: tool === 'marker' ? 0.45 : opacity, strokeWidth: tool === 'marker' ? Math.max(strokeWidth, 8) : strokeWidth });
          }
          break;
        case 'line':
        case 'arrow':
          if (!tiny) add({ ...base, kind: tool, x1: start.x, y1: start.y, x2: p.x, y2: p.y });
          break;
        case 'rect':
        case 'ellipse':
        case 'cloud':
          if (!tiny) add({ ...base, kind: tool, rect });
          break;
        case 'whiteout':
          if (!tiny) add({ ...base, kind: 'rect', color: '#ffffff', rect, strokeWidth: 0 });
          break;
        case 'textbox':
        case 'add-text':
          if (!tiny) {
            add({ ...base, kind: 'textbox', rect: { ...rect, h: Math.max(rect.h, fontSize * 2) }, fontSize, lines: ['Type here'], contents: 'Type here', color: tool === 'add-text' ? '#111111' : color });
            // Switch to Select so the new box can be moved/edited by dragging it
            // instead of the text tool drawing fresh duplicates on every drag.
            useToolStore.getState().setTool('select');
            useToolStore.getState().selectDraft(base.id);
          }
          break;
        case 'callout':
          if (!tiny) {
            add({ ...base, kind: 'callout', rect, fontSize, lines: ['Callout'], contents: 'Callout', calloutTarget: { x: rect.x - 40, y: rect.y + rect.h + 30 } });
            useToolStore.getState().setTool('select');
            useToolStore.getState().selectDraft(base.id);
          }
          break;
        case 'redact-area':
          if (!tiny) {
            useRedactionStore.getState().add(docId, { id: uid('redact'), pageIndex, ...rect, source: 'manual' });
          }
          break;
        case 'link':
          if (!tiny) useDialogStore.getState().show('link', { docId, pageIndex, rect });
          break;
        case 'crop':
          if (!tiny) useDialogStore.getState().show('crop', { docId, pageIndex, rect });
          break;
        default:
          break;
      }
      canvasObj.requestRenderAll();
    };

    canvas.on('mouse:down', onDown);
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:up', onUp);
    return () => {
      canvas.off('mouse:down', onDown);
      canvas.off('mouse:move', onMove);
      canvas.off('mouse:up', onUp);
    };
  }, [tool, color, strokeWidth, opacity, fontSize, author, docId, pageIndex, ptHeight]);

  // ── Markup tools: capture text selection on mouseup ──
  useEffect(() => {
    if (!MARKUP_TOOLS.includes(tool)) return;
    const onMouseUp = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const wrapper = wrapperRef.current?.parentElement; // PageView host
      const textLayer = wrapper?.querySelector(`[data-page-text-layer="${pageIndex}"]`);
      if (!wrapper || !textLayer) return;
      const range = selection.getRangeAt(0);
      if (!textLayer.contains(range.commonAncestorContainer)) return;

      const hostRect = wrapper.getBoundingClientRect();
      const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue;
        rects.push({
          x: (r.left - hostRect.left) / scale,
          y: (r.top - hostRect.top) / scale,
          w: r.width / scale,
          h: r.height / scale
        });
      }
      if (rects.length === 0) return;
      useToolStore.getState().addDraft(docId, {
        id: uid('annot'),
        pageIndex,
        kind: tool as AnnotationDraft['kind'],
        color: tool === 'highlight' ? '#ffe066' : color,
        opacity: tool === 'highlight' ? 0.45 : 1,
        strokeWidth: 1,
        author,
        contents: selection.toString().slice(0, 400),
        createdAt: Date.now(),
        rects
      });
      selection.removeAllRanges();
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [tool, docId, pageIndex, scale, color, author]);

  // ── Delete selected drafts ──
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) return;
    e.preventDefault();
    for (const obj of active) {
      const link = objectToDraft.current.get(obj);
      if (link) useToolStore.getState().removeDraft(docId, link.draftId);
    }
    canvas.discardActiveObject();
  };

  return (
    <div
      ref={wrapperRef}
      tabIndex={interactive ? 0 : -1}
      onKeyDown={onKeyDown}
      className="absolute inset-0"
      style={{ pointerEvents: interactive ? 'auto' : 'none' }}
      aria-label={interactive ? 'PDF annotation editing layer — use ribbon tools to annotate' : 'PDF annotation layer'}
    >
      <canvas ref={canvasElRef} />
    </div>
  );
}

// ───────────────────────── Draft → fabric projection ─────────────────────────

function draftToObjects(draft: AnnotationDraft): FabricObject[] {
  const common = { stroke: draft.color, strokeWidth: draft.strokeWidth, fill: 'transparent' };
  switch (draft.kind) {
    case 'highlight':
    case 'underline':
    case 'strikeout':
    case 'squiggly':
      return (draft.rects ?? []).map((r) => {
        if (draft.kind === 'highlight') {
          return new Rect({ left: r.x, top: r.y, width: r.w, height: r.h, fill: draft.color, strokeWidth: 0, selectable: false });
        }
        const y = draft.kind === 'strikeout' ? r.y + r.h / 2 : r.y + r.h - 1;
        return new Line([r.x, y, r.x + r.w, y], { stroke: draft.color, strokeWidth: 1.4, selectable: false });
      });
    case 'note':
      return [
        new Rect({
          left: draft.rect?.x ?? 0, top: draft.rect?.y ?? 0, width: 20, height: 20,
          fill: draft.color, rx: 3, ry: 3, strokeWidth: 0
        })
      ];
    case 'ink':
    case 'marker':
      return (draft.points ?? []).map((path) => {
        const pts = [];
        for (let i = 0; i + 1 < path.length; i += 2) pts.push({ x: path[i]!, y: path[i + 1]! });
        return new Polyline(pts, { ...common, fill: 'transparent' });
      });
    case 'line':
    case 'arrow':
      return [new Line([draft.x1 ?? 0, draft.y1 ?? 0, draft.x2 ?? 0, draft.y2 ?? 0], common)];
    case 'rect':
      return [
        new Rect({
          left: draft.rect?.x ?? 0, top: draft.rect?.y ?? 0,
          width: draft.rect?.w ?? 10, height: draft.rect?.h ?? 10,
          ...common,
          fill: draft.color === '#ffffff' && draft.strokeWidth === 0 ? '#ffffff' : 'transparent'
        })
      ];
    case 'ellipse':
      return [
        new Ellipse({
          left: draft.rect?.x ?? 0, top: draft.rect?.y ?? 0,
          rx: (draft.rect?.w ?? 10) / 2, ry: (draft.rect?.h ?? 10) / 2, ...common
        })
      ];
    case 'cloud':
      return [
        new Rect({
          left: draft.rect?.x ?? 0, top: draft.rect?.y ?? 0,
          width: draft.rect?.w ?? 10, height: draft.rect?.h ?? 10,
          ...common, rx: 10, ry: 10, strokeDashArray: [6, 4]
        })
      ];
    case 'textbox':
    case 'callout':
      return [
        new Textbox(draft.lines?.join('\n') ?? draft.contents, {
          left: draft.rect?.x ?? 0, top: draft.rect?.y ?? 0,
          width: draft.rect?.w ?? 120, fontSize: draft.fontSize ?? 12,
          fill: draft.color, stroke: undefined, strokeWidth: 0,
          backgroundColor: 'rgba(255,255,255,0.75)', editable: true
        })
      ];
    default:
      return [];
  }
}

// ───────────────────────── Image placement (Edit ▸ Add Image) ─────────────────────────

async function placeImage(
  docId: string,
  pageIndex: number,
  at: { x: number; y: number },
  ptHeight: number
): Promise<void> {
  const paths = await ipc.files.openDialog({ title: 'Place Image', filters: IMAGE_FILTERS });
  if (!paths || paths.length === 0) return;
  const bytes = await ipc.files.read(paths[0]!);
  const lower = paths[0]!.toLowerCase();
  let format: 'png' | 'jpg' = lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'jpg' : 'png';
  let data = bytes;

  // Transcode unsupported formats to PNG through a canvas.
  if (!/\.(png|jpe?g)$/i.test(lower)) {
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer]);
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
    const pngBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
    if (!pngBlob) return;
    data = new Uint8Array(await pngBlob.arrayBuffer());
    format = 'png';
  }

  // Measure natural size for placement (cap at 240 pt wide).
  const probe = await createImageBitmap(new Blob([data.slice().buffer as ArrayBuffer]));
  const scale = Math.min(1, 240 / probe.width);
  const w = probe.width * scale;
  const h = probe.height * scale;

  await documentService.applyServerOp(
    docId,
    'Place image',
    {
      kind: 'composePageContent',
      ops: [
        {
          pageIndex,
          op: { kind: 'image', x: at.x, y: ptHeight - at.y - h, width: w, height: h, bytes: data, format }
        }
      ]
    },
    [pageIndex]
  );
}
