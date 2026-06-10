import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef } from 'pdf-lib';
import {
  addAnnotations,
  deleteAnnotationsByName,
  updateAnnotationContents,
  addReply,
  setReviewState,
  removeAllAnnotations
} from '@core/pdf/annotation-writer';
import { makeTextPdf } from '../helpers/sample-pdf';

async function countAnnots(bytes: Uint8Array, pageIndex = 0): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPage(pageIndex).node.lookup(PDFName.of('Annots'));
  return annots instanceof PDFArray ? annots.size() : 0;
}

async function findSubtypes(bytes: Uint8Array, pageIndex = 0): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPage(pageIndex).node.lookup(PDFName.of('Annots'));
  const out: string[] = [];
  if (annots instanceof PDFArray) {
    for (let i = 0; i < annots.size(); i++) {
      const refOrDict = annots.get(i);
      const dict = refOrDict instanceof PDFRef ? doc.context.lookup(refOrDict) : refOrDict;
      if (dict instanceof PDFDict) {
        const st = dict.lookup(PDFName.of('Subtype'));
        if (st instanceof PDFName) out.push(st.decodeText());
      }
    }
  }
  return out;
}

const QUAD = { x1: 72, y1: 720, x2: 200, y2: 720, x3: 72, y3: 704, x4: 200, y4: 704 };

describe('annotation-writer', () => {
  it('writes every annotation kind with appearance streams', async () => {
    const base = await makeTextPdf([['The quick brown fox jumps over the lazy dog']]);
    const out = await addAnnotations(base, [
      { kind: 'highlight', id: 'a1', pageIndex: 0, color: '#ffe066', opacity: 0.45, quads: [QUAD], author: 'QA' },
      { kind: 'underline', id: 'a2', pageIndex: 0, color: '#2563eb', opacity: 1, quads: [QUAD] },
      { kind: 'strikeout', id: 'a3', pageIndex: 0, color: '#d13438', opacity: 1, quads: [QUAD] },
      { kind: 'squiggly', id: 'a4', pageIndex: 0, color: '#107c10', opacity: 1, quads: [QUAD] },
      { kind: 'note', id: 'a5', pageIndex: 0, color: '#eab308', opacity: 1, x: 300, y: 700, contents: 'A note', author: 'QA' },
      { kind: 'ink', id: 'a6', pageIndex: 0, color: '#111111', opacity: 1, strokeWidth: 2, paths: [[100, 100, 150, 150, 200, 120]] },
      { kind: 'marker', id: 'a7', pageIndex: 0, color: '#ffcc00', opacity: 0.4, strokeWidth: 10, paths: [[100, 300, 250, 300]] },
      { kind: 'rect', id: 'a8', pageIndex: 0, color: '#2563eb', opacity: 1, strokeWidth: 2, rect: { x: 80, y: 400, width: 120, height: 60 } },
      { kind: 'ellipse', id: 'a9', pageIndex: 0, color: '#8961d6', opacity: 1, strokeWidth: 2, rect: { x: 250, y: 400, width: 100, height: 50 }, fillColor: '#f1e8ff' },
      { kind: 'line', id: 'a10', pageIndex: 0, color: '#000000', opacity: 1, strokeWidth: 1.5, x1: 80, y1: 250, x2: 300, y2: 280 },
      { kind: 'arrow', id: 'a11', pageIndex: 0, color: '#d13438', opacity: 1, strokeWidth: 2, x1: 320, y1: 250, x2: 450, y2: 300 },
      { kind: 'cloud', id: 'a12', pageIndex: 0, color: '#2563eb', opacity: 1, strokeWidth: 1.5, vertices: [{ x: 100, y: 560 }, { x: 220, y: 560 }, { x: 220, y: 640 }, { x: 100, y: 640 }] },
      { kind: 'textbox', id: 'a13', pageIndex: 0, color: '#111111', opacity: 1, rect: { x: 320, y: 540, width: 180, height: 70 }, lines: ['Review this', 'paragraph'], fontSize: 11 },
      { kind: 'callout', id: 'a14', pageIndex: 0, color: '#d97706', opacity: 1, rect: { x: 350, y: 430, width: 150, height: 50 }, lines: ['Look here'], fontSize: 10, calloutTarget: { x: 300, y: 410 } },
      { kind: 'link', id: 'a15', pageIndex: 0, color: '#2563eb', opacity: 1, rect: { x: 72, y: 700, width: 130, height: 16 }, url: 'https://example.com' }
    ]);

    expect(await countAnnots(out)).toBe(15);
    const subtypes = await findSubtypes(out);
    expect(subtypes).toContain('Highlight');
    expect(subtypes).toContain('Squiggly');
    expect(subtypes).toContain('Ink');
    expect(subtypes).toContain('Polygon');
    expect(subtypes).toContain('FreeText');
    expect(subtypes).toContain('Link');
  });

  it('deletes annotations by NM (and their replies)', async () => {
    const base = await makeTextPdf([['text']]);
    let out = await addAnnotations(base, [
      { kind: 'note', id: 'parent-1', pageIndex: 0, color: '#eab308', opacity: 1, x: 100, y: 700, contents: 'parent' }
    ]);
    out = await addReply(out, 'parent-1', { id: 'reply-1', author: 'Bob', contents: 'A reply' });
    expect(await countAnnots(out)).toBe(2);
    out = await deleteAnnotationsByName(out, ['parent-1']);
    expect(await countAnnots(out)).toBe(0);
  });

  it('updates contents and review state', async () => {
    const base = await makeTextPdf([['text']]);
    let out = await addAnnotations(base, [
      { kind: 'note', id: 'n1', pageIndex: 0, color: '#eab308', opacity: 1, x: 100, y: 700, contents: 'before' }
    ]);
    out = await updateAnnotationContents(out, 'n1', 'after');
    out = await setReviewState(out, 'n1', 'Completed', 'Reviewer', 'state-1');
    expect(await countAnnots(out)).toBe(2); // note + state reply
  });

  it('removes all annotations for sanitize pipelines', async () => {
    const base = await makeTextPdf([['text']]);
    let out = await addAnnotations(base, [
      { kind: 'note', id: 'x', pageIndex: 0, color: '#eab308', opacity: 1, x: 10, y: 10 }
    ]);
    out = await removeAllAnnotations(out);
    expect(await countAnnots(out)).toBe(0);
  });
});
