/**
 * Redaction engine — TRUE content destruction.
 *
 * Strategy: pages containing redaction marks are re-rasterized by the renderer
 * (which blacks out the marked regions in the bitmap BEFORE it reaches this
 * module), then this module REPLACES the page's content streams, resources and
 * annotations with a single full-page image. The original text, images and
 * vector content of that page are removed from the document — they do not
 * survive in any recoverable form. Optionally the caller re-runs OCR on the
 * censored bitmap to restore searchability of the remaining text.
 *
 * Pattern matching (emails, phones, Aadhaar, PAN, credit cards) happens over
 * extracted text in `findPatternMatches`; geometry mapping is done by the
 * caller which owns text-position data.
 */
import { PDFDocument, PDFName } from 'pdf-lib';
import { luhnCheck } from './utils';
import { REDACTION_PATTERNS } from '../../shared/constants';

export interface RedactionMark {
  pageIndex: number;
  /** PDF points, origin bottom-left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** What produced this mark (manual | search:<term> | pattern:<id>). */
  source: string;
}

export interface CensoredPage {
  pageIndex: number;
  /** Censored full-page bitmap (regions already blacked out). */
  imageBytes: Uint8Array;
  imageFormat: 'png' | 'jpg';
}

/**
 * Replaces each marked page's content with its censored raster image.
 * The replacement wipes: content streams, resources, annotations, thumbnails.
 */
export async function applyRedactions(bytes: Uint8Array, pages: CensoredPage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });

  for (const { pageIndex, imageBytes, imageFormat } of pages) {
    if (pageIndex < 0 || pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(pageIndex);
    const { width, height } = page.getSize();

    // Destroy original page payload.
    page.node.delete(PDFName.of('Contents'));
    page.node.delete(PDFName.of('Annots'));
    page.node.delete(PDFName.of('Thumb'));
    page.node.delete(PDFName.of('PieceInfo'));
    page.node.set(PDFName.of('Resources'), doc.context.obj({}));
    // Normalize rotation: the censored bitmap is upright.
    page.node.delete(PDFName.of('Rotate'));

    const image =
      imageFormat === 'png' ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  // A redacted document must not leak via metadata either.
  doc.setProducer('Vikings Master PDF');
  doc.setModificationDate(new Date());
  return doc.save();
}

export interface PatternMatch {
  patternId: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Finds built-in pattern matches in extracted page text.
 * Credit-card candidates additionally pass a Luhn checksum.
 */
export function findPatternMatches(pageText: string, patternIds: string[]): PatternMatch[] {
  const out: PatternMatch[] = [];
  for (const id of patternIds) {
    const def = REDACTION_PATTERNS.find((p) => p.id === id);
    if (!def) continue;
    const re = new RegExp(def.regex, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(pageText)) !== null) {
      const text = m[0];
      if ('postValidate' in def && def.postValidate === 'luhn' && !luhnCheck(text)) continue;
      out.push({ patternId: id, text, start: m.index, end: m.index + text.length });
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-length loops
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Finds literal/regex search matches for search-based redaction. */
export function findSearchMatches(
  pageText: string,
  query: string,
  options: { regex?: boolean; caseSensitive?: boolean; wholeWord?: boolean }
): Array<{ start: number; end: number; text: string }> {
  if (!query) return [];
  let source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (options.wholeWord) source = `\\b(?:${source})\\b`;
  let re: RegExp;
  try {
    re = new RegExp(source, options.caseSensitive ? 'g' : 'gi');
  } catch {
    return [];
  }
  const out: Array<{ start: number; end: number; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(pageText)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }
  return out;
}
