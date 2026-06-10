/**
 * Document encryption/decryption — applies the Standard Security Handler
 * over the pdf-lib object graph: every string and stream is encrypted with
 * the algorithm-appropriate key, the /Encrypt dictionary is attached to the
 * trailer, and the file is serialized with a classic cross-reference table.
 *
 * Write support: AES-256 (V5/R6) and AES-128 (V4/R4 AESV2).
 * Read support: those two plus legacy RC4 (V2/R3) for opening older files.
 *
 * Known boundary: foreign files whose *compressed object streams* are
 * encrypted (modern Acrobat output) cannot be restructured by pdf-lib before
 * decryption; those are reported as unsupported (viewing still works through
 * PDF.js password handling).
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
  PDFString,
  PDFHexString,
  PDFNumber,
  PDFRawStream,
  PDFBool
} from 'pdf-lib';
import { bytesToHex } from '../../pdf/utils';
import { rc4 } from './rc4';
import { md5, random } from './crypt-primitives';
import {
  computeR4Values,
  computeR6Values,
  authenticateR4,
  authenticateR6,
  objectKeyAESV2,
  encryptContent,
  decryptContent,
  permissionsToP,
  pToPermissions
} from './standard-security';
import type { EncryptionAlgorithm, PdfPermissionFlags } from '../../../shared/types';

export interface EncryptOptions {
  algorithm: EncryptionAlgorithm;
  userPassword: string;
  ownerPassword: string;
  permissions: PdfPermissionFlags;
}

export interface EncryptionInfo {
  encrypted: boolean;
  algorithm?: 'aes-256' | 'aes-128' | 'rc4-128' | 'rc4-40' | 'unknown';
  permissions?: PdfPermissionFlags;
}

type KeyForObject = (objNum: number, genNum: number) => Uint8Array;
type ContentCipher = (key: Uint8Array, data: Uint8Array) => Uint8Array;

// ─────────────────────────── Graph walker ───────────────────────────

function transformStringsAndStreams(
  doc: PDFDocument,
  skipDict: PDFDict | null,
  keyFor: KeyForObject,
  cipher: ContentCipher
): void {
  const context = doc.context;
  const idArray = context.trailerInfo.ID;

  const transformValue = (value: unknown, key: Uint8Array): unknown => {
    if (value instanceof PDFString || value instanceof PDFHexString) {
      const bytes = value.asBytes();
      return PDFHexString.of(bytesToHex(cipher(key, bytes)).toUpperCase());
    }
    return undefined;
  };

  const walk = (node: unknown, key: Uint8Array, seen: Set<unknown>): void => {
    if (node === skipDict || node === idArray || node == null) return;
    if (seen.has(node)) return;
    if (node instanceof PDFDict) {
      seen.add(node);
      for (const [k, v] of node.entries()) {
        const replaced = transformValue(v, key);
        if (replaced !== undefined) node.set(k, replaced as PDFHexString);
        else walk(v, key, seen);
      }
    } else if (node instanceof PDFArray) {
      seen.add(node);
      for (let i = 0; i < node.size(); i++) {
        const v = node.get(i);
        const replaced = transformValue(v, key);
        if (replaced !== undefined) node.set(i, replaced as PDFHexString);
        else walk(v, key, seen);
      }
    }
    // PDFRef: do not follow — the target is processed as its own indirect object.
  };

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (obj === skipDict) continue;
    const key = keyFor(ref.objectNumber, ref.generationNumber);
    if (obj instanceof PDFRawStream) {
      if (obj.dict === skipDict) continue;
      walk(obj.dict, key, new Set());
      const contents = obj.getContents();
      const newContents = cipher(key, contents);
      const newStream = PDFRawStream.of(obj.dict, newContents);
      obj.dict.set(PDFName.of('Length'), PDFNumber.of(newContents.length));
      context.assign(ref, newStream);
    } else {
      const direct = transformValue(obj, key);
      if (direct !== undefined) context.assign(ref, direct as PDFHexString);
      else walk(obj, key, new Set());
    }
  }
}

function ensureFileId(doc: PDFDocument): Uint8Array {
  const existing = doc.context.trailerInfo.ID;
  if (existing instanceof PDFArray && existing.size() === 2) {
    const first = existing.get(0);
    if (first instanceof PDFHexString || first instanceof PDFString) return first.asBytes();
  }
  const idBytes = random(16);
  const hex = PDFHexString.of(bytesToHex(idBytes).toUpperCase());
  const hex2 = PDFHexString.of(bytesToHex(random(16)).toUpperCase());
  doc.context.trailerInfo.ID = doc.context.obj([hex, hex2]);
  return idBytes;
}

// ─────────────────────────── Encrypt ───────────────────────────

export async function encryptPdf(bytes: Uint8Array, options: EncryptOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const context = doc.context;
  const idFirst = ensureFileId(doc);

  let encryptDict: PDFDict;

  if (options.algorithm === 'aes-256') {
    const v = computeR6Values(options.userPassword, options.ownerPassword, options.permissions, true);
    transformStringsAndStreams(doc, null, () => v.fileKey, encryptContent);
    encryptDict = context.obj({
      Filter: 'Standard',
      V: 5,
      R: 6,
      Length: 256,
      CF: context.obj({
        StdCF: context.obj({ CFM: 'AESV3', AuthEvent: 'DocOpen', Length: 32 })
      }),
      StmF: 'StdCF',
      StrF: 'StdCF',
      O: PDFHexString.of(bytesToHex(v.O).toUpperCase()),
      U: PDFHexString.of(bytesToHex(v.U).toUpperCase()),
      OE: PDFHexString.of(bytesToHex(v.OE).toUpperCase()),
      UE: PDFHexString.of(bytesToHex(v.UE).toUpperCase()),
      Perms: PDFHexString.of(bytesToHex(v.Perms).toUpperCase()),
      P: v.P,
      EncryptMetadata: PDFBool.True
    }) as PDFDict;
  } else {
    const v = computeR4Values(options.userPassword, options.ownerPassword, options.permissions, idFirst);
    transformStringsAndStreams(
      doc,
      null,
      (objNum, genNum) => objectKeyAESV2(v.fileKey, objNum, genNum),
      encryptContent
    );
    encryptDict = context.obj({
      Filter: 'Standard',
      V: 4,
      R: 4,
      Length: 128,
      CF: context.obj({
        StdCF: context.obj({ CFM: 'AESV2', AuthEvent: 'DocOpen', Length: 16 })
      }),
      StmF: 'StdCF',
      StrF: 'StdCF',
      O: PDFHexString.of(bytesToHex(v.O).toUpperCase()),
      U: PDFHexString.of(bytesToHex(v.U).toUpperCase()),
      P: v.P,
      EncryptMetadata: PDFBool.True
    }) as PDFDict;
  }

  context.trailerInfo.Encrypt = context.register(encryptDict);
  return doc.save({ useObjectStreams: false });
}

// ─────────────────────────── Decrypt ───────────────────────────

interface ParsedEncryptDict {
  dict: PDFDict;
  v: number;
  r: number;
  length: number;
  O: Uint8Array;
  U: Uint8Array;
  OE?: Uint8Array;
  UE?: Uint8Array;
  P: number;
  cfm: string;
}

function readEncryptDict(doc: PDFDocument): ParsedEncryptDict | null {
  const raw = doc.context.trailerInfo.Encrypt;
  const dict = raw instanceof PDFRef ? doc.context.lookup(raw) : raw;
  if (!(dict instanceof PDFDict)) return null;

  const num = (name: string, fallback = 0): number => {
    const o = dict.lookup(PDFName.of(name));
    return o instanceof PDFNumber ? o.asNumber() : fallback;
  };
  const str = (name: string): Uint8Array | undefined => {
    const o = dict.lookup(PDFName.of(name));
    if (o instanceof PDFHexString || o instanceof PDFString) return o.asBytes();
    return undefined;
  };

  let cfm = '';
  const cf = dict.lookup(PDFName.of('CF'));
  if (cf instanceof PDFDict) {
    const stdcf = cf.lookup(PDFName.of('StdCF'));
    if (stdcf instanceof PDFDict) {
      const cfmName = stdcf.lookup(PDFName.of('CFM'));
      if (cfmName instanceof PDFName) cfm = cfmName.decodeText();
    }
  }

  const O = str('O');
  const U = str('U');
  if (!O || !U) return null;

  return {
    dict,
    v: num('V', 1),
    r: num('R', 2),
    length: num('Length', 40),
    O,
    U,
    OE: str('OE'),
    UE: str('UE'),
    P: num('P', -1),
    cfm
  };
}

export class WrongPasswordError extends Error {
  constructor() {
    super('The password is incorrect');
    this.name = 'WrongPasswordError';
  }
}

export class UnsupportedEncryptionError extends Error {
  constructor(detail: string) {
    super(`Unsupported encryption: ${detail}`);
    this.name = 'UnsupportedEncryptionError';
  }
}

export async function decryptPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (e) {
    throw new UnsupportedEncryptionError(
      'file structure could not be parsed before decryption (encrypted object streams)'
    );
  }
  const enc = readEncryptDict(doc);
  if (!enc) return bytes; // not encrypted

  const idArray = doc.context.trailerInfo.ID;
  let idFirst: Uint8Array = new Uint8Array(0);
  if (idArray instanceof PDFArray && idArray.size() > 0) {
    const first = idArray.get(0);
    if (first instanceof PDFHexString || first instanceof PDFString) idFirst = first.asBytes();
  }

  let keyFor: KeyForObject;
  let cipher: ContentCipher;

  if (enc.v === 5 && (enc.r === 6 || enc.r === 5)) {
    if (!enc.OE || !enc.UE) throw new UnsupportedEncryptionError('V5 file missing OE/UE');
    const fileKey = authenticateR6(password, enc.U, enc.UE, enc.O, enc.OE);
    if (!fileKey) throw new WrongPasswordError();
    keyFor = () => fileKey;
    cipher = decryptContent;
  } else if (enc.v === 4 && enc.cfm === 'AESV2') {
    const fileKey = authenticateR4(password, enc.O, enc.U, enc.P, idFirst);
    if (!fileKey) throw new WrongPasswordError();
    keyFor = (objNum, genNum) => objectKeyAESV2(fileKey, objNum, genNum);
    cipher = decryptContent;
  } else if (enc.v === 2 || (enc.v === 4 && enc.cfm === 'V2') || enc.v === 1) {
    // Legacy RC4. Key length: /Length bits (40 default).
    const fileKey = authenticateR4(password, enc.O, enc.U, enc.P, idFirst);
    if (!fileKey) throw new WrongPasswordError();
    const keyLen = Math.max(5, Math.min(16, Math.floor(enc.length / 8)));
    keyFor = (objNum, genNum) => {
      const ext = new Uint8Array(keyLen + 5);
      ext.set(fileKey.slice(0, keyLen), 0);
      ext[keyLen] = objNum & 0xff;
      ext[keyLen + 1] = (objNum >> 8) & 0xff;
      ext[keyLen + 2] = (objNum >> 16) & 0xff;
      ext[keyLen + 3] = genNum & 0xff;
      ext[keyLen + 4] = (genNum >> 8) & 0xff;
      return md5(ext).slice(0, Math.min(keyLen + 5, 16));
    };
    cipher = (key, data) => rc4(key, data);
  } else {
    throw new UnsupportedEncryptionError(`V=${enc.v} R=${enc.r} CFM=${enc.cfm || 'n/a'}`);
  }

  transformStringsAndStreams(doc, enc.dict, keyFor, cipher);
  doc.context.trailerInfo.Encrypt = undefined;
  return doc.save({ useObjectStreams: false });
}

export async function getEncryptionInfo(bytes: Uint8Array): Promise<EncryptionInfo> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return { encrypted: true, algorithm: 'unknown' };
  }
  const enc = readEncryptDict(doc);
  if (!enc) return { encrypted: false };
  let algorithm: EncryptionInfo['algorithm'] = 'unknown';
  if (enc.v === 5) algorithm = 'aes-256';
  else if (enc.v === 4 && enc.cfm === 'AESV2') algorithm = 'aes-128';
  else if (enc.v === 2 && enc.length >= 128) algorithm = 'rc4-128';
  else if (enc.v <= 2) algorithm = 'rc4-40';
  return { encrypted: true, algorithm, permissions: pToPermissions(enc.P) };
}

export { permissionsToP, pToPermissions };
