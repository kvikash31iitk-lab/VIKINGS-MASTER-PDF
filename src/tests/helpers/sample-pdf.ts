/** Shared test fixtures: generates sample PDFs in-memory. */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function makeTextPdf(pages: string[][], size: [number, number] = [595, 842]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage(size);
    let y = size[1] - 72;
    for (const line of lines) {
      page.drawText(line, { x: 72, y, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    }
  }
  doc.setTitle('Sample Document');
  doc.setAuthor('Vikings QA');
  return doc.save();
}

export async function makeBlankPdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([595, 842]);
  return doc.save();
}

/** 1×1 red pixel PNG. */
export const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  ),
  (c) => c.charCodeAt(0)
);
