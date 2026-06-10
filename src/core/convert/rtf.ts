/**
 * RTF support: a tolerant reader (RTF → plain text) and a writer
 * (paragraphs → RTF). Covers the constructs that matter for document
 * conversion: groups, control words, \par/\tab/\line, unicode escapes,
 * hex escapes, and skippable destinations (fonttbl, colortbl, etc.).
 */

const SKIP_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'header', 'footer', 'pict',
  'object', 'themedata', 'colorschememapping', 'latentstyles', 'datastore',
  'generator', 'xmlnstbl', 'listtable', 'listoverridetable', 'rsidtbl'
]);

export function rtfToText(rtf: string): string {
  let out = '';
  let i = 0;
  const n = rtf.length;
  // Stack of "skipping" flags per group depth.
  const skipStack: boolean[] = [false];
  let skipNext = 0; // \ucN skip count after \uN

  const skipping = (): boolean => skipStack[skipStack.length - 1]!;

  while (i < n) {
    const ch = rtf[i]!;
    if (ch === '{') {
      skipStack.push(skipping());
      i++;
    } else if (ch === '}') {
      if (skipStack.length > 1) skipStack.pop();
      i++;
    } else if (ch === '\\') {
      i++;
      if (i >= n) break;
      const next = rtf[i]!;
      if (next === '\\' || next === '{' || next === '}') {
        if (!skipping()) out += next;
        i++;
      } else if (next === '~') {
        if (!skipping()) out += ' ';
        i++;
      } else if (next === "'") {
        // Hex escape \'xx
        const hex = rtf.substring(i + 1, i + 3);
        if (!skipping() && skipNext === 0) {
          const code = parseInt(hex, 16);
          if (!Number.isNaN(code)) out += String.fromCharCode(code);
        }
        if (skipNext > 0) skipNext--;
        i += 3;
      } else if (/[a-z]/i.test(next)) {
        // Control word.
        let j = i;
        while (j < n && /[a-z]/i.test(rtf[j]!)) j++;
        const word = rtf.substring(i, j);
        let param = '';
        while (j < n && /[-\d]/.test(rtf[j]!)) {
          param += rtf[j];
          j++;
        }
        if (rtf[j] === ' ') j++; // delimiter space consumed
        i = j;

        if (SKIP_DESTINATIONS.has(word)) {
          skipStack[skipStack.length - 1] = true;
        } else if (!skipping()) {
          switch (word) {
            case 'par':
            case 'line':
              out += '\n';
              break;
            case 'tab':
              out += '\t';
              break;
            case 'emdash':
              out += '—';
              break;
            case 'endash':
              out += '–';
              break;
            case 'lquote':
              out += '‘';
              break;
            case 'rquote':
              out += '’';
              break;
            case 'ldblquote':
              out += '“';
              break;
            case 'rdblquote':
              out += '”';
              break;
            case 'bullet':
              out += '•';
              break;
            case 'u': {
              let code = parseInt(param, 10);
              if (!Number.isNaN(code)) {
                if (code < 0) code += 65536;
                out += String.fromCharCode(code);
                skipNext = 1; // skip the fallback character
              }
              break;
            }
            default:
              break; // formatting control words are ignored for text extraction
          }
        }
      } else if (next === '*') {
        // \* introduces an ignorable destination — skip this group.
        skipStack[skipStack.length - 1] = true;
        i++;
      } else {
        i++;
      }
    } else if (ch === '\r' || ch === '\n') {
      i++;
    } else {
      if (!skipping()) {
        if (skipNext > 0) skipNext--;
        else out += ch;
      }
      i++;
    }
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function textToRtf(text: string, options: { fontSize?: number } = {}): string {
  const fs = (options.fontSize ?? 11) * 2; // RTF half-points
  const body = text
    .split('\n')
    .map((line) => escapeRtf(line))
    .join('\\par\n');
  return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss Helvetica;}}\\f0\\fs${fs}\n${body}\\par\n}`;
}

function escapeRtf(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\' || ch === '{' || ch === '}') out += `\\${ch}`;
    else if (ch === '\t') out += '\\tab ';
    else if (code < 128) out += ch;
    else if (code < 65536) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else out += '?';
  }
  return out;
}
