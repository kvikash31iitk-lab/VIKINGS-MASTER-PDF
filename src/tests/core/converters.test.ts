import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Packer } from 'docx';
import { PDFDocument } from 'pdf-lib';
import { buildXlsx } from '@core/convert/xlsx-writer';
import { buildPptx } from '@core/convert/pptx-writer';
import { encodeTiff } from '@core/convert/tiff-encoder';
import { buildHtml } from '@core/convert/html-export';
import { buildDocxDocument, buildImageDocx } from '@core/convert/docx-export';
import { imagesToPdf } from '@core/convert/image-to-pdf';
import { reconstructPage } from '@core/convert/text-extract';
import { linesToBlocks } from '@core/convert/text-extract';
import type { TextLine } from '@core/convert/text-extract';
import { buildSrgbIccProfile } from '@core/pdf/icc-profile';
import { TINY_PNG } from '../helpers/sample-pdf';

describe('xlsx writer', () => {
  it('produces a valid OOXML package with inline strings and numbers', async () => {
    const bytes = await buildXlsx([
      { name: 'Report', rows: [['Item', 'Qty'], ['Widget <A>', '42'], ['Total', '42']] },
      { name: 'Sheet/2*bad:name', rows: [['x']] }
    ]);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('[Content_Types].xml')).toBeTruthy();
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toContain('Report');
    const sheet1 = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet1).toContain('Widget &lt;A&gt;');
    expect(sheet1).toContain('<v>42</v>'); // numeric cell
  });
});

describe('pptx writer', () => {
  it('produces a deck with one slide per page image', async () => {
    const bytes = await buildPptx([
      { pngBytes: TINY_PNG, widthPt: 595, heightPt: 842 },
      { pngBytes: TINY_PNG, widthPt: 595, heightPt: 842 }
    ]);
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('ppt/presentation.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide1.xml')).toBeTruthy();
    expect(zip.file('ppt/slides/slide2.xml')).toBeTruthy();
    expect(zip.file('ppt/media/image2.png')).toBeTruthy();
    expect(zip.file('ppt/slideMasters/slideMaster1.xml')).toBeTruthy();
    const pres = await zip.file('ppt/presentation.xml')!.async('string');
    expect(pres).toContain('sldSz');
  });
});

describe('tiff encoder', () => {
  it('encodes single and multi-page baseline TIFF', () => {
    const rgba = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 3] = 255;
    }
    const single = encodeTiff([{ width: 4, height: 4, rgba, dpi: 150 }]);
    expect(single[0]).toBe(0x49); // 'II'
    expect(new DataView(single.buffer).getUint16(2, true)).toBe(42);

    const multi = encodeTiff([
      { width: 4, height: 4, rgba },
      { width: 4, height: 4, rgba }
    ]);
    // First IFD offset → walk to second IFD.
    const view = new DataView(multi.buffer);
    const ifd1 = view.getUint32(4, true);
    const entryCount = view.getUint16(ifd1, true);
    const nextIfd = view.getUint32(ifd1 + 2 + entryCount * 12, true);
    expect(nextIfd).toBeGreaterThan(0);
    const entryCount2 = view.getUint16(nextIfd, true);
    expect(view.getUint32(nextIfd + 2 + entryCount2 * 12, true)).toBe(0); // chain ends
  });
});

describe('html export', () => {
  const page = reconstructPage(0, 595, 842, [
    { str: 'Title Text', x: 72, y: 760, width: 120, height: 22 },
    { str: 'Body <script>alert(1)</script>', x: 72, y: 700, width: 200, height: 12 }
  ]);

  it('layout mode positions spans and escapes content', () => {
    const html = buildHtml([page], { mode: 'layout', title: 'T & Co' });
    expect(html).toContain('class="vk-page"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('T &amp; Co');
    expect(html).not.toContain('<script>alert');
  });

  it('flow mode emits headings and paragraphs', () => {
    const html = buildHtml([page], { mode: 'flow' });
    expect(html).toContain('<h2>Title Text</h2>');
  });
});

describe('docx export', () => {
  it('builds a packable document with headings and tables', async () => {
    const page = reconstructPage(0, 595, 842, [
      { str: 'Heading One', x: 72, y: 760, width: 150, height: 24 },
      { str: 'Normal paragraph text.', x: 72, y: 700, width: 220, height: 12 },
      { str: 'Col1', x: 72, y: 650, width: 30, height: 12 },
      { str: 'Col2', x: 300, y: 650, width: 30, height: 12 },
      { str: 'v1', x: 72, y: 632, width: 20, height: 12 },
      { str: 'v2', x: 300, y: 632, width: 20, height: 12 }
    ]);
    const doc = buildDocxDocument([page], 'Converted');
    const buffer = await Packer.toBuffer(doc);
    expect(buffer.length).toBeGreaterThan(1000);
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('Heading One');
    expect(docXml).toContain('<w:tbl>');
  });

  it('hybrid mode keeps editable text and embeds page images at position', async () => {
    const page = reconstructPage(0, 595, 842, [
      { str: 'Heading One', x: 72, y: 760, width: 150, height: 24 },
      { str: 'Normal paragraph text.', x: 72, y: 700, width: 220, height: 12 }
    ]);
    const doc = buildDocxDocument([page], 'Hybrid', [
      [{ pngBytes: TINY_PNG, topYPt: 730, widthPt: 60, heightPt: 60 }]
    ]);
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('Heading One'); // text preserved
    expect(docXml).toContain('<w:drawing>'); // image embedded
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    expect(media.length).toBeGreaterThanOrEqual(1);
  });

  it('buildImageDocx embeds one full-page picture per page', async () => {
    const doc = buildImageDocx(
      [
        { pngBytes: TINY_PNG, widthPt: 595, heightPt: 842 },
        { pngBytes: TINY_PNG, widthPt: 595, heightPt: 842 }
      ],
      'Scanned'
    );
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    // Images land in the media folder and the document references drawings.
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
    expect(media.length).toBeGreaterThanOrEqual(2);
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('<w:drawing>');
    expect(docXml).not.toContain('<w:tbl>'); // no text/tables in image mode
  });
});

describe('images to pdf', () => {
  it('creates auto-sized and paper-sized pages', async () => {
    const auto = await imagesToPdf([{ bytes: TINY_PNG, format: 'png' }]);
    const doc = await PDFDocument.load(auto);
    expect(doc.getPageCount()).toBe(1);

    const a4 = await imagesToPdf([{ bytes: TINY_PNG, format: 'png' }], {
      pageSize: { width: 595.28, height: 841.89 },
      margin: 24
    });
    const doc2 = await PDFDocument.load(a4);
    expect(doc2.getPage(0).getSize().width).toBeCloseTo(595.28, 0);
  });
});

describe('icc profile', () => {
  it('builds a structurally valid ICC v2 RGB profile', () => {
    const icc = buildSrgbIccProfile();
    const view = new DataView(icc.buffer);
    expect(view.getUint32(0, false)).toBe(icc.length); // declared size matches
    const sig = String.fromCharCode(icc[36]!, icc[37]!, icc[38]!, icc[39]!);
    expect(sig).toBe('acsp');
    const colorSpace = String.fromCharCode(icc[16]!, icc[17]!, icc[18]!, icc[19]!);
    expect(colorSpace).toBe('RGB ');
    const tagCount = view.getUint32(128, false);
    expect(tagCount).toBe(9);
  });
});

describe('linesToBlocks (editable Word/HTML structure)', () => {
  const L = (text: string, y: number, fontSize = 11, x = 40): TextLine => ({
    text,
    x,
    y,
    width: 100,
    fontSize,
    items: []
  });

  it('recovers a key/value table from tab-separated rows (with wrapped cells)', () => {
    const lines: TextLine[] = [
      L('Item\tValue / Detail', 300, 11),
      L('Body\tThe Lok Sabha is the lower', 286, 11),
      L('house of Parliament', 274, 11), // wrapped continuation of the last cell
      L('Term\t5 years', 260, 11)
    ];
    const blocks = linesToBlocks(lines);
    const table = blocks.find((b) => b.kind === 'table');
    expect(table).toBeDefined();
    if (table?.kind === 'table') {
      expect(table.rows[0]).toEqual(['Item', 'Value / Detail']);
      expect(table.rows[1]![0]).toBe('Body');
      expect(table.rows[1]![1]).toContain('lower house of Parliament'); // continuation folded in
      expect(table.rows[2]).toEqual(['Term', '5 years']);
    }
  });

  it('detects headings by relative font size and flows body paragraphs', () => {
    const lines: TextLine[] = [
      L('WHY IN NEWS', 400, 16),
      L('On Tuesday the court set aside an order and', 384, 11),
      L('directed a fresh inquiry into the matter.', 372, 11),
      L('KEY FACTS', 340, 16)
    ];
    const blocks = linesToBlocks(lines);
    expect(blocks[0]).toMatchObject({ kind: 'heading', text: 'WHY IN NEWS' });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph' });
    expect((blocks[1] as { text: string }).text).toContain('fresh inquiry into the matter');
    expect(blocks[2]).toMatchObject({ kind: 'heading', text: 'KEY FACTS' });
  });
});
