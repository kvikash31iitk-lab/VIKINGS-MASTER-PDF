import { rgb, type RGB } from 'pdf-lib';

/** Parses "#rrggbb" / "#rgb" into a pdf-lib RGB color. Falls back to black. */
export function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return rgb(0, 0, 0);
  let h = m[1]!;
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const c = hexToRgb(hex);
  return [c.red, c.green, c.blue];
}

/**
 * Parses a page-range expression ("1-3, 5, 9-") into zero-based page indices.
 * - 1-based input, inclusive ranges, open end ("9-") runs to last page.
 * - Returns sorted unique indices clamped to [0, pageCount).
 */
export function parsePageRanges(expr: string, pageCount: number): number[] {
  const out = new Set<number>();
  const trimmed = expr.trim();
  if (!trimmed) return [];
  for (const partRaw of trimmed.split(',')) {
    const part = partRaw.trim();
    if (!part) continue;
    const range = /^(\d+)?\s*-\s*(\d+)?$/.exec(part);
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 1;
      const end = range[2] ? parseInt(range[2], 10) : pageCount;
      for (let p = Math.max(1, start); p <= Math.min(pageCount, end); p++) out.add(p - 1);
    } else if (/^\d+$/.test(part)) {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= pageCount) out.add(p - 1);
    }
  }
  return [...out].sort((a, b) => a - b);
}

/** All page indices for a document. */
export function allPageIndices(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, i) => i);
}

/** Resolves an optional range expression to indices ("" or undefined = all pages). */
export function resolvePageSelection(expr: string | undefined, pageCount: number): number[] {
  if (!expr || !expr.trim()) return allPageIndices(pageCount);
  return parsePageRanges(expr, pageCount);
}

/** Formats bytes for UI/reporting. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Validates a credit-card-like digit string with the Luhn algorithm. */
export function luhnCheck(digitsRaw: string): boolean {
  const digits = digitsRaw.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** PDF date string (D:YYYYMMDDHHmmSSZ). */
export function toPdfDate(date: Date = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `D:${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(
    date.getUTCHours()
  )}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

/** Escapes a string for safe inclusion in XML (XMP, OOXML writers). */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Concatenates byte arrays. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function bytesToLatin1(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return s;
}

export function latin1ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}
