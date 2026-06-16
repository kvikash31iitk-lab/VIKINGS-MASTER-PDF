import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { runPdfOp } from '@core/pdf/op-runner';
import { makeBlankPdf, makeTextPdf } from '../helpers/sample-pdf';

describe('runPdfOp (worker op registry)', () => {
  it('dispatches insertBlankPages', async () => {
    const out = await runPdfOp(await makeBlankPdf(2), { kind: 'insertBlankPages', index: 1 });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  });

  it('dispatches deletePages', async () => {
    const out = await runPdfOp(await makeBlankPdf(3), { kind: 'deletePages', indices: [0] });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });

  it('dispatches duplicatePages', async () => {
    const out = await runPdfOp(await makeBlankPdf(2), { kind: 'duplicatePages', indices: [0] });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  });

  it('dispatches rotatePages', async () => {
    const out = await runPdfOp(await makeBlankPdf(1), { kind: 'rotatePages', indices: [0], delta: 90 });
    expect((await PDFDocument.load(out)).getPage(0).getRotation().angle).toBe(90);
  });

  it('dispatches reorderPages', async () => {
    const out = await runPdfOp(await makeBlankPdf(3), { kind: 'reorderPages', order: [2, 1, 0] });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
  });

  it('dispatches writeMetadata', async () => {
    const out = await runPdfOp(await makeTextPdf([['Hello']]), { kind: 'writeMetadata', meta: { title: 'Renamed' } });
    expect((await PDFDocument.load(out)).getTitle()).toBe('Renamed');
  });

  it('dispatches flattenForm on a form-less document without error', async () => {
    const out = await runPdfOp(await makeBlankPdf(1), { kind: 'flattenForm' });
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it('rejects an unknown op kind', async () => {
    await expect(runPdfOp(await makeBlankPdf(1), { kind: 'bogus' } as never)).rejects.toThrow();
  });
});
