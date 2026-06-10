/**
 * Page raster service — renders pages to bitmaps for export, OCR and
 * redaction at controlled DPI, independent of the on-screen viewer.
 */
import { renderPageToCanvas } from './pdfjs';
import { documentService } from './document-service';
import { canvasToPngBytes, canvasToJpegBytes } from '../utils';

export interface PageRender {
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
  ptWidth: number;
  ptHeight: number;
}

export const pageRenderService = {
  /** Renders one page at the requested DPI (72 pt = 1 inch). */
  async renderAtDpi(docId: string, pageIndex: number, dpi: number): Promise<PageRender> {
    const runtime = documentService.runtime(docId);
    if (!runtime) throw new Error('Document is not open');
    const page = await runtime.pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = dpi / 72;
    const canvas = await renderPageToCanvas(page, scale, { dpr: 1 });
    return {
      canvas,
      widthPx: canvas.width,
      heightPx: canvas.height,
      ptWidth: viewport.width,
      ptHeight: viewport.height
    };
  },

  async renderPng(docId: string, pageIndex: number, dpi: number): Promise<Uint8Array> {
    const { canvas } = await this.renderAtDpi(docId, pageIndex, dpi);
    return canvasToPngBytes(canvas);
  },

  async renderJpeg(docId: string, pageIndex: number, dpi: number, quality = 0.85): Promise<Uint8Array> {
    const { canvas } = await this.renderAtDpi(docId, pageIndex, dpi);
    return canvasToJpegBytes(canvas, quality);
  },

  /** Raw RGBA pixels (for the TIFF encoder). */
  async renderRgba(
    docId: string,
    pageIndex: number,
    dpi: number
  ): Promise<{ rgba: Uint8Array; width: number; height: number }> {
    const { canvas } = await this.renderAtDpi(docId, pageIndex, dpi);
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { rgba: new Uint8Array(data.data.buffer), width: canvas.width, height: canvas.height };
  },

  /**
   * Renders a page with rectangular regions blacked out — the censored
   * bitmap consumed by the redaction engine. Regions are viewer-space
   * (PDF points, y-down from page top).
   */
  async renderCensored(
    docId: string,
    pageIndex: number,
    dpi: number,
    regions: Array<{ x: number; y: number; w: number; h: number }>
  ): Promise<{ png: Uint8Array; jpegFallback?: Uint8Array }> {
    const { canvas, ptWidth } = await this.renderAtDpi(docId, pageIndex, dpi);
    const ctx = canvas.getContext('2d')!;
    const pxPerPt = canvas.width / ptWidth;
    ctx.fillStyle = '#000000';
    for (const r of regions) {
      // Slight bleed so anti-aliased glyph edges cannot survive.
      ctx.fillRect(
        Math.floor(r.x * pxPerPt) - 1,
        Math.floor(r.y * pxPerPt) - 1,
        Math.ceil(r.w * pxPerPt) + 2,
        Math.ceil(r.h * pxPerPt) + 2
      );
    }
    return { png: await canvasToPngBytes(canvas) };
  }
};
