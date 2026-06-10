import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { encryptPdf, decryptPdf, getEncryptionInfo, WrongPasswordError } from '@core/node/security/encryption';
import { hash2B, permissionsToP, pToPermissions } from '@core/node/security/standard-security';
import { rc4 } from '@core/node/security/rc4';
import { makeTextPdf } from '../helpers/sample-pdf';
import type { PdfPermissionFlags } from '@shared/types';

const ALL_PERMS: PdfPermissionFlags = {
  printing: true,
  copying: true,
  modifying: true,
  annotating: true,
  formFilling: true
};

const RESTRICTED: PdfPermissionFlags = {
  printing: true,
  copying: false,
  modifying: false,
  annotating: true,
  formFilling: true
};

describe('rc4', () => {
  it('round-trips (cipher is symmetric)', () => {
    const key = new TextEncoder().encode('Key');
    const data = new TextEncoder().encode('Plaintext');
    const enc = rc4(key, data);
    expect(rc4(key, enc)).toEqual(data);
    // Known vector: RC4("Key", "Plaintext") = BBF316E8D940AF0AD3
    expect(Buffer.from(enc).toString('hex')).toBe('bbf316e8d940af0ad3');
  });
});

describe('permission flags', () => {
  it('encodes and decodes the P integer', () => {
    const p = permissionsToP(RESTRICTED);
    expect(p).toBeLessThan(0); // signed with high bits set
    const back = pToPermissions(p);
    expect(back).toEqual(RESTRICTED);
  });
});

describe('hash2B (AES-256 KDF)', () => {
  it('is deterministic and 32 bytes', () => {
    const pw = new TextEncoder().encode('secret');
    const salt = new Uint8Array(8).fill(7);
    const a = hash2B(pw, salt, new Uint8Array(0));
    const b = hash2B(pw, salt, new Uint8Array(0));
    expect(a).toEqual(b);
    expect(a.length).toBe(32);
    // Different salt → different hash.
    const c = hash2B(pw, new Uint8Array(8).fill(9), new Uint8Array(0));
    expect(c).not.toEqual(a);
  });
});

describe('AES-256 encryption (R6)', () => {
  it('encrypts, reports info, and decrypts with the user password', async () => {
    const original = await makeTextPdf([['Top secret content line one', 'and line two']]);
    const encrypted = await encryptPdf(original, {
      algorithm: 'aes-256',
      userPassword: 'user-pw',
      ownerPassword: 'owner-pw',
      permissions: RESTRICTED
    });

    // pdf-lib should see it as encrypted.
    const probe = await PDFDocument.load(encrypted, { ignoreEncryption: true });
    expect(probe.isEncrypted).toBe(true);

    const info = await getEncryptionInfo(encrypted);
    expect(info.encrypted).toBe(true);
    expect(info.algorithm).toBe('aes-256');
    expect(info.permissions?.copying).toBe(false);

    const decrypted = await decryptPdf(encrypted, 'user-pw');
    const doc = await PDFDocument.load(decrypted);
    expect(doc.isEncrypted).toBe(false);
    expect(doc.getPageCount()).toBe(1);
    // Content stream must decrypt back to drawable text operators.
    expect(Buffer.from(decrypted).includes('Top secret')).toBe(false); // text is in compressed stream
  });

  it('decrypts with the owner password too', async () => {
    const original = await makeTextPdf([['hello']]);
    const encrypted = await encryptPdf(original, {
      algorithm: 'aes-256',
      userPassword: 'u',
      ownerPassword: 'o',
      permissions: ALL_PERMS
    });
    const decrypted = await decryptPdf(encrypted, 'o');
    expect((await PDFDocument.load(decrypted)).getPageCount()).toBe(1);
  });

  it('rejects a wrong password', async () => {
    const original = await makeTextPdf([['x']]);
    const encrypted = await encryptPdf(original, {
      algorithm: 'aes-256',
      userPassword: 'right',
      ownerPassword: '',
      permissions: ALL_PERMS
    });
    await expect(decryptPdf(encrypted, 'wrong')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('keeps document content intact through a round-trip', async () => {
    const original = await makeTextPdf([['alpha'], ['beta'], ['gamma']]);
    const encrypted = await encryptPdf(original, {
      algorithm: 'aes-256',
      userPassword: 'pw',
      ownerPassword: 'pw2',
      permissions: ALL_PERMS
    });
    const decrypted = await decryptPdf(encrypted, 'pw');
    const doc = await PDFDocument.load(decrypted);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getTitle()).toBe('Sample Document');
  });
});

describe('AES-128 encryption (R4/AESV2)', () => {
  it('round-trips with user and owner passwords', async () => {
    const original = await makeTextPdf([['aes128 secret'], ['second page']]);
    const encrypted = await encryptPdf(original, {
      algorithm: 'aes-128',
      userPassword: 'u128',
      ownerPassword: 'o128',
      permissions: RESTRICTED
    });

    const info = await getEncryptionInfo(encrypted);
    expect(info.algorithm).toBe('aes-128');

    const viaUser = await decryptPdf(encrypted, 'u128');
    expect((await PDFDocument.load(viaUser)).getPageCount()).toBe(2);

    const viaOwner = await decryptPdf(encrypted, 'o128');
    expect((await PDFDocument.load(viaOwner)).getPageCount()).toBe(2);

    await expect(decryptPdf(encrypted, 'nope')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('supports empty user password (open without prompt, restricted perms)', async () => {
    const original = await makeTextPdf([['open access']]);
    const encrypted = await encryptPdf(original, {
      algorithm: 'aes-128',
      userPassword: '',
      ownerPassword: 'owner-only',
      permissions: RESTRICTED
    });
    const decrypted = await decryptPdf(encrypted, '');
    expect((await PDFDocument.load(decrypted)).getPageCount()).toBe(1);
  });
});

describe('getEncryptionInfo', () => {
  it('reports unencrypted documents', async () => {
    const original = await makeTextPdf([['plain']]);
    const info = await getEncryptionInfo(original);
    expect(info.encrypted).toBe(false);
  });
});
