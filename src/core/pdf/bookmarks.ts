/**
 * Bookmark (document outline) engine — read, write, import/export.
 * pdf-lib has no outline API, so this module builds the /Outlines tree
 * with low-level objects (ISO 32000 §12.3.3).
 */
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFHexString, PDFString, PDFNumber, PDFNull } from 'pdf-lib';

export interface BookmarkNode {
  title: string;
  pageIndex: number;
  /** Optional vertical target (PDF units from bottom); null = top of page. */
  y?: number;
  children: BookmarkNode[];
}

function countDescendants(nodes: BookmarkNode[]): number {
  let n = 0;
  for (const node of nodes) n += 1 + countDescendants(node.children);
  return n;
}

/** Replaces the entire outline tree. Pass [] to remove all bookmarks. */
export async function writeBookmarks(bytes: Uint8Array, tree: BookmarkNode[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const context = doc.context;
  const pageRefs = doc.getPages().map((p) => p.ref);

  doc.catalog.delete(PDFName.of('Outlines'));
  if (tree.length === 0) return doc.save();

  const outlinesDict = context.obj({ Type: 'Outlines' }) as PDFDict;
  const outlinesRef = context.register(outlinesDict);

  const buildLevel = (nodes: BookmarkNode[], parentRef: PDFRef): { first: PDFRef; last: PDFRef } => {
    const refs: PDFRef[] = nodes.map(() => context.nextRef());
    nodes.forEach((node, i) => {
      const pageRef = pageRefs[Math.max(0, Math.min(node.pageIndex, pageRefs.length - 1))]!;
      const dest = context.obj([
        pageRef,
        PDFName.of('XYZ'),
        PDFNull,
        node.y !== undefined ? PDFNumber.of(node.y) : PDFNull,
        PDFNull
      ]);
      const item = context.obj({}) as PDFDict;
      item.set(PDFName.of('Title'), PDFHexString.fromText(node.title));
      item.set(PDFName.of('Parent'), parentRef);
      item.set(PDFName.of('Dest'), dest);
      if (i > 0) item.set(PDFName.of('Prev'), refs[i - 1]!);
      if (i < refs.length - 1) item.set(PDFName.of('Next'), refs[i + 1]!);
      if (node.children.length > 0) {
        const { first, last } = buildLevel(node.children, refs[i]!);
        item.set(PDFName.of('First'), first);
        item.set(PDFName.of('Last'), last);
        item.set(PDFName.of('Count'), PDFNumber.of(countDescendants(node.children)));
      }
      context.assign(refs[i]!, item);
    });
    return { first: refs[0]!, last: refs[refs.length - 1]! };
  };

  const { first, last } = buildLevel(tree, outlinesRef);
  outlinesDict.set(PDFName.of('First'), first);
  outlinesDict.set(PDFName.of('Last'), last);
  outlinesDict.set(PDFName.of('Count'), PDFNumber.of(countDescendants(tree)));
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
  return doc.save();
}

/** Reads the outline tree (titles, target pages, nesting). */
export async function readBookmarks(bytes: Uint8Array): Promise<BookmarkNode[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const context = doc.context;
  const pageRefToIndex = new Map<string, number>();
  doc.getPages().forEach((p, i) => pageRefToIndex.set(p.ref.toString(), i));

  const outlinesRaw = doc.catalog.get(PDFName.of('Outlines'));
  const outlines = outlinesRaw instanceof PDFRef ? context.lookup(outlinesRaw) : outlinesRaw;
  if (!(outlines instanceof PDFDict)) return [];

  const readDest = (item: PDFDict): { pageIndex: number; y?: number } => {
    let destRaw = item.get(PDFName.of('Dest'));
    if (!destRaw) {
      // /A << /S /GoTo /D [...] >>
      const action = item.lookup(PDFName.of('A'));
      if (action instanceof PDFDict) destRaw = action.get(PDFName.of('D'));
    }
    let dest = destRaw instanceof PDFRef ? context.lookup(destRaw) : destRaw;
    if (dest instanceof PDFHexString || dest instanceof PDFString) {
      // Named destination — resolve through catalog /Names is out of scope; default page 0.
      dest = undefined;
    }
    if (dest instanceof PDFArray && dest.size() > 0) {
      const pageRef = dest.get(0);
      const pageIndex = pageRef instanceof PDFRef ? (pageRefToIndex.get(pageRef.toString()) ?? 0) : 0;
      let y: number | undefined;
      if (dest.size() >= 4) {
        const yObj = dest.get(3);
        if (yObj instanceof PDFNumber) y = yObj.asNumber();
      }
      return y !== undefined ? { pageIndex, y } : { pageIndex };
    }
    return { pageIndex: 0 };
  };

  const readLevel = (firstRef: unknown): BookmarkNode[] => {
    const nodes: BookmarkNode[] = [];
    let current = firstRef instanceof PDFRef ? context.lookup(firstRef) : undefined;
    let guard = 0;
    while (current instanceof PDFDict && guard++ < 5000) {
      const titleObj = current.get(PDFName.of('Title'));
      const title =
        titleObj instanceof PDFHexString
          ? titleObj.decodeText()
          : titleObj instanceof PDFString
            ? titleObj.decodeText()
            : '';
      const { pageIndex, y } = readDest(current);
      const children = readLevel(current.get(PDFName.of('First')));
      nodes.push({ title, pageIndex, ...(y !== undefined ? { y } : {}), children });
      const next = current.get(PDFName.of('Next'));
      current = next instanceof PDFRef ? context.lookup(next) : undefined;
    }
    return nodes;
  };

  return readLevel(outlines.get(PDFName.of('First')));
}

/**
 * Auto-generates bookmarks from heading candidates detected by the caller
 * (text runs whose font size exceeds the body-text size by a threshold).
 */
export interface HeadingCandidate {
  pageIndex: number;
  text: string;
  fontSize: number;
  y: number;
}

export function buildOutlineFromHeadings(headings: HeadingCandidate[]): BookmarkNode[] {
  if (headings.length === 0) return [];
  const sizes = [...new Set(headings.map((h) => Math.round(h.fontSize)))].sort((a, b) => b - a);
  const levelOf = (size: number): number => {
    const idx = sizes.indexOf(Math.round(size));
    return Math.min(idx === -1 ? sizes.length - 1 : idx, 2); // max 3 levels
  };

  const root: BookmarkNode[] = [];
  const stack: Array<{ level: number; node: BookmarkNode }> = [];
  for (const h of headings) {
    const level = levelOf(h.fontSize);
    const node: BookmarkNode = {
      title: h.text.trim().slice(0, 120),
      pageIndex: h.pageIndex,
      y: h.y,
      children: []
    };
    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1]!.node.children.push(node);
    stack.push({ level, node });
  }
  return root;
}

/** JSON import/export for bookmark portability. */
export function bookmarksToJson(tree: BookmarkNode[]): string {
  return JSON.stringify(tree, null, 2);
}

export function bookmarksFromJson(json: string): BookmarkNode[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Invalid bookmarks JSON: expected an array');
  const normalize = (raw: unknown): BookmarkNode => {
    const o = raw as Record<string, unknown>;
    return {
      title: String(o.title ?? 'Untitled'),
      pageIndex: Math.max(0, Number(o.pageIndex ?? 0)),
      ...(o.y !== undefined ? { y: Number(o.y) } : {}),
      children: Array.isArray(o.children) ? o.children.map(normalize) : []
    };
  };
  return parsed.map(normalize);
}
