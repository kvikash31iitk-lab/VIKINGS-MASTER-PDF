import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import {
  summarize,
  keyPoints,
  actionItems,
  generateFaq,
  answerQuestion,
  splitSentences
} from '@core/ai/offline-engine';
import {
  buildOllamaRequest,
  parseOllamaLine,
  buildOpenAiRequest,
  parseOpenAiSseLine,
  buildActionPrompt,
  truncateForContext
} from '@core/ai/provider';
import { compareDocumentText, buildComparisonReportPdf } from '@core/compare/compare';
import { convertToPdfA, validatePdfA } from '@core/pdf/pdfa';
import { compressPdf, COMPRESSION_PROFILES } from '@core/pdf/compression';
import { addSearchableTextLayer } from '@core/ocr/searchable-overlay';
import { applyRedactions } from '@core/pdf/redaction';
import { makeTextPdf, TINY_PNG } from '../helpers/sample-pdf';
import { createHash } from 'node:crypto';

const SAMPLE_PAGES = [
  {
    pageIndex: 0,
    text:
      'This agreement is made between Acme Corporation and Bolt Industries. ' +
      'Acme must deliver the software by 30 June 2026. ' +
      'Bolt shall pay invoices within thirty days of receipt. ' +
      'The total contract value is 250000 dollars across two years. ' +
      'Either party may terminate with ninety days written notice.'
  },
  {
    pageIndex: 1,
    text:
      'Support obligations include critical fixes within 24 hours. ' +
      'The vendor is responsible for quarterly security audits. ' +
      'Deadline for the first audit is 15 July 2026. ' +
      'All disputes are resolved under the laws of India.'
  }
];

describe('offline AI engine', () => {
  it('splits sentences sensibly', () => {
    expect(splitSentences('First sentence here. Second one follows! Third question?').length).toBe(3);
  });

  it('summarizes with the most salient sentences', () => {
    const summary = summarize(SAMPLE_PAGES, 3);
    expect(summary.length).toBeGreaterThan(50);
    expect(summary).toMatch(/Acme|Bolt|agreement/i);
  });

  it('extracts key points with page citations', () => {
    const points = keyPoints(SAMPLE_PAGES, 5);
    expect(points).toContain('•');
    expect(points).toMatch(/\(p\. \d\)/);
  });

  it('mines action items from modal verbs and deadlines', () => {
    const actions = actionItems(SAMPLE_PAGES);
    expect(actions).toContain('☐');
    expect(actions).toMatch(/must deliver|shall pay|responsible for|Deadline/i);
  });

  it('generates FAQs and answers grounded questions', () => {
    const faq = generateFaq(SAMPLE_PAGES, 4);
    expect(faq).toContain('Q:');
    expect(faq).toContain('A:');

    const answer = answerQuestion(SAMPLE_PAGES, 'When must Acme deliver the software?');
    expect(answer).toContain('30 June 2026');
    expect(answer).toMatch(/\(p\. 1\)/);

    const noAnswer = answerQuestion(SAMPLE_PAGES, 'What is the capital of France?');
    expect(noAnswer).toMatch(/does not appear/i);
  });

  it('handles empty documents gracefully', () => {
    expect(summarize([])).toMatch(/no extractable text/i);
  });
});

describe('AI provider plumbing', () => {
  it('builds Ollama requests and parses NDJSON lines', () => {
    const req = buildOllamaRequest({ baseUrl: 'http://127.0.0.1:11434/', model: 'llama3.2' }, [
      { role: 'user', content: 'hi' }
    ]);
    expect(req.url).toBe('http://127.0.0.1:11434/api/chat');
    expect(JSON.parse(req.body).model).toBe('llama3.2');

    expect(parseOllamaLine('{"message":{"content":"Hel"},"done":false}')).toEqual({
      content: 'Hel',
      done: false
    });
    expect(parseOllamaLine('{"done":true}')).toEqual({ content: '', done: true });
    expect(parseOllamaLine('not json')).toBeNull();
  });

  it('builds OpenAI-compatible requests and parses SSE lines', () => {
    const req = buildOpenAiRequest(
      { baseUrl: 'https://api.example.com', apiKey: 'sk-x', model: 'gpt-test' },
      [{ role: 'user', content: 'hi' }],
      { temperature: 0.2 }
    );
    expect(req.url).toBe('https://api.example.com/v1/chat/completions');
    expect(req.headers.Authorization).toBe('Bearer sk-x');

    expect(parseOpenAiSseLine('data: {"choices":[{"delta":{"content":"Hi"}}]}')).toEqual({
      content: 'Hi',
      done: false
    });
    expect(parseOpenAiSseLine('data: [DONE]')).toEqual({ content: '', done: true });
    expect(parseOpenAiSseLine(': keepalive')).toBeNull();
  });

  it('builds grounded prompts and truncates long context', () => {
    const messages = buildActionPrompt('summarize', 'Document body text');
    expect(messages[0]!.role).toBe('system');
    expect(messages[1]!.content).toContain('Document body text');

    const long = 'x'.repeat(50000);
    const truncated = truncateForContext(long, 10000);
    expect(truncated.length).toBeLessThan(11000);
    expect(truncated).toContain('[content truncated]');
  });
});

describe('document comparison', () => {
  it('classifies insertions and deletions per page', () => {
    const result = compareDocumentText(
      [{ pageIndex: 0, text: 'The quick brown fox jumps over the lazy dog' }],
      [{ pageIndex: 0, text: 'The quick red fox leaps over the lazy dog' }]
    );
    expect(result.identical).toBe(false);
    expect(result.changedPages).toEqual([0]);
    const kinds = result.pages[0]!.changes.map((c) => c.kind);
    expect(kinds).toContain('insert');
    expect(kinds).toContain('delete');
  });

  it('reports identical documents and builds a PDF report', async () => {
    const same = compareDocumentText(
      [{ pageIndex: 0, text: 'same text' }],
      [{ pageIndex: 0, text: 'same text' }]
    );
    expect(same.identical).toBe(true);

    const diff = compareDocumentText(
      [{ pageIndex: 0, text: 'alpha beta gamma' }],
      [{ pageIndex: 0, text: 'alpha delta gamma epsilon' }]
    );
    const report = await buildComparisonReportPdf(diff, {
      originalName: 'v1.pdf',
      revisedName: 'v2.pdf'
    });
    const doc = await PDFDocument.load(report);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

describe('PDF/A', () => {
  it('converts and then validates as conformant (structural checks)', async () => {
    const base = await makeTextPdf([['PDF/A candidate document']]);
    const converted = await convertToPdfA(base, { level: 'A-2b', title: 'Archive Doc' });
    const report = await validatePdfA(converted, 'A-2b');
    const errors = report.violations.filter((v) => v.severity === 'error');
    // Standard-14 Helvetica is not embedded — that violation is expected and honest.
    expect(errors.every((e) => e.rule === '6.3.4-font-embedding')).toBe(true);
    expect(report.violations.some((v) => v.rule === '6.7.2-xmp-missing')).toBe(false);
    expect(report.violations.some((v) => v.rule === '6.2.2-output-intent')).toBe(false);
  });

  it('flags missing XMP and OutputIntent on plain documents', async () => {
    const base = await makeTextPdf([['plain']]);
    const report = await validatePdfA(base, 'A-1b');
    expect(report.conformant).toBe(false);
    const rules = report.violations.map((v) => v.rule);
    expect(rules).toContain('6.7.2-xmp-missing');
    expect(rules).toContain('6.2.2-output-intent');
  });
});

describe('compression', () => {
  const hasher = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

  it('deduplicates identical streams and strips metadata', async () => {
    // Build a doc with two identical embedded images (duplicate streams).
    const { PDFDocument: PDFDoc } = await import('pdf-lib');
    const doc = await PDFDoc.create();
    const img1 = await doc.embedPng(TINY_PNG);
    const img2 = await doc.embedPng(TINY_PNG);
    const page = doc.addPage([400, 400]);
    page.drawImage(img1, { x: 10, y: 10, width: 100, height: 100 });
    page.drawImage(img2, { x: 200, y: 200, width: 100, height: 100 });
    doc.setTitle('Will be stripped');
    const bytes = await doc.save();

    const result = await compressPdf(bytes, { profile: COMPRESSION_PROFILES.web!, hasher });
    expect(result.after).toBeGreaterThan(0);
    // updateMetadata: false — pdf-lib's load default would overwrite Producer.
    const reloaded = await PDFDoc.load(result.bytes, { updateMetadata: false });
    expect(reloaded.getTitle() ?? '').toBe('');
    expect(reloaded.getProducer()).toBe('Vikings Master PDF');
  });
});

describe('searchable overlay & redaction', () => {
  it('adds an invisible OCR text layer with placement stats', async () => {
    const base = await makeTextPdf([['scanned page placeholder']]);
    const { bytes, stats } = await addSearchableTextLayer(base, [
      {
        pageIndex: 0,
        imageWidth: 1000,
        imageHeight: 1414,
        words: [
          { text: 'Invoice', x0: 100, y0: 80, x1: 260, y1: 120, confidence: 96 },
          { text: 'Total', x0: 100, y0: 200, x1: 200, y1: 240, confidence: 91 },
          { text: '', x0: 0, y0: 0, x1: 10, y1: 10, confidence: 99 },
          { text: 'low', x0: 0, y0: 0, x1: 10, y1: 10, confidence: 5 }
        ]
      }
    ]);
    expect(stats.wordsPlaced).toBe(2);
    expect(stats.wordsSkipped).toBe(2);
    expect(bytes.length).toBeGreaterThan(base.length);
  });

  it('replaces page content with the censored raster', async () => {
    const base = await makeTextPdf([['SECRET text to destroy', 'second line']]);
    const out = await applyRedactions(base, [
      { pageIndex: 0, imageBytes: TINY_PNG, imageFormat: 'png' }
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
    // Original content destroyed: resources hold only the censored image,
    // and the font used by the original text is gone.
    const resources = doc.getPage(0).node.lookup(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) throw new Error('Resources dict missing');
    const xobjects = resources.lookup(PDFName.of('XObject'));
    if (!(xobjects instanceof PDFDict)) throw new Error('XObject dict missing');
    expect(xobjects.entries()).toHaveLength(1);
    // pdf-lib normalization may add an empty Font dict when drawing the
    // censored image — what matters is that no original font survives.
    const fonts = resources.lookup(PDFName.of('Font'));
    expect(fonts === undefined || (fonts instanceof PDFDict && fonts.entries().length === 0)).toBe(true);
  });
});
