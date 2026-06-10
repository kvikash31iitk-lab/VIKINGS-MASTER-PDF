/**
 * Content composer — compiles Edit-mode objects (text boxes, images, shapes,
 * white-out patches, tables) into real page content via pdf-lib drawing APIs.
 * Hyperlinks are delegated to the annotation writer (Link annotations).
 */
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { hexToRgb } from './utils';

export type FontFamily = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface TextOp {
  kind: 'text';
  x: number;
  y: number; // baseline of first line
  lines: string[];
  fontSize: number;
  color: string;
  fontFamily: FontFamily;
  bold?: boolean;
  italic?: boolean;
  lineHeight?: number; // multiplier, default 1.2
  charSpacing?: number;
  rotation?: number;
}

export interface ImageOp {
  kind: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  bytes: Uint8Array;
  format: 'png' | 'jpg';
  rotation?: number;
  opacity?: number;
}

export interface RectOp {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
}

export interface LineOp {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface EllipseOp {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface TableOp {
  kind: 'table';
  x: number;
  y: number; // top-left of the table (y = top)
  colWidths: number[];
  rowHeight: number;
  cells: string[][];
  fontSize: number;
  textColor: string;
  borderColor: string;
  headerFill?: string;
}

export type PageContentOp = TextOp | ImageOp | RectOp | LineOp | EllipseOp | TableOp;

export interface PlacedOp {
  pageIndex: number;
  op: PageContentOp;
}

type FontCache = Map<string, PDFFont>;

async function getFont(
  doc: PDFDocument,
  cache: FontCache,
  family: FontFamily,
  bold: boolean,
  italic: boolean
): Promise<PDFFont> {
  const key = `${family}:${bold ? 'b' : ''}${italic ? 'i' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const table: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
    Helvetica: [
      StandardFonts.Helvetica,
      StandardFonts.HelveticaBold,
      StandardFonts.HelveticaOblique,
      StandardFonts.HelveticaBoldOblique
    ],
    TimesRoman: [
      StandardFonts.TimesRoman,
      StandardFonts.TimesRomanBold,
      StandardFonts.TimesRomanItalic,
      StandardFonts.TimesRomanBoldItalic
    ],
    Courier: [
      StandardFonts.Courier,
      StandardFonts.CourierBold,
      StandardFonts.CourierOblique,
      StandardFonts.CourierBoldOblique
    ]
  };
  const idx = (bold ? 1 : 0) + (italic ? 2 : 0);
  const font = await doc.embedFont(table[family][idx]!);
  cache.set(key, font);
  return font;
}

export async function composePageContent(bytes: Uint8Array, ops: PlacedOp[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const fontCache: FontCache = new Map();
  const imageCache = new Map<PageContentOp, PDFImage>();

  for (const placed of ops) {
    if (placed.pageIndex < 0 || placed.pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(placed.pageIndex);
    await drawOp(doc, page, placed.op, fontCache, imageCache);
  }
  return doc.save();
}

async function drawOp(
  doc: PDFDocument,
  page: PDFPage,
  op: PageContentOp,
  fonts: FontCache,
  images: Map<PageContentOp, PDFImage>
): Promise<void> {
  switch (op.kind) {
    case 'text': {
      const font = await getFont(doc, fonts, op.fontFamily, !!op.bold, !!op.italic);
      const lh = (op.lineHeight ?? 1.2) * op.fontSize;
      let y = op.y;
      for (const line of op.lines) {
        if (line) {
          page.drawText(line, {
            x: op.x,
            y,
            size: op.fontSize,
            font,
            color: hexToRgb(op.color),
            rotate: degrees(op.rotation ?? 0),
            ...(op.charSpacing ? { wordBreaks: [] } : {})
          });
        }
        y -= lh;
      }
      break;
    }
    case 'image': {
      let image = images.get(op);
      if (!image) {
        image = op.format === 'png' ? await doc.embedPng(op.bytes) : await doc.embedJpg(op.bytes);
        images.set(op, image);
      }
      page.drawImage(image, {
        x: op.x,
        y: op.y,
        width: op.width,
        height: op.height,
        rotate: degrees(op.rotation ?? 0),
        opacity: op.opacity ?? 1
      });
      break;
    }
    case 'rect': {
      page.drawRectangle({
        x: op.x,
        y: op.y,
        width: op.width,
        height: op.height,
        ...(op.fillColor ? { color: hexToRgb(op.fillColor) } : {}),
        ...(op.strokeColor ? { borderColor: hexToRgb(op.strokeColor) } : {}),
        borderWidth: op.strokeWidth ?? 0,
        opacity: op.opacity ?? 1,
        rotate: degrees(op.rotation ?? 0)
      });
      break;
    }
    case 'line': {
      page.drawLine({
        start: { x: op.x1, y: op.y1 },
        end: { x: op.x2, y: op.y2 },
        thickness: op.width,
        color: hexToRgb(op.color)
      });
      break;
    }
    case 'ellipse': {
      page.drawEllipse({
        x: op.cx,
        y: op.cy,
        xScale: op.rx,
        yScale: op.ry,
        ...(op.fillColor ? { color: hexToRgb(op.fillColor) } : {}),
        ...(op.strokeColor ? { borderColor: hexToRgb(op.strokeColor) } : {}),
        borderWidth: op.strokeWidth ?? 0,
        opacity: op.opacity ?? 1
      });
      break;
    }
    case 'table': {
      await drawTable(doc, page, op, fonts);
      break;
    }
  }
}

async function drawTable(doc: PDFDocument, page: PDFPage, op: TableOp, fonts: FontCache): Promise<void> {
  const font = await getFont(doc, fonts, 'Helvetica', false, false);
  const fontBold = await getFont(doc, fonts, 'Helvetica', true, false);
  const border = hexToRgb(op.borderColor);
  const text = hexToRgb(op.textColor);
  const totalW = op.colWidths.reduce((a, b) => a + b, 0);
  const rows = op.cells.length;
  const totalH = rows * op.rowHeight;
  const top = op.y;

  if (op.headerFill && rows > 0) {
    page.drawRectangle({
      x: op.x,
      y: top - op.rowHeight,
      width: totalW,
      height: op.rowHeight,
      color: hexToRgb(op.headerFill)
    });
  }

  // Grid lines.
  for (let rIdx = 0; rIdx <= rows; rIdx++) {
    const y = top - rIdx * op.rowHeight;
    page.drawLine({ start: { x: op.x, y }, end: { x: op.x + totalW, y }, thickness: 0.75, color: border });
  }
  let cx = op.x;
  for (let c = 0; c <= op.colWidths.length; c++) {
    page.drawLine({
      start: { x: cx, y: top },
      end: { x: cx, y: top - totalH },
      thickness: 0.75,
      color: border
    });
    if (c < op.colWidths.length) cx += op.colWidths[c]!;
  }

  // Cell text (clipped by truncation to fit column width).
  for (let rIdx = 0; rIdx < rows; rIdx++) {
    const row = op.cells[rIdx]!;
    let tx = op.x;
    for (let c = 0; c < op.colWidths.length; c++) {
      const cell = row[c] ?? '';
      const colW = op.colWidths[c]!;
      const f = rIdx === 0 && op.headerFill ? fontBold : font;
      let s = cell;
      while (s.length > 1 && f.widthOfTextAtSize(s, op.fontSize) > colW - 8) {
        s = s.slice(0, -1);
      }
      if (s) {
        page.drawText(s, {
          x: tx + 4,
          y: top - rIdx * op.rowHeight - op.rowHeight + (op.rowHeight - op.fontSize) / 2 + 2,
          size: op.fontSize,
          font: f,
          color: text
        });
      }
      tx += colW;
    }
  }
}
