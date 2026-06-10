import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { parsePageRanges, luhnCheck, formatBytes, hexToBytes, bytesToHex } from '@core/pdf/utils';
import { reconstructPage, clusterLines, detectTables } from '@core/convert/text-extract';
import type { PositionedTextItem } from '@core/convert/text-extract';
import { rtfToText, textToRtf } from '@core/convert/rtf';
import { textToPdf } from '@core/convert/text-to-pdf';
import { TextIndex, searchAcrossDocuments } from '@core/search/text-index';
import { findPatternMatches, findSearchMatches } from '@core/pdf/redaction';
import { groupWordsIntoLines } from '@core/ocr/searchable-overlay';

describe('utils', () => {
  it('parses page ranges with open ends and de-duplication', () => {
    expect(parsePageRanges('1-3,5,9-', 10)).toEqual([0, 1, 2, 4, 8, 9]);
    expect(parsePageRanges('3,3,3', 10)).toEqual([2]);
    expect(parsePageRanges('-2', 10)).toEqual([0, 1]);
    expect(parsePageRanges('99', 10)).toEqual([]);
    expect(parsePageRanges('', 10)).toEqual([]);
  });

  it('validates Luhn checksums', () => {
    expect(luhnCheck('4539 1488 0343 6467')).toBe(true); // valid test number
    expect(luhnCheck('4539 1488 0343 6468')).toBe(false);
    expect(luhnCheck('1234')).toBe(false);
  });

  it('formats byte sizes and round-trips hex', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    const bytes = new Uint8Array([0, 15, 255, 128]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
  });
});

const item = (str: string, x: number, y: number, w = str.length * 6, h = 12): PositionedTextItem => ({
  str,
  x,
  y,
  width: w,
  height: h
});

describe('text reconstruction', () => {
  it('clusters items into lines with spacing inference', () => {
    const lines = clusterLines([
      item('Hello', 72, 700),
      item('world', 110, 700),
      item('Second line', 72, 680)
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe('Hello world');
    expect(lines[1]!.text).toBe('Second line');
  });

  it('builds paragraphs and detects headings', () => {
    const page = reconstructPage(0, 595, 842, [
      item('Big Heading', 72, 760, 140, 24),
      item('Body text first line that continues', 72, 720),
      item('and wraps to the second line.', 72, 702),
      item('A new paragraph after a gap.', 72, 640)
    ]);
    expect(page.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(page.paragraphs[0]!.isHeading).toBe(true);
    expect(page.paragraphs[1]!.text).toContain('continues and wraps');
  });

  it('detects tab-separated tables', () => {
    const lines = clusterLines([
      item('Name', 72, 700),
      item('Amount', 300, 700),
      item('Widget', 72, 680),
      item('42.50', 300, 680)
    ]);
    const tables = detectTables(lines);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rows[0]).toEqual(['Name', 'Amount']);
    expect(tables[0]!.rows[1]).toEqual(['Widget', '42.50']);
  });
});

describe('rtf', () => {
  it('extracts text from RTF with escapes and skip destinations', () => {
    const rtf =
      '{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}' +
      'Hello \\b bold\\b0  world\\par Second\\tab column\\par \\u8212? dash \\\'e9}';
    const text = rtfToText(rtf);
    expect(text).toContain('Hello bold world');
    expect(text).toContain('Second\tcolumn');
    expect(text).toContain('— dash é');
    expect(text).not.toContain('Arial');
  });

  it('writes RTF that survives a round-trip', () => {
    const original = 'Line one\nLine two with {braces} and \\slash\nUnicode: é—✓';
    const rtf = textToRtf(original);
    const back = rtfToText(rtf);
    expect(back).toContain('Line one');
    expect(back).toContain('{braces}');
    expect(back).toContain('\\slash');
    expect(back).toContain('é—');
  });
});

describe('text-to-pdf', () => {
  it('paginates long text with wrapping', async () => {
    const longText = Array.from({ length: 200 }, (_, i) => `Paragraph ${i}: ` + 'lorem ipsum '.repeat(12)).join('\n');
    const bytes = await textToPdf(longText, { title: 'Long doc' });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(3);
    expect(doc.getTitle()).toBe('Long doc');
  });
});

describe('search index', () => {
  const index = new TextIndex();
  index.setPage(0, 'The quick brown Fox jumps. Email: alice@example.com');
  index.setPage(1, 'A second page mentions fox twice: fox.');

  it('finds case-insensitive literals with snippets', () => {
    const hits = index.search('fox', { caseSensitive: false, wholeWord: false, regex: false });
    expect(hits).toHaveLength(3);
    expect(hits[0]!.pageIndex).toBe(0);
    expect(hits[0]!.snippet).toContain('Fox');
  });

  it('honors case-sensitive and whole-word options', () => {
    expect(index.search('Fox', { caseSensitive: true, wholeWord: false, regex: false })).toHaveLength(1);
    expect(index.search('fo', { caseSensitive: false, wholeWord: true, regex: false })).toHaveLength(0);
  });

  it('supports regex queries and rejects invalid patterns gracefully', () => {
    const hits = index.search('[a-z]+@[a-z.]+', { caseSensitive: false, wholeWord: false, regex: true });
    expect(hits).toHaveLength(1);
    expect(index.search('([', { caseSensitive: false, wholeWord: false, regex: true })).toHaveLength(0);
  });

  it('searches across multiple documents', () => {
    const second = new TextIndex();
    second.setPage(0, 'another fox here');
    const hits = searchAcrossDocuments(
      [
        { docId: 'a', title: 'Doc A', index },
        { docId: 'b', title: 'Doc B', index: second }
      ],
      'fox',
      { caseSensitive: false, wholeWord: true, regex: false }
    );
    expect(hits.filter((h) => h.docId === 'b')).toHaveLength(1);
  });
});

describe('redaction pattern matching', () => {
  const text =
    'Contact alice@example.com or +91 98765 43210. Aadhaar 2345 6789 0123, PAN ABCDE1234F, ' +
    'card 4539 1488 0343 6467 and a fake card 1111 1111 1111 1111.';

  it('finds emails, phones, aadhaar, PAN', () => {
    const ids = findPatternMatches(text, ['email', 'phone', 'aadhaar', 'pan']).map((m) => m.patternId);
    expect(ids).toContain('email');
    expect(ids).toContain('phone');
    expect(ids).toContain('aadhaar');
    expect(ids).toContain('pan');
  });

  it('applies Luhn validation to credit cards', () => {
    const cards = findPatternMatches(text, ['credit-card']);
    expect(cards.some((c) => c.text.includes('4539'))).toBe(true);
    expect(cards.some((c) => c.text.includes('1111 1111 1111 1111'))).toBe(false);
  });

  it('search-based redaction supports whole word and regex', () => {
    expect(findSearchMatches('cat cataract cat', 'cat', { wholeWord: true })).toHaveLength(2);
    expect(findSearchMatches('a1 b2 c3', '[a-z]\\d', { regex: true })).toHaveLength(3);
  });
});

describe('OCR line grouping', () => {
  it('groups words sharing vertical overlap into lines', () => {
    const lines = groupWordsIntoLines([
      { text: 'Hello', x0: 10, y0: 10, x1: 60, y1: 30, confidence: 90 },
      { text: 'world', x0: 70, y0: 12, x1: 120, y1: 32, confidence: 88 },
      { text: 'Below', x0: 10, y0: 50, x1: 60, y1: 70, confidence: 91 },
      { text: 'junk', x0: 0, y0: 0, x1: 5, y1: 5, confidence: 10 } // filtered by confidence
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.text).toBe('Hello world');
  });
});
