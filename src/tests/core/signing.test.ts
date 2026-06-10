import { describe, it, expect, beforeAll } from 'vitest';
import forge from 'node-forge';
import { signPdf } from '@core/node/signing/signer';
import { verifySignatures } from '@core/node/signing/verifier';
import { makeTextPdf } from '../helpers/sample-pdf';

let p12Bytes: Uint8Array;

beforeAll(() => {
  // Self-signed test certificate (RSA-2048).
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400000);
  const attrs = [
    { name: 'commonName', value: 'Vikings QA Signer' },
    { name: 'organizationName', value: 'Vikings Technologies' },
    { shortName: 'C', value: 'IN' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'test-pass', {
    algorithm: '3des'
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  p12Bytes = Uint8Array.from(der, (c) => c.charCodeAt(0));
}, 60000);

describe('digital signatures', () => {
  it('signs a document and validation reports it intact', async () => {
    const original = await makeTextPdf([['Agreement', 'Party A agrees with Party B.']]);
    const signed = await signPdf({
      bytes: original,
      p12: p12Bytes,
      passphrase: 'test-pass',
      reason: 'Approval',
      location: 'Mumbai'
    });

    expect(signed.length).toBeGreaterThan(original.length);
    const results = verifySignatures(signed);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.intact).toBe(true);
    expect(r.coversWholeDocument).toBe(true);
    expect(r.signerName).toBe('Vikings QA Signer');
    expect(r.certificateSubject).toContain('Vikings QA Signer');
    expect(r.reason).toBe('Approval');
    expect(r.errors).toEqual([]);
  }, 60000);

  it('detects tampering after signing', async () => {
    const original = await makeTextPdf([['Original text']]);
    const signed = await signPdf({ bytes: original, p12: p12Bytes, passphrase: 'test-pass' });

    // Flip a byte inside the first (signed) region, away from the header.
    const tampered = signed.slice();
    tampered[200] = tampered[200]! ^ 0xff;

    const results = verifySignatures(tampered);
    expect(results).toHaveLength(1);
    expect(results[0]!.intact).toBe(false);
    expect(results[0]!.errors.join(' ')).toMatch(/modified|invalid/i);
  }, 60000);

  it('supports a visible signature with image and label', async () => {
    const original = await makeTextPdf([['Sign below']]);
    const { TINY_PNG } = await import('../helpers/sample-pdf');
    const signed = await signPdf({
      bytes: original,
      p12: p12Bytes,
      passphrase: 'test-pass',
      visible: {
        pageIndex: 0,
        rect: { x: 100, y: 100, width: 180, height: 60 },
        imagePng: TINY_PNG,
        label: 'Digitally signed by Vikings QA'
      }
    });
    const results = verifySignatures(signed);
    expect(results[0]!.intact).toBe(true);
  }, 60000);

  it('rejects a wrong PKCS#12 passphrase', async () => {
    const original = await makeTextPdf([['x']]);
    await expect(
      signPdf({ bytes: original, p12: p12Bytes, passphrase: 'wrong' })
    ).rejects.toThrow();
  }, 60000);
});
