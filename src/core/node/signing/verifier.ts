/**
 * Signature validation — extracts every signed ByteRange/Contents pair,
 * parses the CMS container, recomputes the document digest, verifies the
 * signer's RSA signature over the authenticated attributes, and reports
 * certificate metadata.
 */
import forge from 'node-forge';
import { bytesToLatin1 } from '../../pdf/utils';
import type { SignatureVerificationResult } from '../../../shared/types';

const OID_TO_HASH: Record<string, 'sha256' | 'sha384' | 'sha512' | 'sha1'> = {
  '2.16.840.1.101.3.4.2.1': 'sha256',
  '2.16.840.1.101.3.4.2.2': 'sha384',
  '2.16.840.1.101.3.4.2.3': 'sha512',
  '1.3.14.3.2.26': 'sha1'
};

interface FoundSignature {
  byteRange: [number, number, number, number];
  contentsHex: string;
  fieldName: string;
}

function findSignatures(text: string): FoundSignature[] {
  const out: FoundSignature[] = [];
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  let m: RegExpExecArray | null;
  let index = 0;
  while ((m = re.exec(text)) !== null) {
    const byteRange: [number, number, number, number] = [
      parseInt(m[1]!, 10),
      parseInt(m[2]!, 10),
      parseInt(m[3]!, 10),
      parseInt(m[4]!, 10)
    ];
    // Contents placeholder spans [byteRange[1], byteRange[2]) — extract the hex.
    const between = text.slice(byteRange[1], byteRange[2]);
    const hexMatch = /^<([0-9a-fA-F]*)>$/.exec(between.trim());
    if (!hexMatch) continue;
    out.push({ byteRange, contentsHex: hexMatch[1]!, fieldName: `Signature ${++index}` });
  }
  return out;
}

export function verifySignatures(pdfBytes: Uint8Array): SignatureVerificationResult[] {
  const text = bytesToLatin1(pdfBytes);
  const found = findSignatures(text);
  const results: SignatureVerificationResult[] = [];

  for (const sig of found) {
    const errors: string[] = [];
    let signerName = 'Unknown';
    let certificateSubject = '';
    let certificateIssuer = '';
    let certificateValidFrom = '';
    let certificateValidTo = '';
    let signedAt: string | undefined;
    let reason: string | undefined;
    let intact = false;

    try {
      const derHex = sig.contentsHex.replace(/(00)+$/, ''); // trim zero padding
      const derBytes = forge.util.hexToBytes(derHex);
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(derBytes));
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData & {
        rawCapture: {
          signature: string;
          authenticatedAttributes?: forge.asn1.Asn1[];
          /** Captured as raw DER bytes of the OID, not an ASN.1 node. */
          digestAlgorithm: string;
        };
      };

      const certs = p7.certificates ?? [];
      const cert = certs[0];
      if (cert) {
        const cn = cert.subject.getField('CN') as { value?: string } | null;
        signerName = cn?.value ?? 'Unknown';
        certificateSubject = cert.subject.attributes
          .map((a) => `${a.shortName ?? a.name}=${String(a.value)}`)
          .join(', ');
        certificateIssuer = cert.issuer.attributes
          .map((a) => `${a.shortName ?? a.name}=${String(a.value)}`)
          .join(', ');
        certificateValidFrom = cert.validity.notBefore.toISOString();
        certificateValidTo = cert.validity.notAfter.toISOString();
        const now = new Date();
        if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
          errors.push('Certificate is outside its validity period');
        }
      } else {
        errors.push('No certificate embedded in signature');
      }

      // Hash algorithm (rawCapture stores the OID as raw DER bytes).
      const digestOid = forge.asn1.derToOid(p7.rawCapture.digestAlgorithm);
      const hashName = OID_TO_HASH[digestOid] ?? 'sha256';

      // 1. Document digest over the signed byte ranges.
      const [s1, l1, s2, l2] = sig.byteRange;
      const part1 = pdfBytes.subarray(s1, s1 + l1);
      const part2 = pdfBytes.subarray(s2, s2 + l2);
      const docMd = forge.md[hashName].create();
      docMd.update(bytesToLatin1(part1));
      docMd.update(bytesToLatin1(part2));
      const docDigest = docMd.digest().getBytes();

      const attrs = p7.rawCapture.authenticatedAttributes;
      if (attrs && cert) {
        // 2. messageDigest attribute must equal the document digest.
        let attrDigest: string | null = null;
        for (const attr of attrs) {
          const seq = attr.value as forge.asn1.Asn1[];
          const oid = forge.asn1.derToOid(seq[0]!.value as string);
          if (oid === forge.pki.oids.messageDigest) {
            const valueSet = seq[1]!.value as forge.asn1.Asn1[];
            attrDigest = valueSet[0]!.value as string;
          }
          if (oid === forge.pki.oids.signingTime) {
            const valueSet = seq[1]!.value as forge.asn1.Asn1[];
            signedAt = String(valueSet[0]!.value);
          }
        }
        const digestMatches = attrDigest === docDigest;
        if (!digestMatches) errors.push('Document has been modified after signing (digest mismatch)');

        // 3. Verify the RSA signature over the DER-encoded attribute SET.
        const attrSet = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
        const attrDer = forge.asn1.toDer(attrSet).getBytes();
        const attrMd = forge.md[hashName].create();
        attrMd.update(attrDer);
        let sigValid = false;
        try {
          sigValid = (cert.publicKey as forge.pki.rsa.PublicKey).verify(
            attrMd.digest().getBytes(),
            p7.rawCapture.signature
          );
        } catch (e) {
          errors.push(`Signature verification failed: ${(e as Error).message}`);
        }
        if (!sigValid) errors.push('Cryptographic signature is invalid');
        intact = digestMatches && sigValid;
      } else if (!attrs) {
        errors.push('Signature has no authenticated attributes (unsupported format)');
      }

      // Reason from the signature dictionary (entries may precede or follow
      // the Contents placeholder depending on serialization order).
      const dictWindow =
        text.slice(Math.max(0, sig.byteRange[1] - 2000), sig.byteRange[1]) +
        text.slice(sig.byteRange[2], Math.min(text.length, sig.byteRange[2] + 2000));
      const reasonMatch = /\/Reason\s*(?:\(([^)]*)\)|<([0-9a-fA-F]+)>)/.exec(dictWindow);
      if (reasonMatch) {
        reason = reasonMatch[1] ?? decodeHexText(reasonMatch[2] ?? '');
      }
    } catch (e) {
      errors.push(`Could not parse signature container: ${(e as Error).message}`);
    }

    results.push({
      fieldName: sig.fieldName,
      signerName,
      ...(signedAt ? { signedAt } : {}),
      ...(reason ? { reason } : {}),
      intact,
      coversWholeDocument: sig.byteRange[2] + sig.byteRange[3] === pdfBytes.length,
      certificateSubject,
      certificateIssuer,
      certificateValidFrom,
      certificateValidTo,
      errors
    });
  }
  return results;
}

function decodeHexText(hex: string): string {
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  // Strip UTF-16BE BOM if present.
  if (out.charCodeAt(0) === 0xfe && out.charCodeAt(1) === 0xff) {
    let s = '';
    for (let i = 2; i + 1 < out.length; i += 2) {
      s += String.fromCharCode((out.charCodeAt(i) << 8) | out.charCodeAt(i + 1));
    }
    return s;
  }
  return out;
}
