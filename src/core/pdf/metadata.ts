/**
 * Document metadata: read/write Info dictionary entries and strip
 * identifying metadata (sanitize pipelines, compression "metadata cleanup").
 */
import { PDFDocument, PDFName } from 'pdf-lib';

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export async function readMetadata(bytes: Uint8Array): Promise<DocumentMetadata> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  return {
    title: doc.getTitle() ?? undefined,
    author: doc.getAuthor() ?? undefined,
    subject: doc.getSubject() ?? undefined,
    keywords: doc.getKeywords() ?? undefined,
    creator: doc.getCreator() ?? undefined,
    producer: doc.getProducer() ?? undefined,
    creationDate: doc.getCreationDate()?.toISOString(),
    modificationDate: doc.getModificationDate()?.toISOString()
  };
}

export async function writeMetadata(bytes: Uint8Array, meta: DocumentMetadata): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  if (meta.title !== undefined) doc.setTitle(meta.title);
  if (meta.author !== undefined) doc.setAuthor(meta.author);
  if (meta.subject !== undefined) doc.setSubject(meta.subject);
  if (meta.keywords !== undefined) doc.setKeywords(meta.keywords.split(/[,;]\s*/).filter(Boolean));
  if (meta.creator !== undefined) doc.setCreator(meta.creator);
  doc.setModificationDate(new Date());
  return doc.save();
}

/** Removes Info entries and the XMP metadata stream. */
export async function stripMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.setTitle('');
  doc.setAuthor('');
  doc.setSubject('');
  doc.setKeywords([]);
  doc.setCreator('');
  doc.setProducer('');
  doc.catalog.delete(PDFName.of('Metadata'));
  return doc.save();
}
