import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  createBlankPdf,
  insertBlankPages,
  insertPagesFromPdf,
  deletePages,
  duplicatePages,
  rotatePages,
  extractPages,
  splitByRanges,
  splitEveryN,
  mergePdfs,
  reorderPages,
  cropPages,
  readBasicInfo,
  PAGE_SIZES
} from '@core/pdf/page-ops';
import { makeBlankPdf, makeTextPdf } from '../helpers/sample-pdf';

const pageCount = async (bytes: Uint8Array): Promise<number> =>
  (await PDFDocument.load(bytes)).getPageCount();

describe('page-ops', () => {
  it('creates blank PDFs with requested page count and size', async () => {
    const bytes = await createBlankPdf(3, PAGE_SIZES.Letter!);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(612, 0);
  });

  it('inserts blank pages at an index', async () => {
    const base = await makeBlankPdf(2);
    const out = await insertBlankPages(base, 1, 2);
    expect(await pageCount(out)).toBe(4);
  });

  it('inserts pages from another document with a range', async () => {
    const base = await makeBlankPdf(2);
    const source = await makeBlankPdf(5);
    const out = await insertPagesFromPdf(base, source, 0, '2-3');
    expect(await pageCount(out)).toBe(4);
  });

  it('deletes pages and refuses to delete all', async () => {
    const base = await makeBlankPdf(4);
    const out = await deletePages(base, [1, 3]);
    expect(await pageCount(out)).toBe(2);
    await expect(deletePages(out, [0, 1])).rejects.toThrow();
  });

  it('duplicates pages in place', async () => {
    const base = await makeBlankPdf(3);
    const out = await duplicatePages(base, [0, 2]);
    expect(await pageCount(out)).toBe(5);
  });

  it('rotates pages cumulatively', async () => {
    const base = await makeBlankPdf(1);
    const out = await rotatePages(await rotatePages(base, [0], 90), [0], 90);
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getRotation().angle).toBe(180);
  });

  it('extracts a subset into a new document', async () => {
    const base = await makeBlankPdf(5);
    const out = await extractPages(base, [1, 3]);
    expect(await pageCount(out)).toBe(2);
  });

  it('splits by ranges and by every-N', async () => {
    const base = await makeBlankPdf(6);
    const ranges = await splitByRanges(base, ['1-2', '3-', '5']);
    expect(ranges.map((r) => r.label)).toEqual(['1-2', '3-', '5']);
    expect(await pageCount(ranges[0]!.bytes)).toBe(2);
    expect(await pageCount(ranges[1]!.bytes)).toBe(4);

    const chunks = await splitEveryN(base, 4);
    expect(chunks).toHaveLength(2);
    expect(await pageCount(chunks[1]!.bytes)).toBe(2);
  });

  it('merges multiple documents in order', async () => {
    const a = await makeBlankPdf(2);
    const b = await makeBlankPdf(3);
    const out = await mergePdfs([a, b]);
    expect(await pageCount(out)).toBe(5);
  });

  it('reorders pages with a permutation and validates input', async () => {
    const base = await makeTextPdf([['page one'], ['page two'], ['page three']]);
    const out = await reorderPages(base, [2, 0, 1]);
    expect(await pageCount(out)).toBe(3);
    await expect(reorderPages(base, [0, 0, 1])).rejects.toThrow();
  });

  it('crops pages via CropBox', async () => {
    const base = await makeBlankPdf(1);
    const out = await cropPages(base, [0], { x: 10, y: 10, width: 200, height: 300 });
    const doc = await PDFDocument.load(out);
    const crop = doc.getPage(0).getCropBox();
    expect(crop.width).toBe(200);
    expect(crop.height).toBe(300);
  });

  it('reads basic info including metadata', async () => {
    const base = await makeTextPdf([['hello']]);
    const info = await readBasicInfo(base);
    expect(info.pageCount).toBe(1);
    expect(info.title).toBe('Sample Document');
    expect(info.encrypted).toBe(false);
  });
});
