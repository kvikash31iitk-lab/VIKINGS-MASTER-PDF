import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  writeBookmarks,
  readBookmarks,
  buildOutlineFromHeadings,
  bookmarksToJson,
  bookmarksFromJson
} from '@core/pdf/bookmarks';
import { addAttachment, listAttachments, extractAttachment, removeAttachment } from '@core/pdf/attachments';
import { readMetadata, writeMetadata, stripMetadata } from '@core/pdf/metadata';
import {
  addFormFields,
  readFormData,
  fillFormData,
  flattenForm,
  formDataToJson,
  formDataFromJson
} from '@core/pdf/form-builder';
import { makeBlankPdf, makeTextPdf } from '../helpers/sample-pdf';

describe('bookmarks', () => {
  const tree = [
    {
      title: 'Chapter 1',
      pageIndex: 0,
      children: [
        { title: 'Section 1.1', pageIndex: 1, y: 500, children: [] },
        { title: 'Section 1.2', pageIndex: 2, children: [] }
      ]
    },
    { title: 'Chapter 2 — résumé ✓', pageIndex: 3, children: [] }
  ];

  it('writes and reads a nested outline round-trip', async () => {
    const base = await makeBlankPdf(5);
    const withBookmarks = await writeBookmarks(base, tree);
    const readBack = await readBookmarks(withBookmarks);
    expect(readBack).toHaveLength(2);
    expect(readBack[0]!.title).toBe('Chapter 1');
    expect(readBack[0]!.children).toHaveLength(2);
    expect(readBack[0]!.children[0]!.title).toBe('Section 1.1');
    expect(readBack[0]!.children[0]!.pageIndex).toBe(1);
    expect(readBack[0]!.children[0]!.y).toBe(500);
    expect(readBack[1]!.title).toBe('Chapter 2 — résumé ✓'); // unicode survives
  });

  it('clears bookmarks with an empty tree', async () => {
    const base = await makeBlankPdf(2);
    const withBookmarks = await writeBookmarks(base, tree.slice(0, 1));
    const cleared = await writeBookmarks(withBookmarks, []);
    expect(await readBookmarks(cleared)).toHaveLength(0);
  });

  it('auto-generates an outline from heading candidates', () => {
    const result = buildOutlineFromHeadings([
      { pageIndex: 0, text: 'Big Title', fontSize: 24, y: 700 },
      { pageIndex: 1, text: 'Subheading A', fontSize: 16, y: 650 },
      { pageIndex: 2, text: 'Subheading B', fontSize: 16, y: 650 },
      { pageIndex: 3, text: 'Another Title', fontSize: 24, y: 700 }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.children).toHaveLength(2);
  });

  it('serializes to and from JSON', () => {
    const json = bookmarksToJson(tree);
    const back = bookmarksFromJson(json);
    expect(back[0]!.children[0]!.title).toBe('Section 1.1');
    expect(() => bookmarksFromJson('{"not":"array"}')).toThrow();
  });
});

describe('attachments', () => {
  it('adds, lists, extracts and removes embedded files', async () => {
    const base = await makeBlankPdf(1);
    const payload = new TextEncoder().encode('attachment payload — invoice data');
    let bytes = await addAttachment(base, payload, 'invoice.txt', {
      mimeType: 'text/plain',
      description: 'Original invoice'
    });
    bytes = await addAttachment(bytes, new Uint8Array([1, 2, 3]), 'raw.bin');

    const list = await listAttachments(bytes);
    expect(list.map((a) => a.name).sort()).toEqual(['invoice.txt', 'raw.bin']);
    const invoice = list.find((a) => a.name === 'invoice.txt')!;
    expect(invoice.description).toBe('Original invoice');

    const extracted = await extractAttachment(bytes, 'invoice.txt');
    expect(new TextDecoder().decode(extracted)).toContain('invoice data');

    bytes = await removeAttachment(bytes, 'invoice.txt');
    expect((await listAttachments(bytes)).map((a) => a.name)).toEqual(['raw.bin']);
    await expect(extractAttachment(bytes, 'invoice.txt')).rejects.toThrow();
  });
});

describe('metadata', () => {
  it('reads, writes and strips document metadata', async () => {
    const base = await makeTextPdf([['content']]);
    let meta = await readMetadata(base);
    expect(meta.title).toBe('Sample Document');

    const updated = await writeMetadata(base, { title: 'New Title', keywords: 'legal, contract' });
    meta = await readMetadata(updated);
    expect(meta.title).toBe('New Title');
    expect(meta.keywords).toContain('legal');

    const stripped = await stripMetadata(updated);
    meta = await readMetadata(stripped);
    expect(meta.title ?? '').toBe('');
  });
});

describe('form-builder', () => {
  it('creates all field types and reads them back', async () => {
    const base = await makeBlankPdf(1);
    const withFields = await addFormFields(base, [
      { kind: 'text', name: 'fullName', pageIndex: 0, rect: { x: 72, y: 700, width: 200, height: 24 }, defaultValue: 'Jane' },
      { kind: 'checkbox', name: 'agree', pageIndex: 0, rect: { x: 72, y: 660, width: 18, height: 18 }, checked: true },
      { kind: 'radio', name: 'plan', pageIndex: 0, options: [
        { value: 'basic', rect: { x: 72, y: 620, width: 16, height: 16 } },
        { value: 'pro', rect: { x: 140, y: 620, width: 16, height: 16 } }
      ], selected: 'pro' },
      { kind: 'dropdown', name: 'country', pageIndex: 0, rect: { x: 72, y: 580, width: 160, height: 22 }, options: ['India', 'Germany', 'Japan'], selected: 'India' },
      { kind: 'listbox', name: 'tags', pageIndex: 0, rect: { x: 72, y: 500, width: 160, height: 60 }, options: ['a', 'b', 'c'], multiSelect: true, selected: ['a', 'c'] },
      { kind: 'date', name: 'dob', pageIndex: 0, rect: { x: 300, y: 700, width: 120, height: 22 }, format: 'dd/mm/yyyy' },
      { kind: 'signature', name: 'sig1', pageIndex: 0, rect: { x: 300, y: 600, width: 180, height: 50 } }
    ]);

    const data = await readFormData(withFields);
    const byName = Object.fromEntries(data.map((f) => [f.name, f]));
    expect(byName.fullName!.value).toBe('Jane');
    expect(byName.agree!.value).toBe(true);
    expect(byName.plan!.value).toBe('pro');
    expect(byName.country!.value).toBe('India');
    expect(byName.tags!.value).toEqual(['a', 'c']);
    expect(byName.sig1!.type).toBe('signature');
  });

  it('fills, exports/imports JSON, and flattens', async () => {
    const base = await makeBlankPdf(1);
    let bytes = await addFormFields(base, [
      { kind: 'text', name: 'city', pageIndex: 0, rect: { x: 72, y: 700, width: 200, height: 24 } },
      { kind: 'checkbox', name: 'ok', pageIndex: 0, rect: { x: 72, y: 660, width: 18, height: 18 } }
    ]);
    bytes = await fillFormData(bytes, [
      { name: 'city', value: 'Pune' },
      { name: 'ok', value: true },
      { name: 'missing-field', value: 'ignored' }
    ]);
    const data = await readFormData(bytes);
    const json = formDataToJson(data);
    const imported = formDataFromJson(json);
    expect(imported.find((f) => f.name === 'city')!.value).toBe('Pune');

    const flat = await flattenForm(bytes);
    const doc = await PDFDocument.load(flat);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });
});
