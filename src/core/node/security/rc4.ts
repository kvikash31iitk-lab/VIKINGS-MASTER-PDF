/**
 * RC4 stream cipher — required for the legacy R4 owner/user password
 * algorithms (ISO 32000 §7.6.3). Implemented locally because OpenSSL 3
 * (bundled with modern Node/Electron) removed RC4 from default providers.
 */
export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i]! + key[i % key.length]!) & 0xff;
    const t = S[i]!;
    S[i] = S[j]!;
    S[j] = t;
  }
  const out = new Uint8Array(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]!) & 0xff;
    const t = S[i]!;
    S[i] = S[j]!;
    S[j] = t;
    out[k] = data[k]! ^ S[(S[i]! + S[j]!) & 0xff]!;
  }
  return out;
}
