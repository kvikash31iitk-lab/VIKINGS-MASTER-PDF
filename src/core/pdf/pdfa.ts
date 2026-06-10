/**
 * PDF/A support — conversion toward PDF/A-1b / A-2b / A-3b and a structural
 * validator producing a rule-by-rule report.
 *
 * Conversion performs the automatable transformations: XMP pdfaid metadata,
 * sRGB OutputIntent, document ID, removal of encryption / JavaScript / Launch
 * actions / AA triggers, and annotation flag normalization. Non-embedded fonts
 * cannot be fixed without the original font files — the validator reports them.
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFHexString,
  PDFString,
  PDFNumber,
  PDFRawStream
} from 'pdf-lib';
import { buildSrgbIccProfile } from './icc-profile';
import { escapeXml } from './utils';

export type PdfALevel = 'A-1b' | 'A-2b' | 'A-3b';

export interface PdfAViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  location?: string;
}

export interface PdfAValidationReport {
  level: PdfALevel;
  conformant: boolean;
  violations: PdfAViolation[];
  checkedAt: string;
}

const LEVEL_PARTS: Record<PdfALevel, { part: number; conformance: string }> = {
  'A-1b': { part: 1, conformance: 'B' },
  'A-2b': { part: 2, conformance: 'B' },
  'A-3b': { part: 3, conformance: 'B' }
};

function buildXmp(level: PdfALevel, title: string, producer: string): string {
  const { part, conformance } = LEVEL_PARTS[level];
  const now = new Date().toISOString();
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdfaid:part>${part}</pdfaid:part>
   <pdfaid:conformance>${conformance}</pdfaid:conformance>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
   <xmp:CreateDate>${now}</xmp:CreateDate>
   <xmp:ModifyDate>${now}</xmp:ModifyDate>
   <pdf:Producer>${escapeXml(producer)}</pdf:Producer>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function convertToPdfA(
  bytes: Uint8Array,
  options: { level: PdfALevel; title?: string }
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const context = doc.context;

  // 1. Strip security + active content.
  context.trailerInfo.Encrypt = undefined;
  doc.catalog.delete(PDFName.of('AA'));
  doc.catalog.delete(PDFName.of('OpenAction'));
  const namesDict = doc.catalog.lookup(PDFName.of('Names'));
  if (namesDict instanceof PDFDict) {
    namesDict.delete(PDFName.of('JavaScript'));
    if (options.level !== 'A-3b') namesDict.delete(PDFName.of('EmbeddedFiles'));
  }
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of('AA'));
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (annots instanceof PDFArray) {
      for (let i = annots.size() - 1; i >= 0; i--) {
        const annot = annots.lookup(i);
        if (!(annot instanceof PDFDict)) continue;
        annot.delete(PDFName.of('AA'));
        const action = annot.lookup(PDFName.of('A'));
        if (action instanceof PDFDict) {
          const s = action.lookup(PDFName.of('S'));
          if (s instanceof PDFName && ['Launch', 'JavaScript', 'Sound', 'Movie'].includes(s.decodeText())) {
            annot.delete(PDFName.of('A'));
          }
        }
        // PDF/A: Print flag set, Hidden/Invisible/NoView clear.
        const f = annot.lookup(PDFName.of('F'));
        const flags = f instanceof PDFNumber ? f.asNumber() : 0;
        annot.set(PDFName.of('F'), PDFNumber.of((flags | 4) & ~(1 | 2 | 32)));
      }
    }
  }

  // 2. XMP metadata (uncompressed, as required).
  const title = options.title ?? doc.getTitle() ?? 'Untitled';
  const xmp = buildXmp(options.level, title, 'Vikings Master PDF');
  const xmpStream = context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' });
  doc.catalog.set(PDFName.of('Metadata'), context.register(xmpStream));

  // 3. sRGB OutputIntent.
  const icc = buildSrgbIccProfile();
  const iccStream = context.flateStream(icc, { N: 3 });
  const iccRef = context.register(iccStream);
  const intent = context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFA1',
    OutputConditionIdentifier: PDFString.of('sRGB'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    RegistryName: PDFString.of('http://www.color.org'),
    DestOutputProfile: iccRef
  });
  doc.catalog.set(PDFName.of('OutputIntents'), context.obj([intent]));

  // 4. Document ID must exist and be stable.
  ensureDocumentId(doc);

  doc.setProducer('Vikings Master PDF');
  doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: false });
}

function ensureDocumentId(doc: PDFDocument): void {
  const existing = doc.context.trailerInfo.ID;
  if (existing instanceof PDFArray && existing.size() === 2) return;
  const rand = (): PDFHexString => {
    let hex = '';
    for (let i = 0; i < 16; i++) hex += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    return PDFHexString.of(hex.toUpperCase());
  };
  doc.context.trailerInfo.ID = doc.context.obj([rand(), rand()]);
}

// ───────────────────────────── Validator ─────────────────────────────

export async function validatePdfA(bytes: Uint8Array, level: PdfALevel): Promise<PdfAValidationReport> {
  const violations: PdfAViolation[] = [];
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });

  // 6.1 File structure: encryption forbidden.
  if (doc.isEncrypted || doc.context.trailerInfo.Encrypt) {
    violations.push({
      rule: '6.1.3-encryption',
      severity: 'error',
      message: 'Document is encrypted; PDF/A forbids encryption.'
    });
  }

  // 6.7 Metadata: XMP with pdfaid identification.
  const metadataRaw = doc.catalog.get(PDFName.of('Metadata'));
  const metadata = metadataRaw instanceof PDFRef ? doc.context.lookup(metadataRaw) : metadataRaw;
  if (!(metadata instanceof PDFRawStream)) {
    violations.push({
      rule: '6.7.2-xmp-missing',
      severity: 'error',
      message: 'Catalog has no XMP Metadata stream.'
    });
  } else {
    const xmpText = streamToText(metadata);
    const { part } = LEVEL_PARTS[level];
    if (!new RegExp(`<pdfaid:part>\\s*${part}\\s*</pdfaid:part>`).test(xmpText)) {
      violations.push({
        rule: '6.7.11-pdfaid-part',
        severity: 'error',
        message: `XMP pdfaid:part does not declare part ${part}.`
      });
    }
    const filter = metadata.dict.get(PDFName.of('Filter'));
    if (filter) {
      violations.push({
        rule: '6.7.2-xmp-filtered',
        severity: 'error',
        message: 'XMP Metadata stream must not be compressed (Filter present).'
      });
    }
  }

  // 6.2 Output intent.
  const intents = doc.catalog.lookup(PDFName.of('OutputIntents'));
  let hasProfile = false;
  if (intents instanceof PDFArray) {
    for (let i = 0; i < intents.size(); i++) {
      const intent = intents.lookup(i);
      if (intent instanceof PDFDict && intent.get(PDFName.of('DestOutputProfile'))) hasProfile = true;
    }
  }
  if (!hasProfile) {
    violations.push({
      rule: '6.2.2-output-intent',
      severity: 'error',
      message: 'No OutputIntent with DestOutputProfile (device-independent color undefined).'
    });
  }

  // 6.3 Fonts: every used font must be embedded.
  checkFonts(doc, violations);

  // 6.6 Actions: JavaScript / Launch forbidden.
  const names = doc.catalog.lookup(PDFName.of('Names'));
  if (names instanceof PDFDict && names.get(PDFName.of('JavaScript'))) {
    violations.push({
      rule: '6.6.1-javascript',
      severity: 'error',
      message: 'Document-level JavaScript name tree present.'
    });
  }
  if (level !== 'A-3b' && names instanceof PDFDict && names.get(PDFName.of('EmbeddedFiles'))) {
    violations.push({
      rule: '6.8-embedded-files',
      severity: 'error',
      message: 'Embedded files are only allowed in PDF/A-3.'
    });
  }

  for (let p = 0; p < doc.getPageCount(); p++) {
    const page = doc.getPage(p);
    if (page.node.get(PDFName.of('AA'))) {
      violations.push({
        rule: '6.6.2-page-aa',
        severity: 'error',
        message: 'Page has additional-actions (/AA) dictionary.',
        location: `page ${p + 1}`
      });
    }
    const annots = page.node.lookup(PDFName.of('Annots'));
    if (annots instanceof PDFArray) {
      for (let i = 0; i < annots.size(); i++) {
        const annot = annots.lookup(i);
        if (!(annot instanceof PDFDict)) continue;
        const action = annot.lookup(PDFName.of('A'));
        if (action instanceof PDFDict) {
          const s = action.lookup(PDFName.of('S'));
          if (s instanceof PDFName && ['Launch', 'JavaScript'].includes(s.decodeText())) {
            violations.push({
              rule: '6.6.1-forbidden-action',
              severity: 'error',
              message: `Annotation uses forbidden ${s.decodeText()} action.`,
              location: `page ${p + 1}`
            });
          }
        }
        const f = annot.lookup(PDFName.of('F'));
        const flags = f instanceof PDFNumber ? f.asNumber() : 0;
        if ((flags & 4) === 0) {
          violations.push({
            rule: '6.5.3-annot-flags',
            severity: 'warning',
            message: 'Annotation Print flag not set.',
            location: `page ${p + 1}`
          });
        }
      }
    }
  }

  return {
    level,
    conformant: violations.filter((v) => v.severity === 'error').length === 0,
    violations,
    checkedAt: new Date().toISOString()
  };
}

function checkFonts(doc: PDFDocument, violations: PdfAViolation[]): void {
  const seen = new Set<string>();
  for (let p = 0; p < doc.getPageCount(); p++) {
    const page = doc.getPage(p);
    const resources = page.node.lookup(PDFName.of('Resources'));
    if (!(resources instanceof PDFDict)) continue;
    const fonts = resources.lookup(PDFName.of('Font'));
    if (!(fonts instanceof PDFDict)) continue;
    for (const [, fontRefOrDict] of fonts.entries()) {
      const font = fontRefOrDict instanceof PDFRef ? doc.context.lookup(fontRefOrDict) : fontRefOrDict;
      if (!(font instanceof PDFDict)) continue;
      const baseFontObj = font.lookup(PDFName.of('BaseFont'));
      const baseFont = baseFontObj instanceof PDFName ? baseFontObj.decodeText() : 'unknown';
      if (seen.has(baseFont)) continue;
      seen.add(baseFont);
      if (!isFontEmbedded(doc, font)) {
        violations.push({
          rule: '6.3.4-font-embedding',
          severity: 'error',
          message: `Font "${baseFont}" is not embedded.`,
          location: `page ${p + 1}`
        });
      }
    }
  }
}

function isFontEmbedded(doc: PDFDocument, font: PDFDict): boolean {
  const subtypeObj = font.lookup(PDFName.of('Subtype'));
  const subtype = subtypeObj instanceof PDFName ? subtypeObj.decodeText() : '';
  if (subtype === 'Type0') {
    const descendants = font.lookup(PDFName.of('DescendantFonts'));
    if (descendants instanceof PDFArray && descendants.size() > 0) {
      const desc = descendants.lookup(0);
      if (desc instanceof PDFDict) return isFontEmbedded(doc, desc);
    }
    return false;
  }
  if (subtype === 'Type3') return true; // glyph procedures are inherently embedded
  const fd = font.lookup(PDFName.of('FontDescriptor'));
  if (!(fd instanceof PDFDict)) return false;
  return (
    !!fd.get(PDFName.of('FontFile')) || !!fd.get(PDFName.of('FontFile2')) || !!fd.get(PDFName.of('FontFile3'))
  );
}

function streamToText(stream: PDFRawStream): string {
  const contents = stream.getContents();
  let s = '';
  for (let i = 0; i < contents.length; i++) s += String.fromCharCode(contents[i]!);
  return s;
}
