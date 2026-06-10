/**
 * Cryptographic primitives for the PDF Standard Security Handler,
 * built on node:crypto. Node-only (main process / workers / tests).
 */
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const md5 = (data: Uint8Array): Uint8Array => new Uint8Array(createHash('md5').update(data).digest());
export const sha256 = (data: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha256').update(data).digest());
export const sha384 = (data: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha384').update(data).digest());
export const sha512 = (data: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha512').update(data).digest());

export const random = (n: number): Uint8Array => new Uint8Array(randomBytes(n));

export function aesCbcEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array, autopad: boolean): Uint8Array {
  const alg = key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc';
  const cipher = createCipheriv(alg, key, iv);
  cipher.setAutoPadding(autopad);
  return new Uint8Array(Buffer.concat([cipher.update(data), cipher.final()]));
}

export function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array, autopad: boolean): Uint8Array {
  const alg = key.length === 32 ? 'aes-256-cbc' : 'aes-128-cbc';
  const decipher = createDecipheriv(alg, key, iv);
  decipher.setAutoPadding(autopad);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

export function aesEcbEncryptBlock(key: Uint8Array, block16: Uint8Array): Uint8Array {
  const cipher = createCipheriv('aes-256-ecb', key, null);
  cipher.setAutoPadding(false);
  return new Uint8Array(Buffer.concat([cipher.update(block16), cipher.final()]));
}

export function aesEcbDecryptBlock(key: Uint8Array, block16: Uint8Array): Uint8Array {
  const decipher = createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(false);
  return new Uint8Array(Buffer.concat([decipher.update(block16), decipher.final()]));
}

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
