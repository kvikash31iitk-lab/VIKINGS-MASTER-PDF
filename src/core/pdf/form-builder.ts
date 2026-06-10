/**
 * Form builder — creates AcroForm fields from designer specs and supports
 * fill / read / flatten / data import-export.
 */
import { PDFDocument, PDFName, PDFHexString, PDFDict, PDFArray, rgb } from 'pdf-lib';
import { hexToRgb } from './utils';

export interface FieldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FormFieldSpec =
  | { kind: 'text'; name: string; pageIndex: number; rect: FieldRect; defaultValue?: string; multiline?: boolean; required?: boolean; maxLength?: number; fontSize?: number }
  | { kind: 'checkbox'; name: string; pageIndex: number; rect: FieldRect; checked?: boolean; required?: boolean }
  | { kind: 'radio'; name: string; pageIndex: number; options: Array<{ value: string; rect: FieldRect }>; selected?: string; required?: boolean }
  | { kind: 'dropdown'; name: string; pageIndex: number; rect: FieldRect; options: string[]; selected?: string; editable?: boolean; required?: boolean }
  | { kind: 'listbox'; name: string; pageIndex: number; rect: FieldRect; options: string[]; selected?: string[]; multiSelect?: boolean; required?: boolean }
  | { kind: 'date'; name: string; pageIndex: number; rect: FieldRect; format?: string; required?: boolean }
  | { kind: 'signature'; name: string; pageIndex: number; rect: FieldRect; required?: boolean };

export async function addFormFields(bytes: Uint8Array, specs: FormFieldSpec[]): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const form = doc.getForm();

  for (const spec of specs) {
    if (spec.pageIndex < 0 || spec.pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(spec.pageIndex);
    const common = {
      x: spec.kind === 'radio' ? 0 : spec.rect.x,
      y: spec.kind === 'radio' ? 0 : spec.rect.y,
      width: spec.kind === 'radio' ? 0 : spec.rect.width,
      height: spec.kind === 'radio' ? 0 : spec.rect.height,
      borderColor: rgb(0.45, 0.45, 0.5),
      borderWidth: 1,
      backgroundColor: rgb(0.97, 0.97, 0.99)
    };

    switch (spec.kind) {
      case 'text': {
        const field = form.createTextField(spec.name);
        if (spec.multiline) field.enableMultiline();
        if (spec.maxLength) field.setMaxLength(spec.maxLength);
        if (spec.defaultValue) field.setText(spec.defaultValue);
        if (spec.fontSize) field.setFontSize(spec.fontSize);
        if (spec.required) field.enableRequired();
        field.addToPage(page, { ...common, x: spec.rect.x, y: spec.rect.y, width: spec.rect.width, height: spec.rect.height });
        break;
      }
      case 'checkbox': {
        const field = form.createCheckBox(spec.name);
        if (spec.required) field.enableRequired();
        field.addToPage(page, { ...common, x: spec.rect.x, y: spec.rect.y, width: spec.rect.width, height: spec.rect.height });
        if (spec.checked) field.check();
        break;
      }
      case 'radio': {
        const group = form.createRadioGroup(spec.name);
        if (spec.required) group.enableRequired();
        for (const opt of spec.options) {
          group.addOptionToPage(opt.value, page, {
            x: opt.rect.x,
            y: opt.rect.y,
            width: opt.rect.width,
            height: opt.rect.height,
            borderColor: rgb(0.45, 0.45, 0.5),
            borderWidth: 1
          });
        }
        if (spec.selected) group.select(spec.selected);
        break;
      }
      case 'dropdown': {
        const field = form.createDropdown(spec.name);
        field.addOptions(spec.options);
        if (spec.editable) field.enableEditing();
        if (spec.required) field.enableRequired();
        field.addToPage(page, { ...common, x: spec.rect.x, y: spec.rect.y, width: spec.rect.width, height: spec.rect.height });
        if (spec.selected) field.select(spec.selected);
        break;
      }
      case 'listbox': {
        const field = form.createOptionList(spec.name);
        field.addOptions(spec.options);
        if (spec.multiSelect) field.enableMultiselect();
        if (spec.required) field.enableRequired();
        field.addToPage(page, { ...common, x: spec.rect.x, y: spec.rect.y, width: spec.rect.width, height: spec.rect.height });
        if (spec.selected && spec.selected.length > 0) {
          field.select(spec.multiSelect ? spec.selected : spec.selected[0]!);
        }
        break;
      }
      case 'date': {
        // Date picker = text field + AFDate format action (honored by full-featured viewers).
        const field = form.createTextField(spec.name);
        if (spec.required) field.enableRequired();
        field.addToPage(page, { ...common, x: spec.rect.x, y: spec.rect.y, width: spec.rect.width, height: spec.rect.height });
        const format = spec.format ?? 'dd/mm/yyyy';
        const acroField = field.acroField.dict;
        const aa = doc.context.obj({
          K: doc.context.obj({
            S: 'JavaScript',
            JS: PDFHexString.fromText(`AFDate_KeystrokeEx("${format}");`)
          }),
          F: doc.context.obj({
            S: 'JavaScript',
            JS: PDFHexString.fromText(`AFDate_FormatEx("${format}");`)
          })
        });
        acroField.set(PDFName.of('AA'), aa);
        break;
      }
      case 'signature': {
        // pdf-lib has no createSignature — build the field dict directly.
        const sigField = doc.context.obj({}) as PDFDict;
        sigField.set(PDFName.of('FT'), PDFName.of('Sig'));
        sigField.set(PDFName.of('T'), PDFHexString.fromText(spec.name));
        sigField.set(PDFName.of('Type'), PDFName.of('Annot'));
        sigField.set(PDFName.of('Subtype'), PDFName.of('Widget'));
        sigField.set(
          PDFName.of('Rect'),
          doc.context.obj([spec.rect.x, spec.rect.y, spec.rect.x + spec.rect.width, spec.rect.y + spec.rect.height])
        );
        sigField.set(PDFName.of('F'), doc.context.obj(4));
        sigField.set(PDFName.of('P'), page.ref);
        const sigRef = doc.context.register(sigField);

        // Add to page Annots and AcroForm Fields.
        const annotsRaw = page.node.lookup(PDFName.of('Annots'));
        if (annotsRaw instanceof PDFArray) {
          annotsRaw.push(sigRef);
        } else {
          page.node.set(PDFName.of('Annots'), doc.context.obj([sigRef]));
        }
        const fields = form.acroForm.dict.lookup(PDFName.of('Fields'));
        if (fields instanceof PDFArray) {
          fields.push(sigRef);
        }
        break;
      }
    }
  }

  // Regenerate appearances so fields render everywhere.
  try {
    form.updateFieldAppearances();
  } catch {
    // Some field combinations lack default appearances; non-fatal.
  }
  return doc.save();
}

export interface FormFieldValue {
  name: string;
  type: string;
  value: string | boolean | string[];
}

export async function readFormData(bytes: Uint8Array): Promise<FormFieldValue[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const form = doc.getForm();
  const out: FormFieldValue[] = [];
  for (const field of form.getFields()) {
    const name = field.getName();
    const ctor = field.constructor.name;
    try {
      if (ctor === 'PDFTextField') {
        out.push({ name, type: 'text', value: form.getTextField(name).getText() ?? '' });
      } else if (ctor === 'PDFCheckBox') {
        out.push({ name, type: 'checkbox', value: form.getCheckBox(name).isChecked() });
      } else if (ctor === 'PDFRadioGroup') {
        out.push({ name, type: 'radio', value: form.getRadioGroup(name).getSelected() ?? '' });
      } else if (ctor === 'PDFDropdown') {
        out.push({ name, type: 'dropdown', value: form.getDropdown(name).getSelected()[0] ?? '' });
      } else if (ctor === 'PDFOptionList') {
        out.push({ name, type: 'listbox', value: form.getOptionList(name).getSelected() });
      } else if (ctor === 'PDFSignature') {
        out.push({ name, type: 'signature', value: '' });
      }
    } catch {
      // Skip malformed fields rather than failing the whole read.
    }
  }
  return out;
}

export async function fillFormData(
  bytes: Uint8Array,
  values: Array<{ name: string; value: string | boolean | string[] }>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const form = doc.getForm();
  for (const { name, value } of values) {
    try {
      const field = form.getField(name);
      const ctor = field.constructor.name;
      if (ctor === 'PDFTextField' && typeof value === 'string') {
        form.getTextField(name).setText(value);
      } else if (ctor === 'PDFCheckBox' && typeof value === 'boolean') {
        const cb = form.getCheckBox(name);
        if (value) cb.check();
        else cb.uncheck();
      } else if (ctor === 'PDFRadioGroup' && typeof value === 'string' && value) {
        form.getRadioGroup(name).select(value);
      } else if (ctor === 'PDFDropdown' && typeof value === 'string' && value) {
        form.getDropdown(name).select(value);
      } else if (ctor === 'PDFOptionList' && Array.isArray(value)) {
        form.getOptionList(name).select(value);
      }
    } catch {
      // Unknown field names are skipped (import tolerance).
    }
  }
  try {
    form.updateFieldAppearances();
  } catch {
    /* non-fatal */
  }
  return doc.save();
}

/** Flattens all form fields into page content (values become static). */
export async function flattenForm(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  doc.getForm().flatten();
  return doc.save();
}

export function formDataToJson(values: FormFieldValue[]): string {
  return JSON.stringify({ vikingsFormData: 1, fields: values }, null, 2);
}

export function formDataFromJson(json: string): Array<{ name: string; value: string | boolean | string[] }> {
  const parsed = JSON.parse(json) as { fields?: Array<{ name: string; value: string | boolean | string[] }> };
  if (!parsed.fields) throw new Error('Not a Vikings form data file');
  return parsed.fields;
}

export { hexToRgb as _formColorUtil };
