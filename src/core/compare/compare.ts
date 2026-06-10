/**
 * Document comparison: per-page text diff (Myers via the `diff` package)
 * with change classification, plus a printable review report builder.
 * Pixel-level overlay diffing happens renderer-side (canvas); this module
 * owns the text model and report generation.
 */
import { diffWordsWithSpace } from 'diff';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { wrapText, sanitizeWinAnsi } from '../convert/text-to-pdf';

export interface PageDiff {
  pageIndex: number;
  changes: DiffChange[];
  insertions: number;
  deletions: number;
}

export interface DiffChange {
  kind: 'equal' | 'insert' | 'delete';
  text: string;
}

export interface ComparisonResult {
  pages: PageDiff[];
  totalInsertions: number;
  totalDeletions: number;
  changedPages: number[];
  identical: boolean;
}

export function compareDocumentText(
  pagesA: Array<{ pageIndex: number; text: string }>,
  pagesB: Array<{ pageIndex: number; text: string }>
): ComparisonResult {
  const pageCount = Math.max(pagesA.length, pagesB.length);
  const pages: PageDiff[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (let i = 0; i < pageCount; i++) {
    const a = pagesA[i]?.text ?? '';
    const b = pagesB[i]?.text ?? '';
    const parts = diffWordsWithSpace(normalize(a), normalize(b));
    const changes: DiffChange[] = [];
    let insertions = 0;
    let deletions = 0;
    for (const part of parts) {
      const kind: DiffChange['kind'] = part.added ? 'insert' : part.removed ? 'delete' : 'equal';
      if (kind === 'insert') insertions++;
      if (kind === 'delete') deletions++;
      if (part.value.trim() || kind === 'equal') {
        changes.push({ kind, text: part.value });
      }
    }
    totalInsertions += insertions;
    totalDeletions += deletions;
    pages.push({ pageIndex: i, changes, insertions, deletions });
  }

  const changedPages = pages.filter((p) => p.insertions + p.deletions > 0).map((p) => p.pageIndex);
  return {
    pages,
    totalInsertions,
    totalDeletions,
    changedPages,
    identical: changedPages.length === 0
  };
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ───────────────────────── Review report (PDF) ─────────────────────────

export interface ReportMeta {
  originalName: string;
  revisedName: string;
  comparedAt?: Date;
}

export async function buildComparisonReportPdf(
  result: ComparisonResult,
  meta: ReportMeta
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Comparison Report');
  doc.setProducer('Vikings Master PDF');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [595.28, 841.89];
  const margin = 50;
  const maxWidth = pageSize[0] - margin * 2;
  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const newPageIfNeeded = (needed: number): void => {
    if (y - needed < margin) {
      page = doc.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };
  const writeLine = (text: string, opts: { size?: number; isBold?: boolean; color?: [number, number, number] } = {}): void => {
    const size = opts.size ?? 10;
    const f = opts.isBold ? bold : font;
    for (const line of wrapText(sanitizeWinAnsi(text), f, size, maxWidth)) {
      newPageIfNeeded(size * 1.5);
      if (line) {
        const c = opts.color ?? [0.1, 0.1, 0.1];
        page.drawText(line, { x: margin, y, size, font: f, color: rgb(c[0], c[1], c[2]) });
      }
      y -= size * 1.5;
    }
  };

  writeLine('Document Comparison Report', { size: 20, isBold: true });
  y -= 6;
  writeLine(`Original:  ${meta.originalName}`);
  writeLine(`Revised:   ${meta.revisedName}`);
  writeLine(`Compared:  ${(meta.comparedAt ?? new Date()).toLocaleString()}`);
  y -= 10;

  if (result.identical) {
    writeLine('No textual differences were detected.', { isBold: true, color: [0.06, 0.49, 0.06] });
  } else {
    writeLine(
      `${result.changedPages.length} page(s) changed — ${result.totalInsertions} insertion(s), ${result.totalDeletions} deletion(s).`,
      { isBold: true }
    );
    y -= 8;

    for (const pageDiff of result.pages) {
      if (pageDiff.insertions + pageDiff.deletions === 0) continue;
      newPageIfNeeded(40);
      writeLine(`Page ${pageDiff.pageIndex + 1}`, { size: 13, isBold: true });
      for (const change of pageDiff.changes) {
        if (change.kind === 'equal') continue;
        const label = change.kind === 'insert' ? '+ ' : '- ';
        const color: [number, number, number] = change.kind === 'insert' ? [0.06, 0.45, 0.06] : [0.78, 0.16, 0.16];
        writeLine(label + condense(change.text), { size: 9.5, color });
      }
      y -= 6;
    }
  }

  return doc.save();
}

function condense(s: string): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > 300 ? `${clean.slice(0, 297)}…` : clean;
}
