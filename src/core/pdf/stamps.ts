/**
 * Stamp engine — built-in gallery (APPROVED, DRAFT, CONFIDENTIAL, FINAL, PAID)
 * and custom designer stamps. Stamps render as vector content (rounded border +
 * uppercase label), placed at a point with rotation and opacity.
 */
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { hexToRgb } from './utils';

export interface StampSpec {
  text: string;
  color: string; // border + text
  fontSize: number;
  borderStyle: 'solid' | 'double' | 'none';
}

export interface StampPlacement {
  pageIndex: number;
  /** Center of the stamp in PDF points (origin bottom-left). */
  cx: number;
  cy: number;
  rotation: number;
  opacity: number;
}

const PAD_X = 14;
const PAD_Y = 8;

export function stampDimensions(spec: StampSpec, textWidth: number): { width: number; height: number } {
  return { width: textWidth + PAD_X * 2, height: spec.fontSize + PAD_Y * 2 };
}

export async function applyStamp(
  bytes: Uint8Array,
  spec: StampSpec,
  placement: StampPlacement
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  if (placement.pageIndex < 0 || placement.pageIndex >= doc.getPageCount()) {
    throw new Error(`Stamp page ${placement.pageIndex} out of range`);
  }
  const page = doc.getPage(placement.pageIndex);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = hexToRgb(spec.color);
  const text = spec.text.toUpperCase();
  const textWidth = font.widthOfTextAtSize(text, spec.fontSize);
  const { width, height } = stampDimensions(spec, textWidth);
  const rotate = degrees(placement.rotation);
  const opacity = placement.opacity;

  // pdf-lib rotates around the rectangle origin (bottom-left), so we compute the
  // origin such that the rectangle center lands on (cx, cy) after rotation.
  const rad = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = width / 2;
  const halfH = height / 2;
  const originX = placement.cx - (halfW * cos - halfH * sin);
  const originY = placement.cy - (halfW * sin + halfH * cos);

  if (spec.borderStyle !== 'none') {
    page.drawRectangle({
      x: originX,
      y: originY,
      width,
      height,
      borderColor: color,
      borderWidth: 2,
      opacity: 0,
      borderOpacity: opacity,
      rotate
    });
    if (spec.borderStyle === 'double') {
      const inset = 3.5;
      const ix = originX + inset * cos - inset * sin;
      const iy = originY + inset * sin + inset * cos;
      page.drawRectangle({
        x: ix,
        y: iy,
        width: width - inset * 2,
        height: height - inset * 2,
        borderColor: color,
        borderWidth: 1,
        opacity: 0,
        borderOpacity: opacity,
        rotate
      });
    }
  }

  // Text baseline offset within the stamp box.
  const tx = PAD_X;
  const ty = PAD_Y + spec.fontSize * 0.18;
  const textX = originX + tx * cos - ty * sin;
  const textY = originY + tx * sin + ty * cos;
  page.drawText(text, {
    x: textX,
    y: textY,
    size: spec.fontSize,
    font,
    color,
    opacity,
    rotate
  });

  return doc.save();
}

export const BUILT_IN_STAMP_SPECS: Record<string, StampSpec> = {
  approved: { text: 'APPROVED', color: '#107c10', fontSize: 22, borderStyle: 'double' },
  draft: { text: 'DRAFT', color: '#605e5c', fontSize: 22, borderStyle: 'solid' },
  confidential: { text: 'CONFIDENTIAL', color: '#d13438', fontSize: 22, borderStyle: 'solid' },
  final: { text: 'FINAL', color: '#2563eb', fontSize: 22, borderStyle: 'double' },
  paid: { text: 'PAID', color: '#107c10', fontSize: 22, borderStyle: 'solid' }
};
