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
import { detectTables } from './text-extract';

export function buildDocxDocument(pages: ReconstructedPage[], title?: string): Document {
  const children: Array<DocxParagraph | Table> = [];

  pages.forEach((page, pageIdx) => {
    if (pageIdx > 0) {
      children.push(new DocxParagraph({ children: [new PageBreak()] }));
    }

    const tables = detectTables(page.lines);
    const tableLineTexts = new Set<string>();
    for (const t of tables) {
      for (const row of t.rows) tableLineTexts.add(row.join('\t'));
    }

    let tableIdx = 0;
    let emittedTables = new Set<number>();

    for (const para of page.paragraphs) {
      // If this paragraph's lines belong to a detected table, emit the table once.
      const isTabular = para.lines.some((l) => l.text.includes('\t'));
      if (isTabular && tableIdx < tables.length) {
        if (!emittedTables.has(tableIdx)) {
          children.push(buildTable(tables[tableIdx]!));
          emittedTables.add(tableIdx);
        }
        // Advance to next table when the paragraph block ends.
        tableIdx++;
        continue;
      }

      if (para.isHeading) {
        children.push(
          new DocxParagraph({
            heading: para.fontSize > 20 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            children: [new TextRun({ text: para.text })]
          })
        );
      } else {
        children.push(
          new DocxParagraph({
            children: [new TextRun({ text: para.text, size: Math.round(clampSize(para.fontSize) * 2) })],
            spacing: { after: 160 }
          })
        );
      }
    }

    // Reset per page.
    emittedTables = new Set();
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
      (row) =>
        new TableRow({
          children: Array.from({ length: colCount }, (_, c) => {
            return new TableCell({
              children: [new DocxParagraph({ children: [new TextRun({ text: row[c] ?? '' })] })]
            });
          })
        })
    )
  });
}

function clampSize(pt: number): number {
  return Math.max(8, Math.min(28, Math.round(pt)));
}
