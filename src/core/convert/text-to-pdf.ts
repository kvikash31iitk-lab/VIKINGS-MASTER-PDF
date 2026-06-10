/**
 * Text → PDF layout engine: word wrapping, pagination, margins, optional
 * monospace mode. Used by TXT/RTF/clipboard → PDF and AI report export.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';
import { PAGE_SIZES, type PageSize } from '../pdf/page-ops';
import { hexToRgb } from '../pdf/utils';

export interface TextToPdfOptions {
  pageSize?: PageSize;
  margin?: number;
  fontSize?: number;
  lineHeight?: number; // multiplier
  font?: 'Helvetica' | 'TimesRoman' | 'Courier';
  color?: string;
  title?: string;
}

export async function textToPdf(text: string, options: TextToPdfOptions = {}): Promise<Uint8Array> {
  const size = options.pageSize ?? PAGE_SIZES.A4!;
  const margin = options.margin ?? 56;
  const fontSize = options.fontSize ?? 11;
  const lineHeight = (options.lineHeight ?? 1.45) * fontSize;
  const color = hexToRgb(options.color ?? '#1a1a1a');

  const doc = await PDFDocument.create();
  if (options.title) doc.setTitle(options.title);
  doc.setProducer('Vikings Master PDF');
  doc.setCreator('Vikings Master PDF');

  const fontName =
    options.font === 'TimesRoman'
      ? StandardFonts.TimesRoman
      : options.font === 'Courier'
        ? StandardFonts.Courier
        : StandardFonts.Helvetica;
  const font = await doc.embedFont(fontName);

  const maxWidth = size.width - margin * 2;
  const linesPerPage = Math.floor((size.height - margin * 2) / lineHeight);
  const wrapped = wrapText(sanitize(text), font, fontSize, maxWidth);

  let page = doc.addPage([size.width, size.height]);
  let lineOnPage = 0;
  let y = size.height - margin - fontSize;

  for (const line of wrapped) {
    if (lineOnPage >= linesPerPage) {
      page = doc.addPage([size.width, size.height]);
      lineOnPage = 0;
      y = size.height - margin - fontSize;
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: fontSize, font, color });
    }
    y -= lineHeight;
    lineOnPage++;
  }

  return doc.save();
}

export function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, '    ');
    if (!line.trim()) {
      out.push('');
      continue;
    }
    let current = '';
    for (const word of line.split(/(\s+)/)) {
      const candidate = current + word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        current = candidate;
      } else if (current.trim()) {
        out.push(current.trimEnd());
        current = word.trimStart();
        // Hard-break single words longer than a line.
        while (font.widthOfTextAtSize(current, fontSize) > maxWidth && current.length > 1) {
          let cut = current.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), fontSize) > maxWidth) cut--;
          out.push(current.slice(0, cut));
          current = current.slice(cut);
        }
      } else {
        // First word longer than line width.
        let chunk = candidate;
        while (font.widthOfTextAtSize(chunk, fontSize) > maxWidth && chunk.length > 1) {
          let cut = chunk.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(chunk.slice(0, cut), fontSize) > maxWidth) cut--;
          out.push(chunk.slice(0, cut));
          chunk = chunk.slice(cut);
        }
        current = chunk;
      }
    }
    out.push(current.trimEnd());
  }
  return out;
}

/** Replaces characters Helvetica/WinAnsi cannot encode (shared by report writers). */
export function sanitizeWinAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\r\n?/g, '\n').replace(/[^\x09\x0a\x20-\x7e\xa0-\xff–—‘’“”•€]/g, '?');
}

function sanitize(text: string): string {
  return sanitizeWinAnsi(text);
}
