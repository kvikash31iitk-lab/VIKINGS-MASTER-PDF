/**
 * Baseline TIFF encoder (little-endian, uncompressed RGB, single strip per
 * page) with multi-page support via chained IFDs. Input: raw RGBA bitmaps
 * (canvas ImageData layout); alpha is composited against white.
 */

export interface TiffPage {
  width: number;
  height: number;
  rgba: Uint8Array; // width * height * 4
  dpi?: number;
}

const TAG = {
  ImageWidth: 256,
  ImageLength: 257,
  BitsPerSample: 258,
  Compression: 259,
  Photometric: 262,
  StripOffsets: 273,
  SamplesPerPixel: 277,
  RowsPerStrip: 278,
  StripByteCounts: 279,
  XResolution: 282,
  YResolution: 283,
  ResolutionUnit: 296
} as const;

const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  value: number; // inline value or offset
}

export function encodeTiff(pages: TiffPage[]): Uint8Array {
  if (pages.length === 0) throw new Error('No pages to encode');

  // Layout: header (8) → per page: [pixel data][BitsPerSample extra][resolution rationals][IFD]
  const chunks: Uint8Array[] = [];
  let offset = 8;

  const header = new Uint8Array(8);
  const hv = new DataView(header.buffer);
  header[0] = 0x49; // 'II' little-endian
  header[1] = 0x49;
  hv.setUint16(2, 42, true);
  // First IFD offset patched later.
  chunks.push(header);

  interface PagePlan {
    ifdOffset: number;
    nextIfdFieldOffset: number;
  }
  const plans: PagePlan[] = [];

  for (const page of pages) {
    const rgb = rgbaToRgb(page.rgba, page.width, page.height);
    const dpi = page.dpi ?? 150;

    const pixelOffset = offset;
    chunks.push(rgb);
    offset += rgb.length;
    offset = pad(chunks, offset);

    // BitsPerSample [8,8,8] — 3 SHORTs = 6 bytes, must live outside the entry.
    const bpsOffset = offset;
    const bps = new Uint8Array(6);
    const bpsv = new DataView(bps.buffer);
    bpsv.setUint16(0, 8, true);
    bpsv.setUint16(2, 8, true);
    bpsv.setUint16(4, 8, true);
    chunks.push(bps);
    offset += 6;
    offset = pad(chunks, offset);

    // Resolution rationals.
    const resOffset = offset;
    const res = new Uint8Array(16);
    const resv = new DataView(res.buffer);
    resv.setUint32(0, dpi, true);
    resv.setUint32(4, 1, true);
    resv.setUint32(8, dpi, true);
    resv.setUint32(12, 1, true);
    chunks.push(res);
    offset += 16;
    offset = pad(chunks, offset);

    const entries: IfdEntry[] = [
      { tag: TAG.ImageWidth, type: TYPE_LONG, count: 1, value: page.width },
      { tag: TAG.ImageLength, type: TYPE_LONG, count: 1, value: page.height },
      { tag: TAG.BitsPerSample, type: TYPE_SHORT, count: 3, value: bpsOffset },
      { tag: TAG.Compression, type: TYPE_SHORT, count: 1, value: 1 },
      { tag: TAG.Photometric, type: TYPE_SHORT, count: 1, value: 2 },
      { tag: TAG.StripOffsets, type: TYPE_LONG, count: 1, value: pixelOffset },
      { tag: TAG.SamplesPerPixel, type: TYPE_SHORT, count: 1, value: 3 },
      { tag: TAG.RowsPerStrip, type: TYPE_LONG, count: 1, value: page.height },
      { tag: TAG.StripByteCounts, type: TYPE_LONG, count: 1, value: rgb.length },
      { tag: TAG.XResolution, type: TYPE_RATIONAL, count: 1, value: resOffset },
      { tag: TAG.YResolution, type: TYPE_RATIONAL, count: 1, value: resOffset + 8 },
      { tag: TAG.ResolutionUnit, type: TYPE_SHORT, count: 1, value: 2 }
    ].sort((a, b) => a.tag - b.tag);

    const ifdOffset = offset;
    const ifdSize = 2 + entries.length * 12 + 4;
    const ifd = new Uint8Array(ifdSize);
    const iv = new DataView(ifd.buffer);
    iv.setUint16(0, entries.length, true);
    entries.forEach((e, i) => {
      const at = 2 + i * 12;
      iv.setUint16(at, e.tag, true);
      iv.setUint16(at + 2, e.type, true);
      iv.setUint32(at + 4, e.count, true);
      if (e.type === TYPE_SHORT && e.count === 1) {
        iv.setUint16(at + 8, e.value, true);
      } else {
        iv.setUint32(at + 8, e.value, true);
      }
    });
    // next-IFD pointer written during patch phase
    chunks.push(ifd);
    plans.push({ ifdOffset, nextIfdFieldOffset: ifdOffset + 2 + entries.length * 12 });
    offset += ifdSize;
    offset = pad(chunks, offset);
  }

  const total = offset;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }

  const view = new DataView(out.buffer);
  view.setUint32(4, plans[0]!.ifdOffset, true);
  for (let i = 0; i < plans.length; i++) {
    const next = i + 1 < plans.length ? plans[i + 1]!.ifdOffset : 0;
    view.setUint32(plans[i]!.nextIfdFieldOffset, next, true);
  }
  return out;
}

function rgbaToRgb(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height * 3);
  let s = 0;
  let d = 0;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const a = rgba[s + 3]! / 255;
    out[d] = Math.round(rgba[s]! * a + 255 * (1 - a));
    out[d + 1] = Math.round(rgba[s + 1]! * a + 255 * (1 - a));
    out[d + 2] = Math.round(rgba[s + 2]! * a + 255 * (1 - a));
    s += 4;
    d += 3;
  }
  return out;
}

function pad(chunks: Uint8Array[], offset: number): number {
  const rem = offset % 2;
  if (rem) {
    chunks.push(new Uint8Array(1));
    return offset + 1;
  }
  return offset;
}
