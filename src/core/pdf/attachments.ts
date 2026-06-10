/**
 * Attachment engine — embedded files (ISO 32000 §7.11.4).
 * Add via pdf-lib's attach(); list/extract/remove via the EmbeddedFiles name tree.
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFString,
  PDFHexString,
  PDFRawStream,
  decodePDFRawStream
} from 'pdf-lib';

export interface AttachmentInfo {
  name: string;
  description?: string;
  mimeType?: string;
  size: number;
}

export async function addAttachment(
  bytes: Uint8Array,
  fileBytes: Uint8Array,
  fileName: string,
  options?: { mimeType?: string; description?: string }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  await doc.attach(fileBytes, fileName, {
    mimeType: options?.mimeType ?? 'application/octet-stream',
    description: options?.description ?? '',
    creationDate: new Date(),
    modificationDate: new Date()
  });
  return doc.save();
}

interface RawAttachment {
  name: string;
  filespec: PDFDict;
}

function readNameTree(doc: PDFDocument): RawAttachment[] {
  const out: RawAttachment[] = [];
  const namesDict = doc.catalog.lookup(PDFName.of('Names'));
  if (!(namesDict instanceof PDFDict)) return out;
  const embedded = namesDict.lookup(PDFName.of('EmbeddedFiles'));
  if (!(embedded instanceof PDFDict)) return out;

  const visit = (node: PDFDict): void => {
    const names = node.lookup(PDFName.of('Names'));
    if (names instanceof PDFArray) {
      for (let i = 0; i + 1 < names.size(); i += 2) {
        const key = names.lookup(i);
        const spec = names.lookup(i + 1);
        const name =
          key instanceof PDFHexString || key instanceof PDFString ? key.decodeText() : `attachment-${i / 2}`;
        if (spec instanceof PDFDict) out.push({ name, filespec: spec });
      }
    }
    const kids = node.lookup(PDFName.of('Kids'));
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) {
        const kid = kids.lookup(i);
        if (kid instanceof PDFDict) visit(kid);
      }
    }
  };
  visit(embedded);
  return out;
}

function getEmbeddedStream(doc: PDFDocument, filespec: PDFDict): PDFRawStream | undefined {
  const ef = filespec.lookup(PDFName.of('EF'));
  if (!(ef instanceof PDFDict)) return undefined;
  const f = ef.get(PDFName.of('F')) ?? ef.get(PDFName.of('UF'));
  const stream = f instanceof PDFRef ? doc.context.lookup(f) : f;
  return stream instanceof PDFRawStream ? stream : undefined;
}

export async function listAttachments(bytes: Uint8Array): Promise<AttachmentInfo[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return readNameTree(doc).map(({ name, filespec }) => {
    const stream = getEmbeddedStream(doc, filespec);
    const desc = filespec.lookup(PDFName.of('Desc'));
    let mimeType: string | undefined;
    let size = 0;
    if (stream) {
      const subtype = stream.dict.lookup(PDFName.of('Subtype'));
      if (subtype instanceof PDFName) mimeType = subtype.decodeText().replace('#2f', '/');
      size = stream.getContents().length;
      const params = stream.dict.lookup(PDFName.of('Params'));
      if (params instanceof PDFDict) {
        const sz = params.lookup(PDFName.of('Size'));
        if (sz && 'asNumber' in sz && typeof (sz as { asNumber?: () => number }).asNumber === 'function') {
          size = (sz as { asNumber: () => number }).asNumber();
        }
      }
    }
    return {
      name,
      ...(desc instanceof PDFHexString || desc instanceof PDFString ? { description: desc.decodeText() } : {}),
      ...(mimeType ? { mimeType } : {}),
      size
    };
  });
}

export async function extractAttachment(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const entry = readNameTree(doc).find((a) => a.name === name);
  if (!entry) throw new Error(`Attachment "${name}" not found`);
  const stream = getEmbeddedStream(doc, entry.filespec);
  if (!stream) throw new Error(`Attachment "${name}" has no embedded data`);
  try {
    return decodePDFRawStream(stream).decode();
  } catch {
    return stream.getContents();
  }
}

export async function removeAttachment(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const namesDict = doc.catalog.lookup(PDFName.of('Names'));
  if (!(namesDict instanceof PDFDict)) return doc.save();
  const embedded = namesDict.lookup(PDFName.of('EmbeddedFiles'));
  if (!(embedded instanceof PDFDict)) return doc.save();

  const removeFrom = (node: PDFDict): boolean => {
    const names = node.lookup(PDFName.of('Names'));
    if (names instanceof PDFArray) {
      for (let i = 0; i + 1 < names.size(); i += 2) {
        const key = names.lookup(i);
        const text = key instanceof PDFHexString || key instanceof PDFString ? key.decodeText() : '';
        if (text === name) {
          names.remove(i + 1);
          names.remove(i);
          return true;
        }
      }
    }
    const kids = node.lookup(PDFName.of('Kids'));
    if (kids instanceof PDFArray) {
      for (let i = 0; i < kids.size(); i++) {
        const kid = kids.lookup(i);
        if (kid instanceof PDFDict && removeFrom(kid)) return true;
      }
    }
    return false;
  };
  removeFrom(embedded);
  return doc.save();
}
