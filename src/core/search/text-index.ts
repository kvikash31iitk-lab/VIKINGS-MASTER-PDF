/**
 * Document text index + advanced search:
 * literal / case-sensitive / whole-word / regex, with context snippets.
 * Multi-document search composes per-document indexes.
 */

export interface PageText {
  pageIndex: number;
  text: string;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchHit {
  pageIndex: number;
  start: number;
  end: number;
  matchText: string;
  snippet: string;
  snippetHighlight: [number, number]; // match range within the snippet
}

const SNIPPET_RADIUS = 48;

export class TextIndex {
  private pages: PageText[] = [];

  setPage(pageIndex: number, text: string): void {
    const existing = this.pages.find((p) => p.pageIndex === pageIndex);
    if (existing) existing.text = text;
    else {
      this.pages.push({ pageIndex, text });
      this.pages.sort((a, b) => a.pageIndex - b.pageIndex);
    }
  }

  getPage(pageIndex: number): string | undefined {
    return this.pages.find((p) => p.pageIndex === pageIndex)?.text;
  }

  /** Drops a single page's cached text so it is re-extracted on next access. */
  clearPage(pageIndex: number): void {
    this.pages = this.pages.filter((p) => p.pageIndex !== pageIndex);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  get fullText(): string {
    return this.pages.map((p) => p.text).join('\n\n');
  }

  search(query: string, options: SearchOptions): SearchHit[] {
    const re = compileQuery(query, options);
    if (!re) return [];
    const hits: SearchHit[] = [];
    for (const page of this.pages) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(page.text)) !== null) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        hits.push(makeHit(page, m.index, m.index + m[0].length, m[0]));
        if (hits.length >= 5000) return hits; // hard cap to keep UI responsive
      }
    }
    return hits;
  }
}

export function compileQuery(query: string, options: SearchOptions): RegExp | null {
  if (!query) return null;
  let source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (options.wholeWord) source = `\\b(?:${source})\\b`;
  try {
    return new RegExp(source, options.caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

function makeHit(page: PageText, start: number, end: number, matchText: string): SearchHit {
  const snippetStart = Math.max(0, start - SNIPPET_RADIUS);
  const snippetEnd = Math.min(page.text.length, end + SNIPPET_RADIUS);
  let snippet = page.text.slice(snippetStart, snippetEnd).replace(/\s+/g, ' ');
  const prefix = snippetStart > 0 ? '…' : '';
  const suffix = snippetEnd < page.text.length ? '…' : '';
  snippet = prefix + snippet + suffix;
  const hlStart = prefix.length + (start - snippetStart);
  return {
    pageIndex: page.pageIndex,
    start,
    end,
    matchText,
    snippet,
    snippetHighlight: [hlStart, hlStart + (end - start)]
  };
}

export interface MultiDocHit extends SearchHit {
  docId: string;
  docTitle: string;
}

export function searchAcrossDocuments(
  docs: Array<{ docId: string; title: string; index: TextIndex }>,
  query: string,
  options: SearchOptions
): MultiDocHit[] {
  const out: MultiDocHit[] = [];
  for (const doc of docs) {
    for (const hit of doc.index.search(query, options)) {
      out.push({ ...hit, docId: doc.docId, docTitle: doc.title });
    }
  }
  return out;
}
