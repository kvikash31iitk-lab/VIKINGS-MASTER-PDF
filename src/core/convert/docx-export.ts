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
  PageBreak
} from 'docx';
import type { ReconstructedPage } from './text-extract';
import { linesToBlocks } from './text-extract';

export function buildDocxDocument(pages: ReconstructedPage[], title?: string): Document {
  const children: Array<DocxParagraph | Table> = [];

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      children.push(new DocxParagraph({ children: [new PageBreak()] }));
    }

    for (const block of linesToBlocks(page.lines)) {
      if (block.kind === 'table') {
        children.push(buildTable({ rows: block.rows }));
      } else if (block.kind === 'heading') {
        children.push(
          new DocxParagraph({
            heading: block.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            children: [new TextRun({ text: block.text, bold: true })]
          })
        );
      } else {
        children.push(
          new DocxParagraph({
            children: [new TextRun({ text: block.text })],
            spacing: { after: 120 }
          })
        );
      }
    }
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
