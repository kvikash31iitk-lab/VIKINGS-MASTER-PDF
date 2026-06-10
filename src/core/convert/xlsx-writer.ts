/**
 * Minimal native XLSX (SpreadsheetML) writer over JSZip — zero extra deps.
 * Produces one worksheet per input sheet with inline strings; numbers are
 * written as numeric cells. Used for PDF→Excel table export.
 */
import JSZip from 'jszip';
import { escapeXml } from '../pdf/utils';

export interface SheetData {
  name: string;
  rows: string[][];
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function columnRef(index: number): string {
  let ref = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    ref = String.fromCharCode(65 + rem) + ref;
    n = Math.floor((n - 1) / 26);
  }
  return ref;
}

function sheetXml(rows: string[][]): string {
  let body = '';
  rows.forEach((row, r) => {
    let cells = '';
    row.forEach((value, c) => {
      if (value === '') return;
      const ref = `${columnRef(c)}${r + 1}`;
      const asNumber = Number(value.replace(/,/g, ''));
      if (value.trim() !== '' && !Number.isNaN(asNumber) && /^-?[\d,]+(\.\d+)?$/.test(value.trim())) {
        cells += `<c r="${ref}"><v>${asNumber}</v></c>`;
      } else {
        cells += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
      }
    });
    body += `<row r="${r + 1}">${cells}</row>`;
  });
  return (
    XML_DECL +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

export async function buildXlsx(sheets: SheetData[]): Promise<Uint8Array> {
  const usable = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [['']] }];
  const zip = new JSZip();

  const sheetEntries = usable.map((s, i) => ({
    name: sanitizeSheetName(s.name || `Sheet${i + 1}`, i),
    file: `sheet${i + 1}.xml`,
    rId: `rId${i + 1}`,
    sheetId: i + 1
  }));

  zip.file(
    '[Content_Types].xml',
    XML_DECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheetEntries
        .map(
          (s) =>
            `<Override PartName="/xl/worksheets/${s.file}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>'
  );

  zip.file(
    '_rels/.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>'
  );

  zip.file(
    'xl/workbook.xml',
    XML_DECL +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheetEntries
        .map((s) => `<sheet name="${escapeXml(s.name)}" sheetId="${s.sheetId}" r:id="${s.rId}"/>`)
        .join('') +
      '</sheets></workbook>'
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    XML_DECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheetEntries
        .map(
          (s) =>
            `<Relationship Id="${s.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/${s.file}"/>`
        )
        .join('') +
      `<Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>'
  );

  zip.file(
    'xl/styles.xml',
    XML_DECL +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
      '<borders count="1"><border/></borders>' +
      '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
      '<cellXfs count="1"><xf xfId="0"/></cellXfs>' +
      '</styleSheet>'
  );

  usable.forEach((s, i) => {
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows));
  });

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return cleaned || `Sheet${index + 1}`;
}
