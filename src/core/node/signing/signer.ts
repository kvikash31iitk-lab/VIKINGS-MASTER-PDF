/**
 * Cryptographic PDF signing — PKCS#7 detached (adbe.pkcs7.detached) with
 * PKCS#12 certificates via node-forge.
 *
 * Mechanics: a signature field with a zero-filled /Contents placeholder and a
 * sentinel /ByteRange is written through pdf-lib; after serialization the
 * actual byte offsets are patched in, the digest is computed over everything
 * outside the placeholder, and the CMS SignedData container is injected.
 */
import forge from 'node-forge';
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFHexString,
  PDFNumber,
  PDFString,
  StandardFonts,
  type PDFObject
} from 'pdf-lib';
import { bytesToLatin1, latin1ToBytes, toPdfDate } from '../../pdf/utils';
import type { SignRequest } from '../../../shared/types';

const SIG_CONTENTS_BYTES = 8192; // DER capacity (hex length = 2×)
const BYTERANGE_SENTINEL = 9999999999;

export interface ParsedP12 {
  privateKey: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
  chain: forge.pki.Certificate[];
}

export function parseP12(p12Bytes: Uint8Array, passphrase: string): ParsedP12 {
  const der = forge.util.createBuffer(bytesToLatin1(p12Bytes));
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);

  let privateKey: forge.pki.rsa.PrivateKey | null = null;
  const certs: forge.pki.Certificate[] = [];

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) {
        if (safeBag.key) privateKey = safeBag.key as forge.pki.rsa.PrivateKey;
      } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certs.push(safeBag.cert);
      }
    }
  }
  if (!privateKey) throw new Error('No private key found in the PKCS#12 container');
  if (certs.length === 0) throw new Error('No certificate found in the PKCS#12 container');

  // Pick the end-entity cert: the one whose public key matches the private key.
  const signerCert =
    certs.find((c) => {
      const pub = c.publicKey as forge.pki.rsa.PublicKey;
      return pub.n.compareTo(privateKey!.n) === 0;
    }) ?? certs[0]!;

  return { privateKey, certificate: signerCert, chain: certs };
}

export async function signPdf(request: SignRequest): Promise<Uint8Array> {
  const { privateKey, certificate, chain } = parseP12(request.p12, request.passphrase);
  const withPlaceholder = await addSignaturePlaceholder(request);
  return injectSignature(withPlaceholder, privateKey, certificate, chain);
}

async function addSignaturePlaceholder(request: SignRequest): Promise<Uint8Array> {
  const doc = await PDFDocument.load(request.bytes, { updateMetadata: false });
  const context = doc.context;

  const sigDict = context.obj({}) as PDFDict;
  sigDict.set(PDFName.of('Type'), PDFName.of('Sig'));
  sigDict.set(PDFName.of('Filter'), PDFName.of('Adobe.PPKLite'));
  sigDict.set(PDFName.of('SubFilter'), PDFName.of('adbe.pkcs7.detached'));
  sigDict.set(PDFName.of('Contents'), PDFHexString.of('0'.repeat(SIG_CONTENTS_BYTES * 2)));
  sigDict.set(
    PDFName.of('ByteRange'),
    context.obj([0, BYTERANGE_SENTINEL, BYTERANGE_SENTINEL, BYTERANGE_SENTINEL])
  );
  sigDict.set(PDFName.of('M'), PDFString.of(toPdfDate()));
  if (request.reason) sigDict.set(PDFName.of('Reason'), PDFHexString.fromText(request.reason));
  if (request.location) sigDict.set(PDFName.of('Location'), PDFHexString.fromText(request.location));
  if (request.contactInfo) sigDict.set(PDFName.of('ContactInfo'), PDFHexString.fromText(request.contactInfo));
  const sigDictRef = context.register(sigDict);

  // Widget annotation.
  const pageIndex = Math.min(request.visible?.pageIndex ?? 0, doc.getPageCount() - 1);
  const page = doc.getPage(pageIndex);
  const rect = request.visible?.rect ?? { x: 0, y: 0, width: 0, height: 0 };

  const widget = context.obj({}) as PDFDict;
  widget.set(PDFName.of('Type'), PDFName.of('Annot'));
  widget.set(PDFName.of('Subtype'), PDFName.of('Widget'));
  widget.set(PDFName.of('FT'), PDFName.of('Sig'));
  widget.set(
    PDFName.of('Rect'),
    context.obj([rect.x, rect.y, rect.x + rect.width, rect.y + rect.height])
  );
  widget.set(PDFName.of('T'), PDFHexString.fromText(`Signature-${Date.now()}`));
  widget.set(PDFName.of('F'), PDFNumber.of(132)); // print + locked
  widget.set(PDFName.of('V'), sigDictRef);
  widget.set(PDFName.of('P'), page.ref);

  // Visible appearance (image and/or label).
  if (request.visible && rect.width > 0 && rect.height > 0) {
    const apRef = await buildSignatureAppearance(doc, request, rect.width, rect.height);
    widget.set(PDFName.of('AP'), context.obj({ N: apRef }));
  }
  const widgetRef = context.register(widget);

  const annotsRaw = page.node.lookup(PDFName.of('Annots'));
  if (annotsRaw instanceof PDFArray) annotsRaw.push(widgetRef);
  else page.node.set(PDFName.of('Annots'), context.obj([widgetRef]));

  // AcroForm wiring.
  let acroFormDict: PDFDict;
  const acroFormRaw = doc.catalog.lookup(PDFName.of('AcroForm'));
  if (acroFormRaw instanceof PDFDict) {
    acroFormDict = acroFormRaw;
  } else {
    acroFormDict = context.obj({}) as PDFDict;
    doc.catalog.set(PDFName.of('AcroForm'), context.register(acroFormDict));
  }
  const fieldsRaw = acroFormDict.lookup(PDFName.of('Fields'));
  if (fieldsRaw instanceof PDFArray) fieldsRaw.push(widgetRef);
  else acroFormDict.set(PDFName.of('Fields'), context.obj([widgetRef]));
  acroFormDict.set(PDFName.of('SigFlags'), PDFNumber.of(3));

  return doc.save({ useObjectStreams: false });
}

async function buildSignatureAppearance(
  doc: PDFDocument,
  request: SignRequest,
  width: number,
  height: number
): Promise<ReturnType<typeof doc.context.register>> {
  const context = doc.context;
  const resources: Record<string, PDFObject> = {};
  let ops = '';

  if (request.visible?.imagePng) {
    const image = await doc.embedPng(request.visible.imagePng);
    resources.XObject = context.obj({ SigImg: image.ref });
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    const ox = (width - w) / 2;
    const oy = (height - h) / 2;
    ops += `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${ox.toFixed(2)} ${oy.toFixed(2)} cm /SigImg Do Q\n`;
  }
  if (request.visible?.label) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    resources.Font = context.obj({ Helv: font.ref });
    const size = Math.min(9, height / 4);
    const safe = request.visible.label.replace(/[\\()]/g, '');
    ops += `BT /Helv ${size.toFixed(1)} Tf 0.2 0.2 0.2 rg 2 ${(2).toFixed(1)} Td (${safe}) Tj ET\n`;
  }

  const stream = context.stream(ops, {
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: context.obj(resources)
  });
  return context.register(stream);
}

function injectSignature(
  pdfBytes: Uint8Array,
  privateKey: forge.pki.rsa.PrivateKey,
  certificate: forge.pki.Certificate,
  chain: forge.pki.Certificate[]
): Uint8Array {
  const text = bytesToLatin1(pdfBytes);

  // Locate the zero-filled Contents placeholder.
  const placeholder = '0'.repeat(SIG_CONTENTS_BYTES * 2);
  const contentsStart = text.indexOf(`<${placeholder}>`);
  if (contentsStart === -1) throw new Error('Signature placeholder not found after serialization');
  const contentsEnd = contentsStart + placeholder.length + 2; // includes < >

  // Locate the sentinel ByteRange belonging to this signature.
  const brRegex = new RegExp(
    `/ByteRange\\s*\\[\\s*0\\s+${BYTERANGE_SENTINEL}\\s+${BYTERANGE_SENTINEL}\\s+${BYTERANGE_SENTINEL}\\s*\\]`
  );
  const brMatch = brRegex.exec(text);
  if (!brMatch) throw new Error('ByteRange sentinel not found after serialization');

  const range = [0, contentsStart, contentsEnd, pdfBytes.length - contentsEnd];
  let brActual = `/ByteRange [${range.join(' ')}]`;
  if (brActual.length > brMatch[0].length) throw new Error('ByteRange overflow');
  brActual = brActual.padEnd(brMatch[0].length, ' ');

  const patched =
    text.slice(0, brMatch.index) + brActual + text.slice(brMatch.index + brMatch[0].length);
  const patchedBytes = latin1ToBytes(patched);

  // Digest everything outside the Contents hex (delimiters excluded from doc bytes).
  const signedPortion = new Uint8Array(range[1]! + range[3]!);
  signedPortion.set(patchedBytes.subarray(0, range[1]!), 0);
  signedPortion.set(patchedBytes.subarray(range[2]!), range[1]!);

  // CMS SignedData (detached) with authenticated attributes.
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(bytesToLatin1(signedPortion));
  for (const cert of chain) p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256!,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType!, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest! }, // value auto-computed
      { type: forge.pki.oids.signingTime!, value: new Date().toISOString() as unknown as string }
    ]
  });
  p7.sign({ detached: true });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  if (der.length > SIG_CONTENTS_BYTES) {
    throw new Error(`Signature container too large (${der.length} > ${SIG_CONTENTS_BYTES})`);
  }
  let hex = '';
  for (let i = 0; i < der.length; i++) hex += der.charCodeAt(i).toString(16).padStart(2, '0');
  hex = hex.padEnd(SIG_CONTENTS_BYTES * 2, '0');

  const final =
    patched.slice(0, contentsStart) + `<${hex}>` + patched.slice(contentsEnd);
  return latin1ToBytes(final);
}
