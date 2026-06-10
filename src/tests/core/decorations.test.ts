import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { applyWatermark } from '@core/pdf/watermark';
import { applyHeaderFooter, expandTokens, defaultHeaderFooterOptions } from '@core/pdf/header-footer';
import { applyBatesNumbering, formatBates, defaultBatesOptions } from '@core/pdf/bates';
import { applyStamp, BUILT_IN_STAMP_SPECS } from '@core/pdf/stamps';
import { makeBlankPdf, makeTextPdf, TINY_PNG } from '../helpers/sample-pdf';

describe('watermark', () => {
  it('applies a text watermark to selected pages', async () => {
    const base = await makeBlankPdf(3);
    const out = await applyWatermark(base, {
      kind: 'text',
      text: 'CONFIDENTIAL',
      fontSize: 48,
      color: '#d13438',
      opacity: 0.3,
      rotation: 45,
      zone: 'center',
      tiled: false,
      behindContent: false,
      pageRange: '1-2'
    });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(out.length).toBeGreaterThan(base.length);
  });

  it('applies tiled and behind-content watermarks without corrupting the file', async () => {
    const base = await makeTextPdf([['Body text on top']]);
    const out = await applyWatermark(base, {
      kind: 'text',
      text: 'DRAFT',
      fontSize: 24,
      color: '#605e5c',
      opacity: 0.15,
      rotation: -30,
      zone: 'center',
      tiled: true,
      behindContent: true
    });
    await expect(PDFDocument.load(out)).resolves.toBeDefined();
  });

  it('applies an image watermark', async () => {
    const base = await makeBlankPdf(1);
    const out = await applyWatermark(base, {
      kind: 'image',
      imageBytes: TINY_PNG,
      imageFormat: 'png',
      scale: 10,
      opacity: 0.5,
      rotation: 0,
      zone: 'bottom-right',
      tiled: false,
      behindContent: false
    });
    await expect(PDFDocument.load(out)).resolves.toBeDefined();
  });
});

describe('header-footer', () => {
  it('expands dynamic tokens', () => {
    const out = expandTokens('Page {page} of {pages} — {filename}', {
      page: 3,
      pages: 10,
      fileName: 'contract.pdf',
      date: new Date(2026, 5, 10, 14, 5)
    });
    expect(out).toBe('Page 3 of 10 — contract.pdf');
    const dated = expandTokens('{date} {time}', {
      page: 1,
      pages: 1,
      fileName: '',
      date: new Date(2026, 5, 10, 14, 5)
    });
    expect(dated).toBe('10/06/2026 14:05');
  });

  it('stamps all six slots over a page range', async () => {
    const base = await makeBlankPdf(4);
    const out = await applyHeaderFooter(base, {
      ...defaultHeaderFooterOptions(),
      headerLeft: 'ACME vs ACME',
      headerCenter: '{filename}',
      headerRight: '{date}',
      footerLeft: 'Confidential',
      footerCenter: 'Page {page} of {pages}',
      footerRight: '{time}',
      fileName: 'case.pdf',
      pageRange: '2-4',
      startNumber: 1
    });
    await expect(PDFDocument.load(out)).resolves.toBeDefined();
  });
});

describe('bates numbering', () => {
  it('formats with prefix, suffix and zero padding', () => {
    expect(formatBates({ prefix: 'VIK-', suffix: '-X', padWidth: 6 }, 42)).toBe('VIK-000042-X');
  });

  it('applies sequential numbers and reports the continuation number', async () => {
    const base = await makeBlankPdf(5);
    const result = await applyBatesNumbering(base, {
      ...defaultBatesOptions(),
      startNumber: 100,
      pageRange: '2-4'
    });
    expect(result.applied).toBe(3);
    expect(result.nextNumber).toBe(103);
    await expect(PDFDocument.load(result.bytes)).resolves.toBeDefined();
  });
});

describe('stamps', () => {
  it('applies every built-in stamp', async () => {
    let bytes = await makeBlankPdf(1);
    for (const spec of Object.values(BUILT_IN_STAMP_SPECS)) {
      bytes = await applyStamp(bytes, spec, {
        pageIndex: 0,
        cx: 300,
        cy: 400,
        rotation: 15,
        opacity: 0.85
      });
    }
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });

  it('rejects out-of-range pages', async () => {
    const base = await makeBlankPdf(1);
    await expect(
      applyStamp(base, BUILT_IN_STAMP_SPECS.approved!, {
        pageIndex: 5,
        cx: 0,
        cy: 0,
        rotation: 0,
        opacity: 1
      })
    ).rejects.toThrow();
  });
});
