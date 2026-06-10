/**
 * Headers & footers with dynamic tokens:
 *   {page} {pages} {date} {time} {filename} and arbitrary literal text.
 * Six slots: header/footer × left/center/right. Page ranges supported.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { hexToRgb, resolvePageSelection } from './utils';

export interface HeaderFooterSlots {
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

export interface HeaderFooterOptions extends HeaderFooterSlots {
  fontSize: number;
  color: string;
  marginTop: number; // distance from top edge to header baseline area
  marginBottom: number;
  marginSide: number;
  pageRange?: string;
  fileName?: string;
  /** First page number offset, e.g. front-matter documents starting at 1 on page 3. */
  startNumber?: number;
  date?: Date;
}

export function expandTokens(
  template: string,
  ctx: { page: number; pages: number; fileName: string; date: Date }
): string {
  const d = ctx.date;
  const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return template
    .replace(/\{page\}/gi, String(ctx.page))
    .replace(/\{pages\}/gi, String(ctx.pages))
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{filename\}/gi, ctx.fileName);
}

export async function applyHeaderFooter(
  bytes: Uint8Array,
  options: HeaderFooterOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const indices = resolvePageSelection(options.pageRange, doc.getPageCount());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(options.color);
  const date = options.date ?? new Date();
  const fileName = options.fileName ?? '';
  const pages = doc.getPageCount();
  const start = options.startNumber ?? 1;

  for (let n = 0; n < indices.length; n++) {
    const pageIndex = indices[n]!;
    const page = doc.getPage(pageIndex);
    const { width, height } = page.getSize();
    const ctx = { page: start + n, pages, fileName, date };

    const slots: Array<{ text?: string; align: 'left' | 'center' | 'right'; isHeader: boolean }> = [
      { text: options.headerLeft, align: 'left', isHeader: true },
      { text: options.headerCenter, align: 'center', isHeader: true },
      { text: options.headerRight, align: 'right', isHeader: true },
      { text: options.footerLeft, align: 'left', isHeader: false },
      { text: options.footerCenter, align: 'center', isHeader: false },
      { text: options.footerRight, align: 'right', isHeader: false }
    ];

    for (const slot of slots) {
      if (!slot.text) continue;
      const text = expandTokens(slot.text, ctx);
      if (!text) continue;
      const textWidth = font.widthOfTextAtSize(text, options.fontSize);
      const x = xForAlignment(slot.align, width, textWidth, options.marginSide);
      const y = slot.isHeader
        ? height - options.marginTop
        : options.marginBottom - font.heightAtSize(options.fontSize) * 0.25;
      page.drawText(text, { x, y, size: options.fontSize, font, color });
    }
  }
  return doc.save();
}

function xForAlignment(
  align: 'left' | 'center' | 'right',
  pageWidth: number,
  textWidth: number,
  margin: number
): number {
  switch (align) {
    case 'left':
      return margin;
    case 'center':
      return (pageWidth - textWidth) / 2;
    case 'right':
      return pageWidth - textWidth - margin;
  }
}

export function defaultHeaderFooterOptions(): HeaderFooterOptions {
  return {
    fontSize: 9,
    color: '#444444',
    marginTop: 28,
    marginBottom: 28,
    marginSide: 36,
    footerCenter: 'Page {page} of {pages}'
  };
}

/** Re-export font util for dialogs that preview header/footer text width. */
export type { PDFFont };
