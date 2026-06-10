/**
 * Images → PDF: embeds JPEG/PNG natively via pdf-lib; other formats are
 * transcoded to PNG by the caller (renderer canvas) before reaching here.
 * Each image becomes one page sized to fit the chosen paper (or the image).
 */
import { PDFDocument } from 'pdf-lib';
import { PAGE_SIZES, type PageSize } from '../pdf/page-ops';

export interface ImageInput {
  bytes: Uint8Array;
  format: 'png' | 'jpg';
  name?: string;
}

export interface ImagesToPdfOptions {
  /** 'auto' sizes each page to its image at 72 DPI-equivalent. */
  pageSize?: 'auto' | PageSize;
  margin?: number;
}

export async function imagesToPdf(images: ImageInput[], options: ImagesToPdfOptions = {}): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('No images supplied');
  const doc = await PDFDocument.create();
  doc.setProducer('Vikings Master PDF');
  doc.setCreator('Vikings Master PDF');
  const margin = options.margin ?? 0;

  for (const input of images) {
    const image =
      input.format === 'png' ? await doc.embedPng(input.bytes) : await doc.embedJpg(input.bytes);

    if (!options.pageSize || options.pageSize === 'auto') {
      const page = doc.addPage([image.width + margin * 2, image.height + margin * 2]);
      page.drawImage(image, { x: margin, y: margin, width: image.width, height: image.height });
    } else {
      const size = options.pageSize as PageSize;
      const page = doc.addPage([size.width, size.height]);
      const availW = size.width - margin * 2;
      const availH = size.height - margin * 2;
      const scale = Math.min(availW / image.width, availH / image.height, 1);
      const w = image.width * scale;
      const h = image.height * scale;
      page.drawImage(image, {
        x: (size.width - w) / 2,
        y: (size.height - h) / 2,
        width: w,
        height: h
      });
    }
  }
  return doc.save();
}

export { PAGE_SIZES };
