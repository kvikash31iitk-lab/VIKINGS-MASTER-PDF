/**
 * Serializable PDF mutation registry. Each descriptor is a structured-clone-safe
 * description of a bytes→bytes operation; `runPdfOp` executes it. This lets the
 * renderer hand heavy pdf-lib work to the main-process worker pool over IPC
 * instead of blocking its own UI thread (see document-service.applyServerOp).
 *
 * Only pure, Node-safe operations live here. Operations that depend on
 * renderer-only APIs (PDF.js page proxies) or that return rich metadata the UI
 * needs (Bates next-number, compression stats) stay on the closure path.
 */
import {
  addAnnotations,
  deleteAnnotationsByName,
  addReply,
  setReviewState,
  type NewAnnotation
} from './annotation-writer';
import { addFormFields, fillFormData, flattenForm, type FormFieldSpec } from './form-builder';
import {
  insertBlankPages,
  insertPagesFromPdf,
  deletePages,
  duplicatePages,
  rotatePages,
  reorderPages,
  cropPages,
  type PageSize
} from './page-ops';
import { writeBookmarks, type BookmarkNode } from './bookmarks';
import { writeMetadata, type DocumentMetadata } from './metadata';
import { addAttachment, removeAttachment } from './attachments';
import { applyWatermark, type WatermarkOptions } from './watermark';
import { applyHeaderFooter, type HeaderFooterOptions } from './header-footer';
import { applyStamp, type StampSpec, type StampPlacement } from './stamps';
import { applyRedactions, type CensoredPage } from './redaction';
import { convertToPdfA, type PdfALevel } from './pdfa';
import { composePageContent, type PlacedOp } from './content-composer';

type ReviewState = 'Accepted' | 'Rejected' | 'Completed' | 'Cancelled' | 'None';
type CropBox = { x: number; y: number; width: number; height: number };

/**
 * A structured-clone-safe description of a PDF mutation. Every variant maps to
 * a pure @core/pdf function and is exhaustively handled in `runPdfOp`.
 */
export type PdfOpDescriptor =
  | { kind: 'addAnnotations'; annots: NewAnnotation[] }
  | { kind: 'deleteAnnotations'; names: string[] }
  | { kind: 'addReply'; parentName: string; reply: { id: string; author: string; contents: string } }
  | { kind: 'setReviewState'; parentName: string; state: ReviewState; author: string; stateId: string }
  | { kind: 'addFormFields'; specs: FormFieldSpec[] }
  | { kind: 'fillFormData'; values: Array<{ name: string; value: string | boolean | string[] }> }
  | { kind: 'flattenForm' }
  | { kind: 'insertBlankPages'; index: number; count?: number; size?: PageSize }
  | { kind: 'insertPagesFromPdf'; sourceBytes: Uint8Array; index: number; sourceRange?: string }
  | { kind: 'deletePages'; indices: number[] }
  | { kind: 'duplicatePages'; indices: number[] }
  | { kind: 'rotatePages'; indices: number[]; delta: number }
  | { kind: 'reorderPages'; order: number[] }
  | { kind: 'cropPages'; indices: number[]; box: CropBox }
  | { kind: 'writeBookmarks'; tree: BookmarkNode[] }
  | { kind: 'writeMetadata'; meta: DocumentMetadata }
  | { kind: 'addAttachment'; fileBytes: Uint8Array; fileName: string; options?: { mimeType?: string; description?: string } }
  | { kind: 'removeAttachment'; name: string }
  | { kind: 'applyWatermark'; options: WatermarkOptions }
  | { kind: 'applyHeaderFooter'; options: HeaderFooterOptions }
  | { kind: 'applyStamp'; spec: StampSpec; placement: StampPlacement }
  | { kind: 'applyRedactions'; pages: CensoredPage[] }
  | { kind: 'convertToPdfA'; options: { level: PdfALevel; title?: string } }
  | { kind: 'composePageContent'; ops: PlacedOp[] };

/** Executes a serializable PDF operation, returning the mutated document bytes. */
export async function runPdfOp(bytes: Uint8Array, op: PdfOpDescriptor): Promise<Uint8Array> {
  switch (op.kind) {
    case 'addAnnotations':
      return addAnnotations(bytes, op.annots);
    case 'deleteAnnotations':
      return deleteAnnotationsByName(bytes, op.names);
    case 'addReply':
      return addReply(bytes, op.parentName, op.reply);
    case 'setReviewState':
      return setReviewState(bytes, op.parentName, op.state, op.author, op.stateId);
    case 'addFormFields':
      return addFormFields(bytes, op.specs);
    case 'fillFormData':
      return fillFormData(bytes, op.values);
    case 'flattenForm':
      return flattenForm(bytes);
    case 'insertBlankPages':
      return insertBlankPages(bytes, op.index, op.count, op.size);
    case 'insertPagesFromPdf':
      return insertPagesFromPdf(bytes, op.sourceBytes, op.index, op.sourceRange);
    case 'deletePages':
      return deletePages(bytes, op.indices);
    case 'duplicatePages':
      return duplicatePages(bytes, op.indices);
    case 'rotatePages':
      return rotatePages(bytes, op.indices, op.delta);
    case 'reorderPages':
      return reorderPages(bytes, op.order);
    case 'cropPages':
      return cropPages(bytes, op.indices, op.box);
    case 'writeBookmarks':
      return writeBookmarks(bytes, op.tree);
    case 'writeMetadata':
      return writeMetadata(bytes, op.meta);
    case 'addAttachment':
      return addAttachment(bytes, op.fileBytes, op.fileName, op.options);
    case 'removeAttachment':
      return removeAttachment(bytes, op.name);
    case 'applyWatermark':
      return applyWatermark(bytes, op.options);
    case 'applyHeaderFooter':
      return applyHeaderFooter(bytes, op.options);
    case 'applyStamp':
      return applyStamp(bytes, op.spec, op.placement);
    case 'applyRedactions':
      return applyRedactions(bytes, op.pages);
    case 'convertToPdfA':
      return convertToPdfA(bytes, op.options);
    case 'composePageContent':
      return composePageContent(bytes, op.ops);
    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown PDF op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
