/**
 * Annotation service — converts viewer-space drafts (PDF points, y-down)
 * into core annotation specs (PDF space, y-up) and commits them into the
 * document. Also handles replies, review states and deletion of existing
 * annotations.
 */
import {
  addAnnotations,
  deleteAnnotationsByName,
  addReply,
  setReviewState,
  type NewAnnotation,
  type Quad
} from '@core/pdf/annotation-writer';
import { documentService } from './document-service';
import { useToolStore } from '../stores/ui-stores';
import { uid } from '../utils';
import type { AnnotationDraft } from '../types';

async function pageHeightPt(docId: string, pageIndex: number): Promise<number> {
  const runtime = documentService.runtime(docId);
  if (!runtime) throw new Error('Document is not open');
  const page = await runtime.pdf.getPage(pageIndex + 1);
  // page.view = [x0, y0, x1, y1] in PDF points.
  const y0 = page.view[1] ?? 0;
  const y1 = page.view[3] ?? 0;
  return y1 - y0;
}

const flipY = (y: number, h: number): number => h - y;

async function draftToCore(docId: string, draft: AnnotationDraft): Promise<NewAnnotation | null> {
  const H = await pageHeightPt(docId, draft.pageIndex);
  const base = {
    id: draft.id,
    pageIndex: draft.pageIndex,
    color: draft.color,
    opacity: draft.opacity,
    author: draft.author,
    contents: draft.contents,
    createdAt: new Date(draft.createdAt)
  };

  switch (draft.kind) {
    case 'highlight':
    case 'underline':
    case 'strikeout':
    case 'squiggly': {
      if (!draft.rects || draft.rects.length === 0) return null;
      const quads: Quad[] = draft.rects.map((r) => ({
        x1: r.x,
        y1: flipY(r.y, H),
        x2: r.x + r.w,
        y2: flipY(r.y, H),
        x3: r.x,
        y3: flipY(r.y + r.h, H),
        x4: r.x + r.w,
        y4: flipY(r.y + r.h, H)
      }));
      return { ...base, kind: draft.kind, quads };
    }
    case 'note': {
      const r = draft.rect ?? { x: 40, y: 40, w: 20, h: 20 };
      return { ...base, kind: 'note', x: r.x, y: flipY(r.y + r.h, H) };
    }
    case 'ink':
    case 'marker': {
      if (!draft.points || draft.points.length === 0) return null;
      const paths = draft.points.map((path) => {
        const out: number[] = [];
        for (let i = 0; i + 1 < path.length; i += 2) {
          out.push(path[i]!, flipY(path[i + 1]!, H));
        }
        return out;
      });
      return { ...base, kind: draft.kind === 'marker' ? 'marker' : 'ink', paths, strokeWidth: draft.strokeWidth };
    }
    case 'line':
    case 'arrow':
      return {
        ...base,
        kind: draft.kind,
        x1: draft.x1 ?? 0,
        y1: flipY(draft.y1 ?? 0, H),
        x2: draft.x2 ?? 0,
        y2: flipY(draft.y2 ?? 0, H),
        strokeWidth: draft.strokeWidth
      };
    case 'rect':
    case 'ellipse': {
      const r = draft.rect;
      if (!r) return null;
      return {
        ...base,
        kind: draft.kind,
        rect: { x: r.x, y: flipY(r.y + r.h, H), width: r.w, height: r.h },
        strokeWidth: draft.strokeWidth
      };
    }
    case 'cloud': {
      const r = draft.rect;
      if (!r) return null;
      const y = flipY(r.y + r.h, H);
      return {
        ...base,
        kind: 'cloud',
        vertices: [
          { x: r.x, y },
          { x: r.x + r.w, y },
          { x: r.x + r.w, y: y + r.h },
          { x: r.x, y: y + r.h }
        ],
        strokeWidth: draft.strokeWidth
      };
    }
    case 'callout':
    case 'textbox': {
      const r = draft.rect;
      if (!r) return null;
      return {
        ...base,
        kind: draft.kind,
        rect: { x: r.x, y: flipY(r.y + r.h, H), width: r.w, height: r.h },
        lines: draft.lines ?? (draft.contents ? draft.contents.split('\n') : ['']),
        fontSize: draft.fontSize ?? 12,
        ...(draft.calloutTarget
          ? { calloutTarget: { x: draft.calloutTarget.x, y: flipY(draft.calloutTarget.y, H) } }
          : {})
      };
    }
    default:
      return null;
  }
}

export const annotationService = {
  /** Commits all drafts of a document into real PDF annotations. */
  async commitDrafts(docId: string): Promise<number> {
    const drafts = useToolStore.getState().drafts[docId] ?? [];
    if (drafts.length === 0) return 0;
    const specs: NewAnnotation[] = [];
    for (const draft of drafts) {
      const spec = await draftToCore(docId, draft);
      if (spec) specs.push(spec);
    }
    if (specs.length === 0) return 0;
    await documentService.applyOperation(docId, 'Add annotations', (bytes) =>
      addAnnotations(bytes, specs)
    );
    useToolStore.getState().clearDrafts(docId);
    return specs.length;
  },

  async deleteByName(docId: string, names: string[]): Promise<void> {
    await documentService.applyOperation(docId, 'Delete annotation', (bytes) =>
      deleteAnnotationsByName(bytes, names)
    );
  },

  async reply(docId: string, parentName: string, contents: string): Promise<void> {
    const author = useToolStore.getState().author;
    await documentService.applyOperation(docId, 'Reply to comment', (bytes) =>
      addReply(bytes, parentName, { id: uid('reply'), author, contents })
    );
  },

  async setResolved(docId: string, parentName: string, resolved: boolean): Promise<void> {
    const author = useToolStore.getState().author;
    await documentService.applyOperation(docId, resolved ? 'Resolve comment' : 'Reopen comment', (bytes) =>
      setReviewState(bytes, parentName, resolved ? 'Completed' : 'None', author, uid('state'))
    );
  }
};
