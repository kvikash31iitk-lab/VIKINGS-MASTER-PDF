/**
 * PDF → Word: builds a docx Document from reconstructed pages.
 * Headings map to Word heading styles; tab-separated rows become real tables;
 * page boundaries become page breaks. Packing to bytes is done by the caller
 * (Packer.toBlob in the renderer, Packer.toBuffer in Node tests).
 */
import {
  Document,
  Paragraph as DocxParagraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  PageBreak,
  ImageRun
} from 'docx';
import type { ReconstructedPage } from './text-extract';
import { linesToBlocks } from './text-extract';

const PT_TO_TWIP = 20; // 1 pt = 20 twips (Word page units)
const PT_TO_PX = 96 / 72; // docx image transformation is in px (96 dpi)

export interface DocxPageImage {
  pngBytes: Uint8Array;
  widthPt: number;
  heightPt: number;
}

/**
 * Layout-faithful PDF→Word: each PDF page is embedded as a full-page picture
 * in its own section sized to the page with zero margins, so the document
 * looks identical to the source PDF (text is not editable).
 */
export function buildImageDocx(pages: DocxPageImage[], title?: string): Document {
  const sections = pages.map((pg) => ({
    properties: {
      page: {
        size: { width: Math.round(pg.widthPt * PT_TO_TWIP), height: Math.round(pg.heightPt * PT_TO_TWIP) },
        margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 }
      }
    },
    children: [
      new DocxParagraph({
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: 'png',
            data: pg.pngBytes,
            transformation: {
              width: Math.round(pg.widthPt * PT_TO_PX),
              height: Math.round(pg.heightPt * PT_TO_PX)
            }
          })
        ]
      })
    ]
  }));

  return new Document({
    creator: 'Vikings Master PDF',
    title: title ?? 'Converted document',
    sections: sections.length > 0 ? sections : [{ children: [] }]
  });
}

/** A raster image extracted from a PDF page, placed by its top edge (PDF y-up). */
export interface PlacedDocImage {
  pngBytes: Uint8Array;
  topYPt: number;
  widthPt: number;
  heightPt: number;
}

const CONTENT_WIDTH_PT = 451; // A4 minus 1" margins — cap image display width

function imageParagraph(img: PlacedDocImage): DocxParagraph {
  const scale = img.widthPt > CONTENT_WIDTH_PT ? CONTENT_WIDTH_PT / img.widthPt : 1;
  return new DocxParagraph({
    spacing: { before: 60, after: 60 },
    children: [
      new ImageRun({
        type: 'png',
        data: img.pngBytes,
        transformation: {
          width: Math.round(img.widthPt * scale * PT_TO_PX),
          height: Math.round(img.heightPt * scale * PT_TO_PX)
        }
      })
    ]
  });
}

/**
 * Hybrid PDF→Word: editable text/tables/headings, with the page's embedded
 * raster images interleaved at their vertical position. `imagesByPage[i]`
 * holds the images extracted from page `i`.
 */
export function buildDocxDocument(
  pages: ReconstructedPage[],
  title?: string,
  imagesByPage?: PlacedDocImage[][]
): Document {
  const children: Array<DocxParagraph | Table> = [];

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      children.push(new DocxParagraph({ children: [new PageBreak()] }));
    }

    // Merge text blocks and images into one top-to-bottom ordered stream.
    const ordered: Array<{ y: number; el: DocxParagraph | Table }> = [];
    for (const block of linesToBlocks(page.lines)) {
      if (block.kind === 'table') {
        ordered.push({ y: block.y, el: buildTable({ rows: block.rows }) });
      } else if (block.kind === 'heading') {
        ordered.push({
          y: block.y,
          el: new DocxParagraph({
            heading: block.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            children: [new TextRun({ text: block.text, bold: true })]
          })
        });
      } else {
        ordered.push({
          y: block.y,
          el: new DocxParagraph({ children: [new TextRun({ text: block.text })], spacing: { after: 120 } })
        });
      }
    }
    for (const img of imagesByPage?.[pageIdx] ?? []) {
      ordered.push({ y: img.topYPt, el: imageParagraph(img) });
    }

    ordered.sort((a, b) => b.y - a.y); // top → bottom (PDF y-up)
    for (const item of ordered) children.push(item.el);
  });

  return new Document({
    creator: 'Vikings Master PDF',
    title: title ?? 'Converted document',
    sections: [{ children }]
  });
}

function buildTable(table: { rows: string[][] }): Table {
  const colCount = Math.max(...table.rows.map((r) => r.length), 1);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: table.rows.map(
      (row, rowIdx) =>
        new TableRow({
          children: Array.from({ length: colCount }, (_, c) => {
            return new TableCell({
              children: [
                new DocxParagraph({
                  children: [new TextRun({ text: row[c] ?? '', bold: rowIdx === 0 })]
                })
              ]
            });
          })
        })
    )
  });
}
