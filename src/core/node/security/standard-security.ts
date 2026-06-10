/**
 * PDF Standard Security Handler — key computation algorithms.
 *
 * Implements (ISO 32000-1 §7.6.3 and ISO 32000-2 §7.6.4):
 *  - R4 / V4  AES-128 (AESV2): Algorithms 2, 3, 4/5 (MD5 + RC4 based)
 *  - R6 / V5  AES-256 (AESV3): Algorithm 2.A/2.B hardened SHA-2 KDF,
 *    /U /UE /O /OE /Perms computation and verification.
 */
import { concatBytes, latin1ToBytes } from '../../pdf/utils';
import { rc4 } from './rc4';
import {
  md5,
  sha256,
  sha384,
  sha512,
  random,
  aesCbcEncrypt,
  aesCbcDecrypt,
  aesEcbEncryptBlock,
  aesEcbDecryptBlock,
  timingSafeEqualBytes
} from './crypt-primitives';
import type { PdfPermissionFlags } from '../../../shared/types';

export const PAD = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a
]);

/** Computes the /P permission integer (signed 32-bit, reserved bits set). */
export function permissionsToP(perms: PdfPermissionFlags): number {
  // Bits 7-8 and 13-32 must be 1; bits 1-2 must be 0 → base 0xFFFFF0C0.
  let p = 0xfffff0c0;
  if (perms.printing) p |= 1 << 2; // bit 3
  if (perms.modifying) p |= 1 << 3; // bit 4
  if (perms.copying) p |= 1 << 4; // bit 5
  if (perms.annotating) p |= 1 << 5; // bit 6
  if (perms.formFilling) p |= 1 << 8; // bit 9
  p |= 1 << 9; // bit 10: accessibility extraction always allowed
  if (perms.modifying) p |= 1 << 10; // bit 11: assemble
  if (perms.printing) p |= 1 << 11; // bit 12: high-quality print
  return p | 0;
}

export function pToPermissions(p: number): PdfPermissionFlags {
  return {
    printing: (p & (1 << 2)) !== 0,
    modifying: (p & (1 << 3)) !== 0,
    copying: (p & (1 << 4)) !== 0,
    annotating: (p & (1 << 5)) !== 0,
    formFilling: (p & (1 << 8)) !== 0
  };
}

function padPassword(password: string): Uint8Array {
  const bytes = latin1ToBytes(password).slice(0, 32);
  const out = new Uint8Array(32);
  out.set(bytes, 0);
  out.set(PAD.slice(0, 32 - bytes.length), bytes.length);
  return out;
}

function int32le(n: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, n, true);
  return out;
}

// ════════════════════════════ R4 / AES-128 ════════════════════════════

export interface R4SecurityValues {
  O: Uint8Array; // 32
  U: Uint8Array; // 32
  P: number;
  fileKey: Uint8Array; // 16
}

/** Algorithm 3: compute the /O value. */
export function computeO_R4(userPassword: string, ownerPassword: string): Uint8Array {
  const ownerPadded = padPassword(ownerPassword || userPassword);
  let hash = md5(ownerPadded);
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, 16));
  const rc4Key = hash.slice(0, 16);

  let o = rc4(rc4Key, padPassword(userPassword));
  for (let i = 1; i <= 19; i++) {
    const k = new Uint8Array(16);
    for (let b = 0; b < 16; b++) k[b] = rc4Key[b]! ^ i;
    o = rc4(k, o);
  }
  return o;
}

/** Algorithm 2: compute the file encryption key (128-bit, R4). */
export function computeFileKey_R4(
  userPassword: string,
  O: Uint8Array,
  P: number,
  idFirst: Uint8Array
): Uint8Array {
  let hash = md5(concatBytes(padPassword(userPassword), O, int32le(P), idFirst));
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, 16));
  return hash.slice(0, 16);
}

/** Algorithm 5: compute the /U value (R≥3). */
export function computeU_R4(fileKey: Uint8Array, idFirst: Uint8Array): Uint8Array {
  const hash = md5(concatBytes(PAD, idFirst));
  let u = rc4(fileKey, hash);
  for (let i = 1; i <= 19; i++) {
    const k = new Uint8Array(fileKey.length);
    for (let b = 0; b < fileKey.length; b++) k[b] = fileKey[b]! ^ i;
    u = rc4(k, u);
  }
  const out = new Uint8Array(32); // 16 significant bytes + 16 arbitrary (zero)
  out.set(u.slice(0, 16), 0);
  return out;
}

export function computeR4Values(
  userPassword: string,
  ownerPassword: string,
  permissions: PdfPermissionFlags,
  idFirst: Uint8Array
): R4SecurityValues {
  const P = permissionsToP(permissions);
  const O = computeO_R4(userPassword, ownerPassword);
  const fileKey = computeFileKey_R4(userPassword, O, P, idFirst);
  const U = computeU_R4(fileKey, idFirst);
  return { O, U, P, fileKey };
}

/** Tries user then owner password; returns the file key or null. */
export function authenticateR4(
  password: string,
  O: Uint8Array,
  U: Uint8Array,
  P: number,
  idFirst: Uint8Array
): Uint8Array | null {
  // User password attempt.
  const key = computeFileKey_R4(password, O, P, idFirst);
  const expectedU = computeU_R4(key, idFirst);
  if (timingSafeEqualBytes(expectedU.slice(0, 16), U.slice(0, 16))) return key;

  // Owner password attempt (Algorithm 7): recover user password from /O.
  const ownerPadded = padPassword(password);
  let hash = md5(ownerPadded);
  for (let i = 0; i < 50; i++) hash = md5(hash.slice(0, 16));
  const rc4Key = hash.slice(0, 16);
  let userPadded = O;
  for (let i = 19; i >= 0; i--) {
    const k = new Uint8Array(16);
    for (let b = 0; b < 16; b++) k[b] = rc4Key[b]! ^ i;
    userPadded = rc4(k, userPadded);
  }
  // userPadded is the padded user password; derive key directly from it.
  let h2 = md5(concatBytes(userPadded, O, int32le(P), idFirst));
  for (let i = 0; i < 50; i++) h2 = md5(h2.slice(0, 16));
  const ownerDerivedKey = h2.slice(0, 16);
  const expectedU2 = computeU_R4(ownerDerivedKey, idFirst);
  if (timingSafeEqualBytes(expectedU2.slice(0, 16), U.slice(0, 16))) return ownerDerivedKey;
  return null;
}

/** Per-object key for AESV2 (Algorithm 1). */
export function objectKeyAESV2(fileKey: Uint8Array, objNum: number, genNum: number): Uint8Array {
  const ext = new Uint8Array(fileKey.length + 9);
  ext.set(fileKey, 0);
  let at = fileKey.length;
  ext[at++] = objNum & 0xff;
  ext[at++] = (objNum >> 8) & 0xff;
  ext[at++] = (objNum >> 16) & 0xff;
  ext[at++] = genNum & 0xff;
  ext[at++] = (genNum >> 8) & 0xff;
  ext[at++] = 0x73; // sAlT
  ext[at++] = 0x41;
  ext[at++] = 0x6c;
  ext[at++] = 0x54;
  const digest = md5(ext);
  return digest.slice(0, Math.min(fileKey.length + 5, 16));
}

// ════════════════════════════ R6 / AES-256 ════════════════════════════

/** Algorithm 2.B — hardened hash (SHA-256/384/512 KDF). */
export function hash2B(password: Uint8Array, salt: Uint8Array, udata: Uint8Array): Uint8Array {
  let K = sha256(concatBytes(password, salt, udata));
  let i = 0;
  for (;;) {
    const seq = concatBytes(password, K, udata);
    const K1 = new Uint8Array(seq.length * 64);
    for (let r = 0; r < 64; r++) K1.set(seq, r * seq.length);
    const E = aesCbcEncrypt(K.slice(0, 16), K.slice(16, 32), K1, false);
    let sum = 0;
    for (let b = 0; b < 16; b++) sum += E[b]!;
    const mod = sum % 3;
    K = mod === 0 ? sha256(E) : mod === 1 ? sha384(E) : sha512(E);
    if (i >= 63 && E[E.length - 1]! <= i - 32) break;
    i++;
  }
  return K.slice(0, 32);
}

/** UTF-8 password preprocessing (SASLprep is overkill for our scope; clamp to 127 bytes). */
function passwordBytesV5(password: string): Uint8Array {
  return new TextEncoder().encode(password).slice(0, 127);
}

export interface R6SecurityValues {
  U: Uint8Array; // 48
  UE: Uint8Array; // 32
  O: Uint8Array; // 48
  OE: Uint8Array; // 32
  Perms: Uint8Array; // 16
  P: number;
  fileKey: Uint8Array; // 32
}

export function computeR6Values(
  userPassword: string,
  ownerPassword: string,
  permissions: PdfPermissionFlags,
  encryptMetadata = true
): R6SecurityValues {
  const fileKey = random(32);
  const P = permissionsToP(permissions);
  const userBytes = passwordBytesV5(userPassword);
  const ownerBytes = passwordBytesV5(ownerPassword || userPassword);

  // /U and /UE
  const uvs = random(8);
  const uks = random(8);
  const U = concatBytes(hash2B(userBytes, uvs, new Uint8Array(0)), uvs, uks);
  const ukey = hash2B(userBytes, uks, new Uint8Array(0));
  const UE = aesCbcEncrypt(ukey, new Uint8Array(16), fileKey, false);

  // /O and /OE (bound to U)
  const ovs = random(8);
  const oks = random(8);
  const O = concatBytes(hash2B(ownerBytes, ovs, U), ovs, oks);
  const okey = hash2B(ownerBytes, oks, U);
  const OE = aesCbcEncrypt(okey, new Uint8Array(16), fileKey, false);

  // /Perms
  const block = new Uint8Array(16);
  new DataView(block.buffer).setInt32(0, P, true);
  block[4] = 0xff;
  block[5] = 0xff;
  block[6] = 0xff;
  block[7] = 0xff;
  block[8] = encryptMetadata ? 0x54 /* T */ : 0x46 /* F */;
  block[9] = 0x61; // a
  block[10] = 0x64; // d
  block[11] = 0x62; // b
  block.set(random(4), 12);
  const Perms = aesEcbEncryptBlock(fileKey, block);

  return { U, UE, O, OE, Perms, P, fileKey };
}

/** Algorithm 2.A — authenticate and recover the file key. Returns null on bad password. */
export function authenticateR6(
  password: string,
  U: Uint8Array,
  UE: Uint8Array,
  O: Uint8Array,
  OE: Uint8Array
): Uint8Array | null {
  const pw = passwordBytesV5(password);
  const uHash = U.slice(0, 32);
  const uvs = U.slice(32, 40);
  const uks = U.slice(40, 48);
  const oHash = O.slice(0, 32);
  const ovs = O.slice(32, 40);
  const oks = O.slice(40, 48);

  // Owner password check (uses full 48-byte U as udata).
  if (timingSafeEqualBytes(hash2B(pw, ovs, U), oHash)) {
    const okey = hash2B(pw, oks, U);
    return aesCbcDecrypt(okey, new Uint8Array(16), OE, false);
  }
  // User password check.
  if (timingSafeEqualBytes(hash2B(pw, uvs, new Uint8Array(0)), uHash)) {
    const ukey = hash2B(pw, uks, new Uint8Array(0));
    return aesCbcDecrypt(ukey, new Uint8Array(16), UE, false);
  }
  return null;
}

/** Validates /Perms against the recovered file key; returns decoded P or null. */
export function verifyPerms(fileKey: Uint8Array, Perms: Uint8Array): number | null {
  const block = aesEcbDecryptBlock(fileKey, Perms);
  if (block[9] !== 0x61 || block[10] !== 0x64 || block[11] !== 0x62) return null;
  return new DataView(block.buffer, block.byteOffset).getInt32(0, true);
}

// ──────────────────────── Content encryption (both) ────────────────────────

/** AES-CBC with random IV prefix and PKCS#7 padding (AESV2/AESV3 payloads). */
export function encryptContent(key: Uint8Array, data: Uint8Array): Uint8Array {
  const iv = random(16);
  const enc = aesCbcEncrypt(key, iv, data, true);
  return concatBytes(iv, enc);
}

export function decryptContent(key: Uint8Array, data: Uint8Array): Uint8Array {
  if (data.length < 16) return new Uint8Array(0);
  const iv = data.slice(0, 16);
  const payload = data.slice(16);
  if (payload.length === 0 || payload.length % 16 !== 0) {
    // Tolerate malformed producers: return raw payload rather than throwing.
    return payload;
  }
  return aesCbcDecrypt(key, iv, payload, true);
}
