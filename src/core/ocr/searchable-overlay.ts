/**
 * Searchable-PDF builder — lays an invisible text layer over scanned pages
 * using OCR word geometry, making the document selectable and searchable.
 *
 * Invisibility uses fill opacity 0 (ExtGState ca 0): text extraction and
 * search are unaffected in all mainstream viewers. Non-WinAnsi-encodable
 * words (e.g. Devanagari/CJK without an embedded Unicode font) are skipped
 * unless a custom font is supplied by the caller.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';

export interface OcrWord {
  text: string;
  /** Bounding box in source-image pixel coordinates (origin top-left). */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confidence: number;
}

export interface OcrPageResult {
  pageIndex: number;
  imageWidth: number;
  imageHeight: number;
  words: OcrWord[];
}

export interface OverlayOptions {
  /** Words below this confidence are dropped (0-100). */
  minConfidence: number;
  /** Optional TTF/OTF bytes for non-Latin scripts (requires fontkit registration upstream). */
  customFontBytes?: Uint8Array;
}

export interface OverlayStats {
  pagesProcessed: number;
  wordsPlaced: number;
  wordsSkipped: number;
}

export async function addSearchableTextLayer(
  bytes: Uint8Array,
  results: OcrPageResult[],
  options: OverlayOptions = { minConfidence: 35 }
): Promise<{ bytes: Uint8Array; stats: OverlayStats }> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  let font: PDFFont;
  if (options.customFontBytes) {
    font = await doc.embedFont(options.customFontBytes);
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  const stats: OverlayStats = { pagesProcessed: 0, wordsPlaced: 0, wordsSkipped: 0 };

  for (const result of results) {
    if (result.pageIndex < 0 || result.pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(result.pageIndex);
    const { width: pageW, height: pageH } = page.getSize();
    const scaleX = pageW / result.imageWidth;
    const scaleY = pageH / result.imageHeight;
    stats.pagesProcessed++;

    for (const word of result.words) {
      if (!word.text.trim() || word.confidence < options.minConfidence) {
        stats.wordsSkipped++;
        continue;
      }
      const boxHeightPt = (word.y1 - word.y0) * scaleY;
      const boxWidthPt = (word.x1 - word.x0) * scaleX;
      if (boxHeightPt <= 1 || boxWidthPt <= 0.5) {
        stats.wordsSkipped++;
        continue;
      }
      // Font size from box height; nudge baseline up from the box bottom.
      const fontSize = Math.max(2, boxHeightPt * 0.92);
      const x = word.x0 * scaleX;
      const y = pageH - word.y1 * scaleY + boxHeightPt * 0.18;

      try {
        page.drawText(word.text, {
          x,
          y,
          size: fontSize,
          font,
          opacity: 0
        });
        stats.wordsPlaced++;
      } catch {
        // Word contains glyphs outside the font's encoding — skip.
        stats.wordsSkipped++;
      }
    }
  }

  return { bytes: await doc.save(), stats };
}

/** Groups OCR words into line strings (for "editable text" output mode). */
export interface OcrLine {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function groupWordsIntoLines(words: OcrWord[], minConfidence = 35): OcrLine[] {
  const usable = words
    .filter((w) => w.text.trim() && w.confidence >= minConfidence)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines: OcrLine[] = [];
  for (const w of usable) {
    const h = w.y1 - w.y0;
    const line = lines.find((l) => {
      const lh = l.y1 - l.y0;
      const overlap = Math.min(l.y1, w.y1) - Math.max(l.y0, w.y0);
      return overlap > Math.min(h, lh) * 0.5;
    });
    if (line) {
      line.text += ` ${w.text}`;
      line.x1 = Math.max(line.x1, w.x1);
      line.y0 = Math.min(line.y0, w.y0);
      line.y1 = Math.max(line.y1, w.y1);
    } else {
      lines.push({ text: w.text, x0: w.x0, y0: w.y0, x1: w.x1, y1: w.y1 });
    }
  }
  return lines.sort((a, b) => a.y0 - b.y0);
}
