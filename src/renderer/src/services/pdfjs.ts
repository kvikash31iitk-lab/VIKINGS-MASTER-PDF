/**
 * PDF.js bootstrap — single configuration point for the rendering engine.
 * The module worker is bundled by Vite via the ?url import.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface LoadedPdf {
  doc: PDFDocumentProxy;
  pageCount: number;
}

export class PasswordRequiredError extends Error {
  constructor(public retry: boolean) {
    super(retry ? 'Incorrect password' : 'Password required');
    this.name = 'PasswordRequiredError';
  }
}

/** Loads a PDF for viewing; throws PasswordRequiredError for encrypted files. */
export async function loadPdf(bytes: Uint8Array, password?: string): Promise<LoadedPdf> {
  // PDF.js transfers (detaches) the buffer to its worker — keep the caller's copy intact.
  const copy = bytes.slice();
  const task = pdfjs.getDocument({
    data: copy,
    ...(password !== undefined ? { password } : {}),
    isEvalSupported: false,
    disableAutoFetch: false,
    useSystemFonts: true
  });
  try {
    const doc = await task.promise;
    return { doc, pageCount: doc.numPages };
  } catch (e) {
    const name = (e as { name?: string }).name;
    if (name === 'PasswordException') {
      const code = (e as { code?: number }).code;
      // 1 = NEED_PASSWORD, 2 = INCORRECT_PASSWORD
      throw new PasswordRequiredError(code === 2);
    }
    throw e;
  }
}

/** Renders one page to a fresh canvas at the given scale (device-pixel aware). */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  scale: number,
  options: { dpr?: number; background?: string; ocConfig?: unknown } = {}
): Promise<HTMLCanvasElement> {
  const dpr = options.dpr ?? Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: scale * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = `${Math.ceil(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.ceil(viewport.height / dpr)}px`;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  await page.render({
    canvasContext: ctx,
    viewport,
    background: options.background ?? '#ffffff',
    ...(options.ocConfig
      ? { optionalContentConfigPromise: Promise.resolve(options.ocConfig) as never }
      : {})
  }).promise;
  return canvas;
}

export interface SimpleTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
}

/** Extracts positioned text items in PDF points (origin bottom-left). */
export async function extractTextItems(page: PDFPageProxy): Promise<SimpleTextItem[]> {
  const content = await page.getTextContent();
  const items: SimpleTextItem[] = [];
  for (const raw of content.items) {
    if (!('str' in raw) || !raw.str) continue;
    const t = raw.transform as number[];
    const fontHeight = Math.hypot(t[2] ?? 0, t[3] ?? 1);
    items.push({
      str: raw.str,
      x: t[4] ?? 0,
      y: t[5] ?? 0,
      width: raw.width ?? 0,
      height: fontHeight,
      ...(raw.fontName ? { fontName: raw.fontName } : {})
    });
  }
  return items;
}

/** Plain text of a page (reading order as emitted by PDF.js). */
export async function extractPageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent();
  let out = '';
  for (const item of content.items) {
    if ('str' in item) {
      out += item.str;
      if ((item as { hasEOL?: boolean }).hasEOL) out += '\n';
      else out += ' ';
    }
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

export { pdfjs };
export type { PDFDocumentProxy, PDFPageProxy };
