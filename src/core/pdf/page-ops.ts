/**
 * Page organization engine: pure bytes-in → bytes-out operations built on pdf-lib.
 * Every function loads, transforms and re-serializes — callers own undo snapshots.
 */
import { PDFDocument, degrees } from 'pdf-lib';
import { parsePageRanges } from './utils';

const LOAD_OPTS = { ignoreEncryption: false, updateMetadata: false } as const;

export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_SIZES: Record<string, PageSize> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  A3: { width: 841.89, height: 1190.55 },
  A5: { width: 419.53, height: 595.28 }
};

export async function createBlankPdf(pages = 1, size: PageSize = PAGE_SIZES.A4!): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([size.width, size.height]);
  return doc.save();
}

/** Inserts blank pages at `index` (0-based; clamped). */
export async function insertBlankPages(
  bytes: Uint8Array,
  index: number,
  count = 1,
  size?: PageSize
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, LOAD_OPTS);
  const at = Math.max(0, Math.min(index, doc.getPageCount()));
  const ref = doc.getPageCount() > 0 ? doc.getPage(Math.min(at, doc.getPageCount() - 1)).getSize() : PAGE_SIZES.A4!;
  const dims = size ?? ref;
  for (let i = 0; i < count; i++) doc.insertPage(at + i, [dims.width, dims.height]);
  return doc.save();
}

/** Inserts all (or selected) pages of another PDF at `index`. */
export async function insertPagesFromPdf(
  bytes: Uint8Array,
  sourceBytes: Uint8Array,
  index: number,
  sourceRange?: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, LOAD_OPTS);
  const src = await PDFDocument.load(sourceBytes, LOAD_OPTS);
  const indices = sourceRange
    ? parsePageRanges(sourceRange, src.getPageCount())
    : src.getPageIndices();
  const pages = await doc.copyPages(src, indices);
  const at = Math.max(0, Math.min(index, doc.getPageCount()));
  pages.forEach((page, i) => doc.insertPage(at + i, page));
  return doc.save();
}

export async function deletePages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, LOAD_OPTS);
  if (indices.length >= doc.getPageCount()) {
    throw new Error('Cannot delete every page of a document');
  }
  // Remove from highest index down so earlier removals don't shift targets.
  for (const i of [...new Set(indices)].sort((a, b) => b - a)) {
    if (i >= 0 && i < doc.getPageCount()) doc.removePage(i);
  }
  return doc.save();
}

export async function duplicatePages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, LOAD_OPTS);
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const copies = await doc.copyPages(doc, sorted);
  // Insert each copy immediately after its source, accounting for prior insertions.
  let shift = 1;
  for (let i = 0; i < sorted.length; i++) {
    doc.insertPage(sorted[i]! + shift, copies[i]!);
    shift++;
  }
  return doc.save();
}

/** Rotates pages by delta degrees (multiples of 90), preserving existing rotation. */
export async function rotatePages(bytes: Uint8Array, indices: number[], delta: number): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, LOAD_OPTS);
  for (const i of indices) {
    if (i < 0 || i >= doc.getPageCount()) continue;
    const page = doc.getPage(i);
    const current = page.getRotation().angle;
    page.setRotation(degrees(((current + delta) % 360 + 360) % 360));
  }
  return doc.save();
}

/** Extracts pages into a new document (original untouched). */
export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, LOAD_OPTS);
  const out = await PDFDocument.create();
  const valid = indices.filter((i) => i >= 0 && i < src.getPageCount());
  if (valid.length === 0) throw new Error('No valid pages selected for extraction');
  const pages = await out.copyPages(src, valid);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export interface SplitResult {
  label: string;
  bytes: Uint8Array;
}

/** Splits by explicit range expressions; each expression becomes one output file. */
export async function splitByRanges(bytes: Uint8Array, rangeExprs: string[]): Promise<SplitResult[]> {
  const src = await PDFDocument.load(bytes, LOAD_OPTS);
  const count = src.getPageCount();
  const results: SplitResult[] = [];
  for (const expr of rangeExprs) {
    const indices = parsePageRanges(expr, count);
    if (indices.length === 0) continue;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    results.push({ label: expr.replace(/\s+/g, ''), bytes: await out.save() });
  }
  return results;
}

/** Splits into chunks of N pages. */
export async function splitEveryN(bytes: Uint8Array, n: number): Promise<SplitResult[]> {
  if (n < 1) throw new Error('Chunk size must be at least 1');
  const src = await PDFDocument.load(bytes, LOAD_OPTS);
  const count = src.getPageCount();
  const results: SplitResult[] = [];
  for (let start = 0; start < count; start += n) {
    const indices = Array.from({ length: Math.min(n, count - start) }, (_, i) => start + i);
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, indices);
    pages.forEach((p) => out.addPage(p));
    results.push({ label: `pages-${start + 1}-${start + indices.length}`, bytes: await out.save() });
  }
  return results;
}

/** Merges multiple PDFs in order. */
export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('No files to merge');
  const out = await PDFDocument.create();
  for (const fileBytes of files) {
    const src = await PDFDocument.load(fileBytes, LOAD_OPTS);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save();
}

/**
 * Reorders pages: `order` is the full permutation of current indices
 * (new position i shows old page order[i]).
 */
export async function reorderPages(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, LOAD_OPTS);
  const count = src.getPageCount();
  if (order.length !== count || new Set(order).size !== count) {
    throw new Error('Order must be a permutation of all page indices');
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, order);
  pages.forEach((p) => out.addPage(p));
  // Preserve document-level metadata.
  copyMetadata(src, out);
  return out.save();
}

/** Sets the CropBox of selected pages (points, origin bottom-left). */
export async function cropPages(
  bytes: Uint8Array,
  indices: number[],
  box: { x: number; y: number; width: number; height: number }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, LOAD_OPTS);
  for (const i of indices) {
    if (i < 0 || i >= doc.getPageCount()) continue;
    doc.getPage(i).setCropBox(box.x, box.y, box.width, box.height);
  }
  return doc.save();
}

function copyMetadata(src: PDFDocument, dst: PDFDocument): void {
  const title = src.getTitle();
  const author = src.getAuthor();
  const subject = src.getSubject();
  const creator = src.getCreator();
  if (title) dst.setTitle(title);
  if (author) dst.setAuthor(author);
  if (subject) dst.setSubject(subject);
  if (creator) dst.setCreator(creator);
}

export interface PdfBasicInfo {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  pageSizes: PageSize[];
  encrypted: boolean;
}

export async function readBasicInfo(bytes: Uint8Array): Promise<PdfBasicInfo> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return {
    pageCount: doc.getPageCount(),
    title: doc.getTitle() ?? undefined,
    author: doc.getAuthor() ?? undefined,
    subject: doc.getSubject() ?? undefined,
    creator: doc.getCreator() ?? undefined,
    producer: doc.getProducer() ?? undefined,
    pageSizes: doc.getPages().map((p) => p.getSize()),
    encrypted: doc.isEncrypted
  };
}
