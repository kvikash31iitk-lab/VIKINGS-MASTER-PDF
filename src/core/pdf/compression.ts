/**
 * PDF compression / optimization:
 *  1. Image downsampling & re-encode (JPEG) through an injected codec — the
 *     renderer supplies a canvas-based codec; tests can supply a stub.
 *  2. Duplicate stream deduplication (SHA-256 over raw bytes + dict shape).
 *  3. Metadata cleanup (Info + XMP).
 *  4. Structure compaction via object streams on save.
 */
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFRawStream, PDFNumber } from 'pdf-lib';

export interface CompressionProfile {
  id: 'web' | 'office' | 'print' | 'custom';
  /** Images above this PPI get downsampled to it (0 = leave dimensions). */
  targetDpi: number;
  jpegQuality: number; // 0..1
  stripMetadata: boolean;
  deduplicate: boolean;
}

export const COMPRESSION_PROFILES: Record<string, CompressionProfile> = {
  web: { id: 'web', targetDpi: 96, jpegQuality: 0.6, stripMetadata: true, deduplicate: true },
  office: { id: 'office', targetDpi: 150, jpegQuality: 0.75, stripMetadata: false, deduplicate: true },
  print: { id: 'print', targetDpi: 300, jpegQuality: 0.9, stripMetadata: false, deduplicate: true }
};

/**
 * Re-encodes a decoded image. Returns null to leave the image untouched.
 * Implemented by the renderer with canvas; by tests with a stub.
 */
export interface ImageCodec {
  reencodeJpeg(
    jpegBytes: Uint8Array,
    opts: { maxWidth: number; maxHeight: number; quality: number }
  ): Promise<{ bytes: Uint8Array; width: number; height: number } | null>;
}

export interface CompressionResult {
  bytes: Uint8Array;
  before: number;
  after: number;
  imagesRecoded: number;
  duplicatesRemoved: number;
}

export interface CompressOptions {
  profile: CompressionProfile;
  codec?: ImageCodec;
  /** Approximate page width in inches used for DPI math (default US Letter 8.5"). */
  pageWidthInches?: number;
  hasher: (bytes: Uint8Array) => Promise<string> | string;
}

export async function compressPdf(bytes: Uint8Array, options: CompressOptions): Promise<CompressionResult> {
  const { profile, codec } = options;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  let imagesRecoded = 0;
  let duplicatesRemoved = 0;

  // ── 1. Image re-encode (JPEG/DCTDecode streams only — the dominant payload
  //       in scanned documents; other filters are preserved untouched).
  if (codec && profile.targetDpi > 0) {
    const pageWidthInches = options.pageWidthInches ?? 8.5;
    const maxPx = Math.max(64, Math.round(profile.targetDpi * pageWidthInches));
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;
      const subtype = dict.lookup(PDFName.of('Subtype'));
      if (!(subtype instanceof PDFName) || subtype.decodeText() !== 'Image') continue;
      if (!isDctStream(dict)) continue;

      const recoded = await codec.reencodeJpeg(obj.getContents(), {
        maxWidth: maxPx,
        maxHeight: maxPx,
        quality: profile.jpegQuality
      });
      if (!recoded || recoded.bytes.length >= obj.getContents().length) continue;

      // Replace stream contents in place.
      const newStream = doc.context.stream(recoded.bytes, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: recoded.width,
        Height: recoded.height,
        ColorSpace: 'DeviceRGB',
        BitsPerComponent: 8,
        Filter: 'DCTDecode'
      });
      // Preserve transparency mask references if present.
      const smask = dict.get(PDFName.of('SMask'));
      if (smask) newStream.dict.set(PDFName.of('SMask'), smask);
      replaceObject(doc, obj, newStream);
      imagesRecoded++;
    }
  }

  // ── 2. Deduplicate identical streams.
  if (profile.deduplicate) {
    duplicatesRemoved = await deduplicateStreams(doc, options.hasher);
  }

  // ── 3. Metadata cleanup.
  if (profile.stripMetadata) {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setCreator('');
    doc.catalog.delete(PDFName.of('Metadata'));
  }
  doc.setProducer('Vikings Master PDF');

  // ── 4. Save with object streams (packs non-stream objects).
  const out = await doc.save({ useObjectStreams: true });
  return {
    bytes: out,
    before: bytes.length,
    after: out.length,
    imagesRecoded,
    duplicatesRemoved
  };
}

function isDctStream(dict: PDFDict): boolean {
  const filter = dict.lookup(PDFName.of('Filter'));
  if (filter instanceof PDFName) return filter.decodeText() === 'DCTDecode';
  if (filter instanceof PDFArray) {
    for (let i = 0; i < filter.size(); i++) {
      const f = filter.lookup(i);
      if (f instanceof PDFName && f.decodeText() === 'DCTDecode') return true;
    }
  }
  return false;
}

/** Swaps every reference to `oldObj`'s ref so it points at the replacement. */
function replaceObject(doc: PDFDocument, oldObj: PDFRawStream, replacement: unknown): void {
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj === oldObj) {
      doc.context.assign(ref, replacement as never);
      return;
    }
  }
}

async function deduplicateStreams(
  doc: PDFDocument,
  hasher: (bytes: Uint8Array) => Promise<string> | string
): Promise<number> {
  const seen = new Map<string, PDFRef>();
  const remap = new Map<string, PDFRef>(); // dupRef.toString() → canonical

  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const contents = obj.getContents();
    if (contents.length < 256) continue; // not worth chasing tiny streams
    const dictKeys = obj.dict
      .entries()
      .map(([k]) => k.toString())
      .sort()
      .join(',');
    const key = `${dictKeys}|${contents.length}|${await hasher(contents)}`;
    const canonical = seen.get(key);
    if (canonical) {
      remap.set(ref.toString(), canonical);
    } else {
      seen.set(key, ref);
    }
  }
  if (remap.size === 0) return 0;

  // Rewrite all references graph-wide.
  const rewriteValue = (value: unknown): unknown => {
    if (value instanceof PDFRef) {
      const target = remap.get(value.toString());
      return target ?? value;
    }
    return value;
  };

  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    rewriteContainer(obj, rewriteValue);
  }
  rewriteContainer(doc.catalog, rewriteValue);
  return remap.size;
}

function rewriteContainer(obj: unknown, rewriteValue: (v: unknown) => unknown): void {
  if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) {
      const next = rewriteValue(value);
      if (next !== value) obj.set(key, next as never);
      else if (value instanceof PDFDict || value instanceof PDFArray) rewriteContainer(value, rewriteValue);
    }
  } else if (obj instanceof PDFArray) {
    for (let i = 0; i < obj.size(); i++) {
      const value = obj.get(i);
      const next = rewriteValue(value);
      if (next !== value) obj.set(i, next as never);
      else if (value instanceof PDFDict || value instanceof PDFArray) rewriteContainer(value, rewriteValue);
    }
  } else if (obj instanceof PDFRawStream) {
    rewriteContainer(obj.dict, rewriteValue);
  }
}

/** Estimates effective image DPI given pixel + placement data (UI reporting). */
export function estimateDpi(imagePixelWidth: number, placedWidthPoints: number): number {
  if (placedWidthPoints <= 0) return 0;
  return Math.round((imagePixelWidth / placedWidthPoints) * 72);
}

export { PDFNumber };
