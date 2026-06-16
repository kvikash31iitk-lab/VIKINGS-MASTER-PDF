/**
 * Extracts embedded raster images from a PDF page together with their on-page
 * placement, so PDF→Word can put each picture where it belongs while keeping
 * text editable.
 *
 * Approach: walk the page operator list maintaining the current transformation
 * matrix (q/Q/cm), and for each image-paint op record the placed rectangle.
 * The actual pixels are then cropped from a full-page raster render — this
 * sidesteps PDF image colour-spaces, soft masks and decode arrays entirely and
 * yields exactly what the page shows.
 */
import { OPS } from './pdfjs';
import { documentService } from './document-service';
import { pageRenderService } from './page-render-service';
import { canvasToPngBytes } from '../utils';

export interface PlacedImage {
  pngBytes: Uint8Array;
  /** Placement in PDF points (origin bottom-left). */
  xPt: number;
  /** Top edge of the image in PDF points (y-up), used to order against text. */
  topYPt: number;
  widthPt: number;
  heightPt: number;
}

type Matrix = [number, number, number, number, number, number];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  // m1 applied after m2 (PDF cm composition: current = current × cm).
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ];
}

interface PlacedRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Bounding box of the unit square [0,1]² transformed by the matrix. */
function unitSquareBounds(m: Matrix): PlacedRect {
  const pts: Array<[number, number]> = [
    [m[4], m[5]],
    [m[0] + m[4], m[1] + m[5]],
    [m[2] + m[4], m[3] + m[5]],
    [m[0] + m[2] + m[4], m[1] + m[3] + m[5]]
  ];
  const xsArr = pts.map((p) => p[0]);
  const ysArr = pts.map((p) => p[1]);
  return { x0: Math.min(...xsArr), y0: Math.min(...ysArr), x1: Math.max(...xsArr), y1: Math.max(...ysArr) };
}

const IMAGE_OPS = new Set<number>(
  [OPS.paintImageXObject, OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObject].filter(
    (x): x is number => typeof x === 'number'
  )
);

const MIN_IMAGE_PT = 8; // ignore hairline/spacer images

/** Returns the placed rectangles of raster images on a page (PDF points). */
export async function findImageRects(docId: string, pageIndex: number): Promise<PlacedRect[]> {
  const runtime = documentService.runtime(docId);
  if (!runtime) return [];
  const page = await runtime.pdf.getPage(pageIndex + 1);
  const opList = await page.getOperatorList();

  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const rects: PlacedRect[] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]!;
    if (fn === OPS.save) {
      stack.push(ctm);
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      const a = opList.argsArray[i] as number[];
      ctm = multiply(ctm, [a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!]);
    } else if (IMAGE_OPS.has(fn)) {
      const r = unitSquareBounds(ctm);
      if (r.x1 - r.x0 >= MIN_IMAGE_PT && r.y1 - r.y0 >= MIN_IMAGE_PT) rects.push(r);
    }
  }
  return rects;
}

/**
 * Extracts each placed image as a cropped PNG from a rendered page raster.
 * `dpi` controls crop fidelity.
 */
export async function extractPageImages(docId: string, pageIndex: number, dpi = 150): Promise<PlacedImage[]> {
  const rects = await findImageRects(docId, pageIndex);
  if (rects.length === 0) return [];

  const render = await pageRenderService.renderAtDpi(docId, pageIndex, dpi);
  const { canvas, ptWidth, ptHeight } = render;
  const pxPerPt = canvas.width / ptWidth;
  const out: PlacedImage[] = [];

  for (const r of rects) {
    const sx = Math.max(0, Math.floor(r.x0 * pxPerPt));
    const sy = Math.max(0, Math.floor((ptHeight - r.y1) * pxPerPt)); // flip y-up → canvas y-down
    const sw = Math.min(canvas.width - sx, Math.ceil((r.x1 - r.x0) * pxPerPt));
    const sh = Math.min(canvas.height - sy, Math.ceil((r.y1 - r.y0) * pxPerPt));
    if (sw <= 0 || sh <= 0) continue;

    const crop = document.createElement('canvas');
    crop.width = sw;
    crop.height = sh;
    crop.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    out.push({
      pngBytes: await canvasToPngBytes(crop),
      xPt: r.x0,
      topYPt: r.y1,
      widthPt: r.x1 - r.x0,
      heightPt: r.y1 - r.y0
    });
  }
  return out;
}
