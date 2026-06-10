/**
 * Bates numbering — sequential legal document identifiers with prefix/suffix,
 * zero padding, configurable position and page ranges. Batch-aware: the caller
 * threads `nextNumber` across files for continuous numbering.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { hexToRgb, resolvePageSelection } from './utils';

export interface BatesOptions {
  prefix: string;
  suffix: string;
  startNumber: number;
  padWidth: number; // e.g. 6 → 000001
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  fontSize: number;
  color: string;
  margin: number;
  pageRange?: string;
}

export interface BatesResult {
  bytes: Uint8Array;
  /** Next number to continue with (for multi-file batches). */
  nextNumber: number;
  applied: number;
}

export function formatBates(options: Pick<BatesOptions, 'prefix' | 'suffix' | 'padWidth'>, n: number): string {
  return `${options.prefix}${String(n).padStart(options.padWidth, '0')}${options.suffix}`;
}

export async function applyBatesNumbering(bytes: Uint8Array, options: BatesOptions): Promise<BatesResult> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const indices = resolvePageSelection(options.pageRange, doc.getPageCount());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(options.color);

  let n = options.startNumber;
  for (const pageIndex of indices) {
    const page = doc.getPage(pageIndex);
    const { width, height } = page.getSize();
    const label = formatBates(options, n);
    const textWidth = font.widthOfTextAtSize(label, options.fontSize);

    let x: number;
    if (options.position.endsWith('left')) x = options.margin;
    else if (options.position.endsWith('center')) x = (width - textWidth) / 2;
    else x = width - textWidth - options.margin;

    const y = options.position.startsWith('top')
      ? height - options.margin
      : options.margin - font.heightAtSize(options.fontSize) * 0.25;

    page.drawText(label, { x, y, size: options.fontSize, font, color });
    n++;
  }

  return { bytes: await doc.save(), nextNumber: n, applied: indices.length };
}

export function defaultBatesOptions(): BatesOptions {
  return {
    prefix: 'VIK-',
    suffix: '',
    startNumber: 1,
    padWidth: 6,
    position: 'bottom-right',
    fontSize: 10,
    color: '#000000',
    margin: 28
  };
}
