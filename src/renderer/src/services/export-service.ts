/**
 * Export service — drives every PDF→X conversion by combining page renders
 * (canvas), reconstructed text (core/text-extract) and the core writers.
 */
import { Packer } from 'docx';
import { reconstructPage, pageToPlainText, detectTables } from '@core/convert/text-extract';
import type { ReconstructedPage } from '@core/convert/text-extract';
import { buildDocxDocument } from '@core/convert/docx-export';
import { buildXlsx } from '@core/convert/xlsx-writer';
import { buildPptx } from '@core/convert/pptx-writer';
import { encodeTiff, type TiffPage } from '@core/convert/tiff-encoder';
import { buildHtml } from '@core/convert/html-export';
import { textToRtf } from '@core/convert/rtf';
import { documentService } from './document-service';
import { pageRenderService } from './page-render-service';
import { extractPageImages } from './pdf-image-extract';
import { ipc, rlog } from './ipc';
import { toast, useToastStore } from '../stores/ui-stores';
import { useDocumentsStore } from '../stores/documents-store';
import { resolvePageSelection } from '@core/pdf/utils';

export type ExportFormat = 'docx' | 'xlsx' | 'pptx' | 'png' | 'jpg' | 'tiff' | 'html' | 'txt' | 'rtf';

export interface ExportOptions {
  format: ExportFormat;
  pageRange?: string;
  dpi?: number;
  jpegQuality?: number;
  htmlMode?: 'layout' | 'flow';
}

const FORMAT_FILTERS: Record<ExportFormat, { name: string; extensions: string[] }> = {
  docx: { name: 'Word Document', extensions: ['docx'] },
  xlsx: { name: 'Excel Workbook', extensions: ['xlsx'] },
  pptx: { name: 'PowerPoint Presentation', extensions: ['pptx'] },
  png: { name: 'PNG Image', extensions: ['png'] },
  jpg: { name: 'JPEG Image', extensions: ['jpg'] },
  tiff: { name: 'TIFF Image', extensions: ['tif', 'tiff'] },
  html: { name: 'HTML Document', extensions: ['html'] },
  txt: { name: 'Plain Text', extensions: ['txt'] },
  rtf: { name: 'Rich Text', extensions: ['rtf'] }
};

async function reconstructPages(docId: string, indices: number[]): Promise<ReconstructedPage[]> {
  const runtime = documentService.runtime(docId);
  if (!runtime) throw new Error('Document is not open');
  const pages: ReconstructedPage[] = [];
  for (const i of indices) {
    const page = await runtime.pdf.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    const items = await documentService.textItems(docId, i);
    pages.push(reconstructPage(i, vp.width, vp.height, items));
  }
  return pages;
}

export const exportService = {
  async export(docId: string, options: ExportOptions): Promise<boolean> {
    const meta = useDocumentsStore.getState().docs.find((d) => d.id === docId);
    const runtime = documentService.runtime(docId);
    if (!meta || !runtime) return false;

    const indices = resolvePageSelection(options.pageRange, runtime.pdf.numPages);
    const stem = meta.title.replace(/\.pdf$/i, '');
    const filter = FORMAT_FILTERS[options.format];

    // Multi-file image export goes to a directory-style naming pattern.
    const multiImage = (options.format === 'png' || options.format === 'jpg') && indices.length > 1;
    const target = await ipc.files.saveDialog({
      title: `Export as ${filter.name}`,
      filters: [filter],
      defaultPath: `${stem}${multiImage ? '-page-1' : ''}.${filter.extensions[0]}`
    });
    if (!target) return false;

    const progressToast = toast.progress('export', `Exporting ${filter.name}…`);

    try {
      switch (options.format) {
        case 'docx': {
          // Hybrid: editable text/tables/headings, with each page's embedded
          // raster images placed at their original vertical position.
          const dpi = options.dpi ?? 150;
          const pages = await reconstructPages(docId, indices);
          const imagesByPage = [];
          for (const i of indices) {
            const placed = await extractPageImages(docId, i, dpi);
            imagesByPage.push(
              placed.map((im) => ({
                pngBytes: im.pngBytes,
                topYPt: im.topYPt,
                widthPt: im.widthPt,
                heightPt: im.heightPt
              }))
            );
          }
          const doc = buildDocxDocument(pages, stem, imagesByPage);
          const blob = await Packer.toBlob(doc);
          await ipc.files.write(target, new Uint8Array(await blob.arrayBuffer()));
          break;
        }
        case 'xlsx': {
          const pages = await reconstructPages(docId, indices);
          const sheets = pages.map((p) => {
            const tables = detectTables(p.lines);
            const rows =
              tables.length > 0
                ? tables.flatMap((t, ti) => (ti > 0 ? [[''], ...t.rows] : t.rows))
                : p.lines.map((l) => l.text.split('\t'));
            return { name: `Page ${p.pageIndex + 1}`, rows };
          });
          await ipc.files.write(target, await buildXlsx(sheets));
          break;
        }
        case 'pptx': {
          const slides = [];
          for (const i of indices) {
            const render = await pageRenderService.renderAtDpi(docId, i, options.dpi ?? 150);
            slides.push({
              pngBytes: await pageRenderService.renderPng(docId, i, options.dpi ?? 150),
              widthPt: render.ptWidth,
              heightPt: render.ptHeight
            });
          }
          await ipc.files.write(target, await buildPptx(slides));
          break;
        }
        case 'png':
        case 'jpg': {
          const dpi = options.dpi ?? 150;
          for (let n = 0; n < indices.length; n++) {
            const bytes =
              options.format === 'png'
                ? await pageRenderService.renderPng(docId, indices[n]!, dpi)
                : await pageRenderService.renderJpeg(docId, indices[n]!, dpi, options.jpegQuality ?? 0.85);
            const file =
              indices.length === 1
                ? target
                : target.replace(/-page-1(\.[a-z]+)$/i, `-page-${indices[n]! + 1}$1`);
            await ipc.files.write(file, bytes);
          }
          break;
        }
        case 'tiff': {
          const dpi = options.dpi ?? 150;
          const tiffPages: TiffPage[] = [];
          for (const i of indices) {
            const { rgba, width, height } = await pageRenderService.renderRgba(docId, i, dpi);
            tiffPages.push({ width, height, rgba, dpi });
          }
          await ipc.files.write(target, encodeTiff(tiffPages));
          break;
        }
        case 'html': {
          const pages = await reconstructPages(docId, indices);
          const html = buildHtml(pages, { mode: options.htmlMode ?? 'layout', title: stem });
          await ipc.files.write(target, new TextEncoder().encode(html));
          break;
        }
        case 'txt': {
          const pages = await reconstructPages(docId, indices);
          const text = pages.map((p) => pageToPlainText(p)).join('\n\n— page break —\n\n');
          await ipc.files.write(target, new TextEncoder().encode(text));
          break;
        }
        case 'rtf': {
          const pages = await reconstructPages(docId, indices);
          const text = pages.map((p) => p.paragraphs.map((par) => par.text).join('\n\n')).join('\n\n');
          await ipc.files.write(target, new TextEncoder().encode(textToRtf(text)));
          break;
        }
      }
      toast.success('Export complete', target);
      void ipc.log.audit({ event: 'doc.export', detail: { format: options.format, target } });
      return true;
    } catch (e) {
      rlog.error('export', `Export to ${options.format} failed`, { error: (e as Error).message });
      toast.error('Export failed', (e as Error).message);
      return false;
    } finally {
      // Always clear the progress spinner — even on error.
      useToastStore.getState().dismiss(progressToast);
    }
  }
};
