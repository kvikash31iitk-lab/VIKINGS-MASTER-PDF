/**
 * Annotation writer — compiles editor annotations into standards-compliant PDF
 * annotation dictionaries with appearance streams (ISO 32000 §12.5), so marks
 * render identically in Adobe/Foxit/Chrome/PDF.js.
 *
 * Supported: highlight, underline, strikeout, squiggly, sticky note, ink
 * (pencil/marker), line/arrow, rectangle, ellipse, cloud (polygon), callout,
 * text box, link — plus reply threads (IRT) and review status (State/StateModel).
 */
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFHexString,
  PDFNumber,
  StandardFonts
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { hexToRgbTuple, toPdfDate } from './utils';

// ─────────────────────────────── Model ───────────────────────────────

export interface Quad {
  x1: number; y1: number; // upper-left
  x2: number; y2: number; // upper-right
  x3: number; y3: number; // lower-left
  x4: number; y4: number; // lower-right
}

interface AnnotBase {
  /** Stable identifier stored in /NM — used for replies, updates, deletion. */
  id: string;
  pageIndex: number;
  author?: string;
  contents?: string;
  color: string;
  opacity: number; // 0..1
  createdAt?: Date;
}

export type NewAnnotation =
  | (AnnotBase & { kind: 'highlight' | 'underline' | 'strikeout' | 'squiggly'; quads: Quad[] })
  | (AnnotBase & { kind: 'note'; x: number; y: number })
  | (AnnotBase & { kind: 'ink' | 'marker'; paths: number[][]; strokeWidth: number })
  | (AnnotBase & {
      kind: 'rect' | 'ellipse';
      rect: Rect;
      strokeWidth: number;
      fillColor?: string;
    })
  | (AnnotBase & { kind: 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; strokeWidth: number })
  | (AnnotBase & { kind: 'cloud'; vertices: Array<{ x: number; y: number }>; strokeWidth: number })
  | (AnnotBase & {
      kind: 'textbox' | 'callout';
      rect: Rect;
      lines: string[];
      fontSize: number;
      calloutTarget?: { x: number; y: number };
    })
  | (AnnotBase & { kind: 'link'; rect: Rect; url: string });

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─────────────────────────────── Helpers ───────────────────────────────

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};

function getAnnotsArray(page: PDFPage): PDFArray {
  const existing = page.node.lookup(PDFName.of('Annots'));
  if (existing instanceof PDFArray) return existing;
  const arr = page.doc.context.obj([]);
  page.node.set(PDFName.of('Annots'), arr);
  return arr;
}

function quadBounds(quads: Quad[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of quads) {
    for (const [x, y] of [[q.x1, q.y1], [q.x2, q.y2], [q.x3, q.y3], [q.x4, q.y4]] as const) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  return [minX, minY, maxX, maxY];
}

interface ApParts {
  ops: string;
  bbox: [number, number, number, number];
  /** Extra resource entries beyond the ExtGState (e.g. fonts). */
  fontRef?: PDFRef;
}

/** Builds a form XObject appearance stream with opacity ExtGState. */
function makeAppearance(doc: PDFDocument, parts: ApParts, opacity: number, blendMultiply = false): PDFRef {
  const context = doc.context;
  const gs: Record<string, string | number> = { Type: 'ExtGState', CA: opacity, ca: opacity };
  if (blendMultiply) gs.BM = 'Multiply';
  const resources: Record<string, PDFDict | PDFRef> = {
    ExtGState: context.obj({ GS0: context.obj(gs) })
  };
  if (parts.fontRef) {
    resources.Font = context.obj({ Helv: parts.fontRef });
  }
  const stream = context.stream(`/GS0 gs\n${parts.ops}`, {
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: parts.bbox,
    Resources: context.obj(resources)
  });
  return context.register(stream);
}

function baseDict(
  doc: PDFDocument,
  annot: NewAnnotation,
  subtype: string,
  rect: [number, number, number, number]
): Map<PDFName, unknown> {
  const entries = new Map<PDFName, unknown>();
  const [r, g, b] = hexToRgbTuple(annot.color);
  entries.set(PDFName.of('Type'), PDFName.of('Annot'));
  entries.set(PDFName.of('Subtype'), PDFName.of(subtype));
  entries.set(PDFName.of('Rect'), doc.context.obj(rect));
  entries.set(PDFName.of('C'), doc.context.obj([r, g, b]));
  entries.set(PDFName.of('CA'), PDFNumber.of(annot.opacity));
  entries.set(PDFName.of('F'), PDFNumber.of(4)); // print flag
  entries.set(PDFName.of('NM'), PDFHexString.fromText(annot.id));
  entries.set(PDFName.of('M'), PDFHexString.fromText(toPdfDate(annot.createdAt ?? new Date())));
  if (annot.author) entries.set(PDFName.of('T'), PDFHexString.fromText(annot.author));
  if (annot.contents) entries.set(PDFName.of('Contents'), PDFHexString.fromText(annot.contents));
  return entries;
}

function registerAnnot(page: PDFPage, dict: PDFDict): PDFRef {
  const ref = page.doc.context.register(dict);
  getAnnotsArray(page).push(ref);
  return ref;
}

function toDict(doc: PDFDocument, entries: Map<PDFName, unknown>): PDFDict {
  const dict = doc.context.obj({}) as PDFDict;
  for (const [k, v] of entries) dict.set(k, v as never);
  return dict;
}

// ─────────────────────────────── Builders per kind ───────────────────────────────

function buildMarkup(
  doc: PDFDocument,
  page: PDFPage,
  annot: Extract<NewAnnotation, { kind: 'highlight' | 'underline' | 'strikeout' | 'squiggly' }>
): void {
  const subtype = { highlight: 'Highlight', underline: 'Underline', strikeout: 'StrikeOut', squiggly: 'Squiggly' }[
    annot.kind
  ];
  const bounds = quadBounds(annot.quads);
  const entries = baseDict(doc, annot, subtype, bounds);

  const qp: number[] = [];
  for (const q of annot.quads) qp.push(q.x1, q.y1, q.x2, q.y2, q.x3, q.y3, q.x4, q.y4);
  entries.set(PDFName.of('QuadPoints'), doc.context.obj(qp));

  // Appearance stream — coordinates inside AP use the same page space as Rect
  // when BBox equals Rect (Matrix identity).
  const [r, g, b] = hexToRgbTuple(annot.color);
  let ops = '';
  for (const q of annot.quads) {
    const x = Math.min(q.x3, q.x1);
    const y = Math.min(q.y3, q.y4);
    const w = Math.abs(q.x2 - q.x1);
    const h = Math.abs(q.y1 - q.y3);
    switch (annot.kind) {
      case 'highlight':
        ops += `${fmt(r)} ${fmt(g)} ${fmt(b)} rg ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re f\n`;
        break;
      case 'underline':
        ops += `${fmt(r)} ${fmt(g)} ${fmt(b)} RG 1.2 w ${fmt(x)} ${fmt(y + 1.2)} m ${fmt(x + w)} ${fmt(y + 1.2)} l S\n`;
        break;
      case 'strikeout': {
        const mid = y + h / 2;
        ops += `${fmt(r)} ${fmt(g)} ${fmt(b)} RG 1.2 w ${fmt(x)} ${fmt(mid)} m ${fmt(x + w)} ${fmt(mid)} l S\n`;
        break;
      }
      case 'squiggly': {
        // Sine-like squiggle along the baseline using small beziers.
        const amp = 1.6;
        const step = 4;
        let sx = x;
        ops += `${fmt(r)} ${fmt(g)} ${fmt(b)} RG 1 w ${fmt(sx)} ${fmt(y + 1)} m `;
        let up = true;
        while (sx + step <= x + w) {
          const cx = sx + step / 2;
          const cy = y + 1 + (up ? amp * 2 : -amp * 0);
          ops += `${fmt(cx)} ${fmt(cy)} ${fmt(sx + step)} ${fmt(y + 1)} v `;
          sx += step;
          up = !up;
        }
        ops += 'S\n';
        break;
      }
    }
  }
  const ap = makeAppearance(doc, { ops, bbox: bounds }, annot.opacity, annot.kind === 'highlight');
  entries.set(PDFName.of('AP'), doc.context.obj({ N: ap }));
  registerAnnot(page, toDict(doc, entries));
}

function buildNote(doc: PDFDocument, page: PDFPage, annot: Extract<NewAnnotation, { kind: 'note' }>): void {
  const rect: [number, number, number, number] = [annot.x, annot.y, annot.x + 20, annot.y + 20];
  const entries = baseDict(doc, annot, 'Text', rect);
  entries.set(PDFName.of('Name'), PDFName.of('Comment'));
  entries.set(PDFName.of('Open'), doc.context.obj(false));
  registerAnnot(page, toDict(doc, entries));
}

function buildInk(doc: PDFDocument, page: PDFPage, annot: Extract<NewAnnotation, { kind: 'ink' | 'marker' }>): void {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const path of annot.paths) {
    for (let i = 0; i + 1 < path.length; i += 2) {
      minX = Math.min(minX, path[i]!); maxX = Math.max(maxX, path[i]!);
      minY = Math.min(minY, path[i + 1]!); maxY = Math.max(maxY, path[i + 1]!);
    }
  }
  const pad = annot.strokeWidth + 2;
  const bounds: [number, number, number, number] = [minX - pad, minY - pad, maxX + pad, maxY + pad];
  const entries = baseDict(doc, annot, 'Ink', bounds);

  const inkList = doc.context.obj(annot.paths.map((p) => doc.context.obj(p)));
  entries.set(PDFName.of('InkList'), inkList);

  const [r, g, b] = hexToRgbTuple(annot.color);
  let ops = `${fmt(r)} ${fmt(g)} ${fmt(b)} RG ${fmt(annot.strokeWidth)} w 1 J 1 j\n`;
  for (const path of annot.paths) {
    if (path.length < 4) continue;
    ops += `${fmt(path[0]!)} ${fmt(path[1]!)} m `;
    for (let i = 2; i + 1 < path.length; i += 2) {
      ops += `${fmt(path[i]!)} ${fmt(path[i + 1]!)} l `;
    }
    ops += 'S\n';
  }
  const opacity = annot.kind === 'marker' ? Math.min(annot.opacity, 0.5) : annot.opacity;
  const ap = makeAppearance(doc, { ops, bbox: bounds }, opacity, annot.kind === 'marker');
  entries.set(PDFName.of('AP'), doc.context.obj({ N: ap }));
  registerAnnot(page, toDict(doc, entries));
}

function buildShape(doc: PDFDocument, page: PDFPage, annot: Extract<NewAnnotation, { kind: 'rect' | 'ellipse' }>): void {
  const { x, y, width: w, height: h } = annot.rect;
  const pad = annot.strokeWidth;
  const bounds: [number, number, number, number] = [x - pad, y - pad, x + w + pad, y + h + pad];
  const entries = baseDict(doc, annot, annot.kind === 'rect' ? 'Square' : 'Circle', bounds);
  const [r, g, b] = hexToRgbTuple(annot.color);
  if (annot.fillColor) {
    const [ir, ig, ib] = hexToRgbTuple(annot.fillColor);
    entries.set(PDFName.of('IC'), doc.context.obj([ir, ig, ib]));
  }
  entries.set(PDFName.of('BS'), doc.context.obj({ W: annot.strokeWidth, S: 'S' }));

  let ops = `${fmt(r)} ${fmt(g)} ${fmt(b)} RG ${fmt(annot.strokeWidth)} w\n`;
  let paint = 'S';
  if (annot.fillColor) {
    const [ir, ig, ib] = hexToRgbTuple(annot.fillColor);
    ops += `${fmt(ir)} ${fmt(ig)} ${fmt(ib)} rg\n`;
    paint = 'B';
  }
  if (annot.kind === 'rect') {
    ops += `${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re ${paint}\n`;
  } else {
    // Ellipse via 4 cubic beziers (kappa).
    const k = 0.5523;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    ops +=
      `${fmt(cx + rx)} ${fmt(cy)} m ` +
      `${fmt(cx + rx)} ${fmt(cy + ry * k)} ${fmt(cx + rx * k)} ${fmt(cy + ry)} ${fmt(cx)} ${fmt(cy + ry)} c ` +
      `${fmt(cx - rx * k)} ${fmt(cy + ry)} ${fmt(cx - rx)} ${fmt(cy + ry * k)} ${fmt(cx - rx)} ${fmt(cy)} c ` +
      `${fmt(cx - rx)} ${fmt(cy - ry * k)} ${fmt(cx - rx * k)} ${fmt(cy - ry)} ${fmt(cx)} ${fmt(cy - ry)} c ` +
      `${fmt(cx + rx * k)} ${fmt(cy - ry)} ${fmt(cx + rx)} ${fmt(cy - ry * k)} ${fmt(cx + rx)} ${fmt(cy)} c ` +
      `${paint}\n`;
  }
  const ap = makeAppearance(doc, { ops, bbox: bounds }, annot.opacity);
  entries.set(PDFName.of('AP'), doc.context.obj({ N: ap }));
  registerAnnot(page, toDict(doc, entries));
}

function buildLine(doc: PDFDocument, page: PDFPage, annot: Extract<NewAnnotation, { kind: 'line' | 'arrow' }>): void {
  const pad = annot.strokeWidth * 4 + 4;
  const bounds: [number, number, number, number] = [
    Math.min(annot.x1, annot.x2) - pad,
    Math.min(annot.y1, annot.y2) - pad,
    Math.max(annot.x1, annot.x2) + pad,
    Math.max(annot.y1, annot.y2) + pad
  ];
  const entries = baseDict(doc, annot, 'Line', bounds);
  entries.set(PDFName.of('L'), doc.context.obj([annot.x1, annot.y1, annot.x2, annot.y2]));
  entries.set(PDFName.of('BS'), doc.context.obj({ W: annot.strokeWidth, S: 'S' }));
  if (annot.kind === 'arrow') {
    entries.set(PDFName.of('LE'), doc.context.obj([PDFName.of('None'), PDFName.of('OpenArrow')]));
  }

  const [r, g, b] = hexToRgbTuple(annot.color);
  let ops = `${fmt(r)} ${fmt(g)} ${fmt(b)} RG ${fmt(annot.strokeWidth)} w 1 J\n`;
  ops += `${fmt(annot.x1)} ${fmt(annot.y1)} m ${fmt(annot.x2)} ${fmt(annot.y2)} l S\n`;
  if (annot.kind === 'arrow') {
    // Open arrowhead at the end point.
    const angle = Math.atan2(annot.y2 - annot.y1, annot.x2 - annot.x1);
    const len = Math.max(8, annot.strokeWidth * 4);
    const spread = Math.PI / 7;
    const ax1 = annot.x2 - len * Math.cos(angle - spread);
    const ay1 = annot.y2 - len * Math.sin(angle - spread);
    const ax2 = annot.x2 - len * Math.cos(angle + spread);
    const ay2 = annot.y2 - len * Math.sin(angle + spread);
    ops += `${fmt(ax1)} ${fmt(ay1)} m ${fmt(annot.x2)} ${fmt(annot.y2)} l ${fmt(ax2)} ${fmt(ay2)} l S\n`;
  }
  const ap = makeAppearance(doc, { ops, bbox: bounds }, annot.opacity);
  entries.set(PDFName.of('AP'), doc.context.obj({ N: ap }));
  registerAnnot(page, toDict(doc, entries));
}

function buildCloud(doc: PDFDocument, page: PDFPage, annot: Extract<NewAnnotation, { kind: 'cloud' }>): void {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of annot.vertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const pad = annot.strokeWidth + 8;
  const bounds: [number, number, number, number] = [minX - pad, minY - pad, maxX + pad, maxY + pad];
  const entries = baseDict(doc, annot, 'Polygon', bounds);
  const verts: number[] = [];
  for (const v of annot.vertices) verts.push(v.x, v.y);
  entries.set(PDFName.of('Vertices'), doc.context.obj(verts));
  entries.set(PDFName.of('BS'), doc.context.obj({ W: annot.strokeWidth, S: 'S' }));
  entries.set(PDFName.of('BE'), doc.context.obj({ S: 'C', I: 2 })); // cloudy border effect

  // Appearance: scalloped arcs along each polygon edge.
  const [r, g, b] = hexToRgbTuple(annot.color);
  let ops = `${fmt(r)} ${fmt(g)} ${fmt(b)} RG ${fmt(annot.strokeWidth)} w 1 J\n`;
  const n = annot.vertices.length;
  const scallop = 10;
  for (let i = 0; i < n; i++) {
    const a = annot.vertices[i]!;
    const c = annot.vertices[(i + 1) % n]!;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const dist = Math.hypot(dx, dy);
    const segs = Math.max(1, Math.round(dist / scallop));
    const nx = -dy / (dist || 1);
    const ny = dx / (dist || 1);
    for (let s = 0; s < segs; s++) {
      const sx = a.x + (dx * s) / segs;
      const sy = a.y + (dy * s) / segs;
      const ex = a.x + (dx * (s + 1)) / segs;
      const ey = a.y + (dy * (s + 1)) / segs;
      const mx = (sx + ex) / 2 + nx * scallop * 0.55;
      const my = (sy + ey) / 2 + ny * scallop * 0.55;
      ops += `${fmt(sx)} ${fmt(sy)} m ${fmt(mx)} ${fmt(my)} ${fmt(ex)} ${fmt(ey)} ${fmt(ex)} ${fmt(ey)} c S\n`;
    }
  }
  const ap = makeAppearance(doc, { ops, bbox: bounds }, annot.opacity);
  entries.set(PDFName.of('AP'), doc.context.obj({ N: ap }));
  registerAnnot(page, toDict(doc, entries));
}

async function buildFreeText(
  doc: PDFDocument,
  page: PDFPage,
  annot: Extract<NewAnnotation, { kind: 'textbox' | 'callout' }>
): Promise<void> {
  const { x, y, width: w, height: h } = annot.rect;
  let bounds: [number, number, number, number] = [x, y, x + w, y + h];
  if (annot.kind === 'callout' && annot.calloutTarget) {
    bounds = [
      Math.min(bounds[0], annot.calloutTarget.x) - 4,
      Math.min(bounds[1], annot.calloutTarget.y) - 4,
      Math.max(bounds[2], annot.calloutTarget.x) + 4,
      Math.max(bounds[3], annot.calloutTarget.y) + 4
    ];
  }
  const entries = baseDict(doc, annot, 'FreeText', bounds);
  const [r, g, b] = hexToRgbTuple(annot.color);
  entries.set(PDFName.of('DA'), PDFHexString.fromText(`${r} ${g} ${b} rg /Helv ${annot.fontSize} Tf`));
  entries.set(PDFName.of('Q'), PDFNumber.of(0));
  if (annot.kind === 'callout' && annot.calloutTarget) {
    entries.set(PDFName.of('IT'), PDFName.of('FreeTextCallout'));
    entries.set(
      PDFName.of('CL'),
      doc.context.obj([annot.calloutTarget.x, annot.calloutTarget.y, x, y + h / 2])
    );
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  let ops = `${fmt(r)} ${fmt(g)} ${fmt(b)} RG 1 w ${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re S\n`;
  if (annot.kind === 'callout' && annot.calloutTarget) {
    ops += `${fmt(annot.calloutTarget.x)} ${fmt(annot.calloutTarget.y)} m ${fmt(x)} ${fmt(y + h / 2)} l S\n`;
  }
  ops += `BT /Helv ${fmt(annot.fontSize)} Tf ${fmt(r)} ${fmt(g)} ${fmt(b)} rg ${fmt(annot.fontSize * 1.2)} TL\n`;
  let ty = y + h - annot.fontSize - 4;
  for (const line of annot.lines) {
    const safe = sanitizeForWinAnsi(line);
    ops += `1 0 0 1 ${fmt(x + 4)} ${fmt(ty)} Tm (${escapePdfString(safe)}) Tj\n`;
    ty -= annot.fontSize * 1.2;
  }
  ops += 'ET\n';
  const ap = makeAppearance(doc, { ops, bbox: bounds, fontRef: font.ref }, annot.opacity);
  entries.set(PDFName.of('AP'), doc.context.obj({ N: ap }));
  registerAnnot(page, toDict(doc, entries));
}

function buildLink(doc: PDFDocument, page: PDFPage, annot: Extract<NewAnnotation, { kind: 'link' }>): void {
  const { x, y, width: w, height: h } = annot.rect;
  const entries = baseDict(doc, annot, 'Link', [x, y, x + w, y + h]);
  entries.delete(PDFName.of('C'));
  entries.set(PDFName.of('Border'), doc.context.obj([0, 0, 0]));
  entries.set(
    PDFName.of('A'),
    doc.context.obj({ Type: 'Action', S: 'URI', URI: PDFHexString.fromText(annot.url) })
  );
  registerAnnot(page, toDict(doc, entries));
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function sanitizeForWinAnsi(s: string): string {
  // Helvetica (WinAnsi) cannot encode arbitrary unicode; replace what won't fit.
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}

// ─────────────────────────────── Public API ───────────────────────────────

export async function addAnnotations(bytes: Uint8Array, annots: NewAnnotation[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const annot of annots) {
    if (annot.pageIndex < 0 || annot.pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(annot.pageIndex);
    switch (annot.kind) {
      case 'highlight':
      case 'underline':
      case 'strikeout':
      case 'squiggly':
        buildMarkup(doc, page, annot);
        break;
      case 'note':
        buildNote(doc, page, annot);
        break;
      case 'ink':
      case 'marker':
        buildInk(doc, page, annot);
        break;
      case 'rect':
      case 'ellipse':
        buildShape(doc, page, annot);
        break;
      case 'line':
      case 'arrow':
        buildLine(doc, page, annot);
        break;
      case 'cloud':
        buildCloud(doc, page, annot);
        break;
      case 'textbox':
      case 'callout':
        await buildFreeText(doc, page, annot);
        break;
      case 'link':
        buildLink(doc, page, annot);
        break;
    }
  }
  return doc.save();
}

/** Finds annotation refs whose /NM matches, across all pages. */
function findByName(doc: PDFDocument, names: Set<string>): Array<{ page: PDFPage; ref: PDFRef; dict: PDFDict }> {
  const found: Array<{ page: PDFPage; ref: PDFRef; dict: PDFDict }> = [];
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      if (!(ref instanceof PDFRef)) continue;
      const dict = doc.context.lookup(ref);
      if (!(dict instanceof PDFDict)) continue;
      const nm = dict.lookup(PDFName.of('NM'));
      const nmText =
        nm instanceof PDFHexString ? nm.decodeText() : nm ? String(nm) : '';
      if (names.has(nmText)) found.push({ page, ref, dict });
    }
  }
  return found;
}

export async function deleteAnnotationsByName(bytes: Uint8Array, names: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const targets = new Set(names);
  const victims = findByName(doc, targets);
  const victimRefs = new Set(victims.map((v) => v.ref.toString()));
  for (const page of doc.getPages()) {
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (!(annots instanceof PDFArray)) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const ref = annots.get(i);
      if (ref instanceof PDFRef && victimRefs.has(ref.toString())) {
        annots.remove(i);
      } else if (ref instanceof PDFRef) {
        // Also remove replies pointing at deleted parents.
        const dict = doc.context.lookup(ref);
        if (dict instanceof PDFDict) {
          const irt = dict.get(PDFName.of('IRT'));
          if (irt instanceof PDFRef && victimRefs.has(irt.toString())) annots.remove(i);
        }
      }
    }
  }
  return doc.save();
}

export async function updateAnnotationContents(
  bytes: Uint8Array,
  name: string,
  contents: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const { dict } of findByName(doc, new Set([name]))) {
    dict.set(PDFName.of('Contents'), PDFHexString.fromText(contents));
    dict.set(PDFName.of('M'), PDFHexString.fromText(toPdfDate()));
  }
  return doc.save();
}

/** Adds a reply (Text annotation with /IRT) to an existing annotation. */
export async function addReply(
  bytes: Uint8Array,
  parentName: string,
  reply: { id: string; author: string; contents: string }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const parents = findByName(doc, new Set([parentName]));
  const parent = parents[0];
  if (!parent) throw new Error(`Annotation "${parentName}" not found`);
  const rect = parent.dict.lookup(PDFName.of('Rect'));
  const entries = new Map<PDFName, unknown>();
  entries.set(PDFName.of('Type'), PDFName.of('Annot'));
  entries.set(PDFName.of('Subtype'), PDFName.of('Text'));
  entries.set(PDFName.of('Rect'), rect ?? doc.context.obj([0, 0, 20, 20]));
  entries.set(PDFName.of('NM'), PDFHexString.fromText(reply.id));
  entries.set(PDFName.of('T'), PDFHexString.fromText(reply.author));
  entries.set(PDFName.of('Contents'), PDFHexString.fromText(reply.contents));
  entries.set(PDFName.of('M'), PDFHexString.fromText(toPdfDate()));
  entries.set(PDFName.of('IRT'), parent.ref);
  entries.set(PDFName.of('RT'), PDFName.of('R'));
  entries.set(PDFName.of('F'), PDFNumber.of(4));
  registerAnnot(parent.page, toDict(doc, entries));
  return doc.save();
}

/** Sets review status by appending a state reply (StateModel "Review"). */
export async function setReviewState(
  bytes: Uint8Array,
  parentName: string,
  state: 'Accepted' | 'Rejected' | 'Completed' | 'Cancelled' | 'None',
  author: string,
  stateId: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const parents = findByName(doc, new Set([parentName]));
  const parent = parents[0];
  if (!parent) throw new Error(`Annotation "${parentName}" not found`);
  const entries = new Map<PDFName, unknown>();
  entries.set(PDFName.of('Type'), PDFName.of('Annot'));
  entries.set(PDFName.of('Subtype'), PDFName.of('Text'));
  entries.set(PDFName.of('Rect'), doc.context.obj([0, 0, 0, 0]));
  entries.set(PDFName.of('NM'), PDFHexString.fromText(stateId));
  entries.set(PDFName.of('T'), PDFHexString.fromText(author));
  entries.set(PDFName.of('Contents'), PDFHexString.fromText(state));
  entries.set(PDFName.of('M'), PDFHexString.fromText(toPdfDate()));
  entries.set(PDFName.of('IRT'), parent.ref);
  entries.set(PDFName.of('RT'), PDFName.of('R'));
  entries.set(PDFName.of('State'), PDFHexString.fromText(state));
  entries.set(PDFName.of('StateModel'), PDFHexString.fromText('Review'));
  entries.set(PDFName.of('F'), PDFNumber.of(4));
  registerAnnot(parent.page, toDict(doc, entries));
  return doc.save();
}

/** Removes ALL annotations (used by "flatten & sanitize" pipelines). */
export async function removeAllAnnotations(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of('Annots'));
  }
  return doc.save();
}
