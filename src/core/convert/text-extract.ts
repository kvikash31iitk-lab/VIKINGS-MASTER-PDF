/**
 * Text reconstruction from positioned text items (as produced by PDF.js
 * getTextContent). Clusters glyph runs into lines and paragraphs, detects
 * headings and table-like rows — the foundation for PDF→Word/Excel/HTML/TXT.
 */

export interface PositionedTextItem {
  str: string;
  /** Baseline origin in PDF points (origin bottom-left). */
  x: number;
  y: number;
  width: number;
  height: number; // approximated font size
  fontName?: string;
}

export interface TextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  items: PositionedTextItem[];
}

export interface Paragraph {
  lines: TextLine[];
  text: string;
  fontSize: number;
  isHeading: boolean;
  x: number;
  y: number; // top line baseline
}

export interface ReconstructedPage {
  pageIndex: number;
  width: number;
  height: number;
  lines: TextLine[];
  paragraphs: Paragraph[];
  text: string;
}

export function reconstructPage(
  pageIndex: number,
  width: number,
  height: number,
  items: PositionedTextItem[]
): ReconstructedPage {
  const lines = clusterLines(items);
  const paragraphs = clusterParagraphs(lines);
  const text = paragraphs.map((p) => p.text).join('\n\n');
  return { pageIndex, width, height, lines, paragraphs, text };
}

export function clusterLines(items: PositionedTextItem[]): TextLine[] {
  const usable = items.filter((i) => i.str.length > 0);
  // Sort top-to-bottom (PDF y axis is bottom-up), then left-to-right.
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];

  for (const item of sorted) {
    const size = item.height || 10;
    const line = lines.find((l) => Math.abs(l.y - item.y) < Math.max(2, size * 0.45));
    if (line) {
      line.items.push(item);
    } else {
      lines.push({ text: '', x: item.x, y: item.y, width: 0, fontSize: size, items: [item] });
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd: number | null = null;
    let maxSize = 0;
    for (const item of line.items) {
      maxSize = Math.max(maxSize, item.height || 0);
      const spaceWidth = (item.height || 10) * 0.28;
      const endsTabOrSpace = text.endsWith('\t') || text.endsWith(' ');

      // Blank items are often inter-column "leaders": a single space whose
      // advance width spans the whole gutter. A wide one marks a column
      // boundary (tab); a narrow one is just an inter-word space.
      if (item.str.trim() === '') {
        if (text.length > 0) {
          if (item.width > spaceWidth * 6) {
            if (!text.endsWith('\t')) text += '\t';
          } else if (!endsTabOrSpace) {
            text += ' ';
          }
        }
        prevEnd = item.x + item.width;
        continue;
      }

      if (prevEnd !== null) {
        const gap = item.x - prevEnd;
        if (gap > spaceWidth * 6) {
          if (!text.endsWith('\t')) text += '\t'; // wide positional gap → column boundary
        } else if (gap > spaceWidth * 0.6 && !endsTabOrSpace) {
          text += ' ';
        }
      }
      text += item.str;
      prevEnd = item.x + item.width;
    }
    line.text = text.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    line.x = line.items[0]?.x ?? 0;
    line.fontSize = maxSize || line.fontSize;
    const last = line.items[line.items.length - 1];
    line.width = last ? last.x + last.width - line.x : 0;
  }

  return lines.filter((l) => l.text.trim().length > 0);
}

export function clusterParagraphs(lines: TextLine[]): Paragraph[] {
  if (lines.length === 0) return [];
  const bodySize = medianFontSize(lines);
  const paragraphs: Paragraph[] = [];
  let current: TextLine[] = [];

  const flush = (): void => {
    if (current.length === 0) return;
    const fontSize = Math.max(...current.map((l) => l.fontSize));
    const joined = joinLines(current);
    paragraphs.push({
      lines: current,
      text: joined,
      fontSize,
      isHeading: fontSize > bodySize * 1.25 && joined.length < 140,
      x: Math.min(...current.map((l) => l.x)),
      y: current[0]!.y
    });
    current = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prev = current[current.length - 1];
    if (prev) {
      const gap = prev.y - line.y; // positive going down the page
      const expected = Math.max(prev.fontSize, line.fontSize) * 1.7;
      const sizeJump = Math.abs(line.fontSize - prev.fontSize) > bodySize * 0.3;
      if (gap > expected || gap < 0 || sizeJump) flush();
    }
    current.push(line);
  }
  flush();
  return paragraphs;
}

function joinLines(lines: TextLine[]): string {
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!.text;
    if (i === 0) {
      out = text;
      continue;
    }
    // De-hyphenate words broken across lines.
    if (out.endsWith('-') && /^[a-z]/.test(text)) {
      out = out.slice(0, -1) + text;
    } else {
      out += ' ' + text;
    }
  }
  return out.replace(/\s+\t\s*/g, '\t').trim();
}

function medianFontSize(lines: TextLine[]): number {
  // Lower median: biases toward body text when the sample is small, so a
  // two-line page (title + body) still classifies the title as a heading.
  const sizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
  return sizes[Math.floor((sizes.length - 1) / 2)] ?? 11;
}

// ───────────────────────── Table detection (PDF→Excel) ─────────────────────────

export interface DetectedTable {
  rows: string[][];
}

/**
 * Detects table-like regions: consecutive lines containing tab-separated cells
 * whose column starts align across lines.
 */
export function detectTables(lines: TextLine[]): DetectedTable[] {
  const tables: DetectedTable[] = [];
  let block: TextLine[] = [];

  const flush = (): void => {
    if (block.length >= 2) {
      const rows = block.map((l) => l.text.split('\t').map((c) => c.trim()));
      const maxCols = Math.max(...rows.map((r) => r.length));
      if (maxCols >= 2) {
        tables.push({ rows: rows.map((r) => [...r, ...Array(maxCols - r.length).fill('')]) });
      }
    }
    block = [];
  };

  for (const line of lines) {
    if (line.text.includes('\t')) block.push(line);
    else flush();
  }
  flush();
  return tables;
}

/** Plain-text export of a page (tabs preserved for column hints). */
export function pageToPlainText(page: ReconstructedPage): string {
  return page.lines.map((l) => l.text).join('\n');
}

// ───────────────────────── Ordered document blocks (PDF→Word/HTML) ─────────────────────────

export type DocBlock =
  | { kind: 'heading'; text: string; level: 1 | 2; y: number }
  | { kind: 'paragraph'; text: string; y: number }
  | { kind: 'table'; rows: string[][]; y: number };

/**
 * Converts a page's lines into an ordered sequence of headings, paragraphs and
 * tables — the structure needed for a faithful editable Word/HTML export.
 * Tables are recognised from tab-separated rows (clusterLines inserts a tab at
 * wide column gaps); wrapped continuation lines are folded into the previous
 * row's last cell so multi-line cells survive.
 */
export function linesToBlocks(lines: TextLine[]): DocBlock[] {
  if (lines.length === 0) return [];
  const sorted = [...lines].sort((a, b) => b.y - a.y); // top → bottom
  const body = medianFontSize(sorted);
  const headingThreshold = body * 1.22;
  const blocks: DocBlock[] = [];

  let i = 0;
  while (i < sorted.length) {
    const line = sorted[i]!;

    const blockY = line.y;

    // ── Table run: starts on a tab-bearing line ──
    if (line.text.includes('\t')) {
      const rows: string[][] = [];
      let j = i;
      while (j < sorted.length) {
        const l = sorted[j]!;
        const gapFromPrev = j > i ? sorted[j - 1]!.y - l.y : 0;
        if (l.text.includes('\t')) {
          rows.push(l.text.split('\t').map((c) => c.trim()));
        } else if (rows.length > 0 && gapFromPrev >= 0 && gapFromPrev < Math.max(l.fontSize, 6) * 2) {
          // Wrapped cell continuation → append to the last cell of the last row.
          const last = rows[rows.length - 1]!;
          last[last.length - 1] = `${last[last.length - 1]} ${l.text.trim()}`.trim();
        } else {
          break;
        }
        j++;
      }
      const cols = Math.max(...rows.map((r) => r.length));
      if (rows.length >= 2 && cols >= 2) {
        blocks.push({
          kind: 'table',
          rows: rows.map((r) => [...r, ...Array(cols - r.length).fill('')]),
          y: blockY
        });
        i = j;
        continue;
      }
      // Single tabbed line that isn't a real table → treat as a paragraph below.
    }

    // ── Heading: a short line noticeably larger than body text ──
    if (line.fontSize > headingThreshold && line.text.replace(/\t/g, ' ').trim().length < 160) {
      blocks.push({
        kind: 'heading',
        text: line.text.replace(/\t/g, ' ').trim(),
        level: line.fontSize > body * 1.7 ? 1 : 2,
        y: blockY
      });
      i += 1;
      continue;
    }

    // ── Paragraph: accumulate consecutive body lines ──
    let text = line.text.replace(/\t/g, ' ');
    let j = i + 1;
    while (j < sorted.length) {
      const prev = sorted[j - 1]!;
      const l = sorted[j]!;
      if (l.text.includes('\t') || l.fontSize > headingThreshold) break;
      const gap = prev.y - l.y;
      const expected = Math.max(prev.fontSize, l.fontSize) * 1.8;
      if (gap < 0 || gap > expected) break;
      if (text.endsWith('-') && /^[a-z]/.test(l.text)) text = text.slice(0, -1) + l.text.trim();
      else text += ' ' + l.text.replace(/\t/g, ' ');
      j++;
    }
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean) blocks.push({ kind: 'paragraph', text: clean, y: blockY });
    i = j;
  }
  return blocks;
}

