/**
 * Watermark engine — text & image watermarks with opacity, rotation, scale,
 * 9-zone or tiled placement, page ranges, behind/above content.
 */
import { PDFDocument, StandardFonts, degrees, PDFName, PDFArray, PDFRef } from 'pdf-lib';
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { hexToRgb, resolvePageSelection } from './utils';

export type WatermarkZone =
  | 'top-left' | 'top-center' | 'top-right'
  | 'middle-left' | 'center' | 'middle-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface TextWatermarkOptions {
  kind: 'text';
  text: string;
  fontSize: number;
  color: string;
  opacity: number; // 0..1
  rotation: number; // degrees, counter-clockwise
  zone: WatermarkZone;
  tiled: boolean;
  behindContent: boolean;
  pageRange?: string;
  font?: 'Helvetica' | 'TimesRoman' | 'Courier';
  bold?: boolean;
}

export interface ImageWatermarkOptions {
  kind: 'image';
  imageBytes: Uint8Array;
  imageFormat: 'png' | 'jpg';
  scale: number; // 1 = natural size
  opacity: number;
  rotation: number;
  zone: WatermarkZone;
  tiled: boolean;
  behindContent: boolean;
  pageRange?: string;
}

export type WatermarkOptions = TextWatermarkOptions | ImageWatermarkOptions;

const MARGIN = 36;

function zonePosition(
  zone: WatermarkZone,
  pageW: number,
  pageH: number,
  itemW: number,
  itemH: number
): { x: number; y: number } {
  const xs: Record<string, number> = {
    left: MARGIN,
    center: (pageW - itemW) / 2,
    right: pageW - itemW - MARGIN
  };
  const ys: Record<string, number> = {
    top: pageH - itemH - MARGIN,
    middle: (pageH - itemH) / 2,
    bottom: MARGIN
  };
  const [v, h] = zone === 'center' ? ['middle', 'center'] : (zone.split('-') as [string, string]);
  return { x: xs[h] ?? xs.center!, y: ys[v] ?? ys.middle! };
}

/**
 * pdf-lib appends drawing operators, which places marks ABOVE existing content.
 * For "behind content" we draw normally, then move the freshly appended content
 * stream to the front of the page's Contents array (graphics state stays balanced
 * because pdf-lib wraps original content in q/Q when it first draws on a page).
 */
function moveLastContentStreamToFront(page: PDFPage): void {
  const context = page.doc.context;
  const contentsRaw = page.node.get(PDFName.of('Contents'));
  let arr: PDFArray | undefined;
  if (contentsRaw instanceof PDFRef) {
    const resolved = context.lookup(contentsRaw);
    if (resolved instanceof PDFArray) arr = resolved;
  } else if (contentsRaw instanceof PDFArray) {
    arr = contentsRaw;
  }
  if (!arr || arr.size() < 2) return;
  const last = arr.get(arr.size() - 1);
  arr.remove(arr.size() - 1);
  arr.insert(0, last);
}

export async function applyWatermark(bytes: Uint8Array, options: WatermarkOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const indices = resolvePageSelection(options.pageRange, doc.getPageCount());

  let font: PDFFont | null = null;
  let image: PDFImage | null = null;

  if (options.kind === 'text') {
    const name =
      options.font === 'TimesRoman'
        ? options.bold
          ? StandardFonts.TimesRomanBold
          : StandardFonts.TimesRoman
        : options.font === 'Courier'
          ? options.bold
            ? StandardFonts.CourierBold
            : StandardFonts.Courier
          : options.bold
            ? StandardFonts.HelveticaBold
            : StandardFonts.Helvetica;
    font = await doc.embedFont(name);
  } else {
    image =
      options.imageFormat === 'png'
        ? await doc.embedPng(options.imageBytes)
        : await doc.embedJpg(options.imageBytes);
  }

  for (const i of indices) {
    const page = doc.getPage(i);
    drawOnPage(page, options, font, image);
    if (options.behindContent) moveLastContentStreamToFront(page);
  }
  return doc.save();
}

function drawOnPage(
  page: PDFPage,
  options: WatermarkOptions,
  font: PDFFont | null,
  image: PDFImage | null
): void {
  const { width: pageW, height: pageH } = page.getSize();

  let itemW: number;
  let itemH: number;
  if (options.kind === 'text') {
    itemW = font!.widthOfTextAtSize(options.text, options.fontSize);
    itemH = font!.heightAtSize(options.fontSize);
  } else {
    itemW = image!.width * options.scale;
    itemH = image!.height * options.scale;
  }

  const positions: Array<{ x: number; y: number }> = [];
  if (options.tiled) {
    const stepX = itemW + 96;
    const stepY = itemH + 96;
    for (let y = -itemH; y < pageH + itemH; y += stepY) {
      for (let x = -itemW; x < pageW + itemW; x += stepX) {
        positions.push({ x, y });
      }
    }
  } else {
    positions.push(zonePosition(options.zone, pageW, pageH, itemW, itemH));
  }

  for (const pos of positions) {
    if (options.kind === 'text') {
      page.drawText(options.text, {
        x: pos.x,
        y: pos.y,
        size: options.fontSize,
        font: font!,
        color: hexToRgb(options.color),
        opacity: options.opacity,
        rotate: degrees(options.rotation)
      });
    } else {
      page.drawImage(image!, {
        x: pos.x,
        y: pos.y,
        width: itemW,
        height: itemH,
        opacity: options.opacity,
        rotate: degrees(options.rotation)
      });
    }
  }
}
