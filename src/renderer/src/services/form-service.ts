/** Form designer service — commits field drafts into real AcroForm fields. */
import { addFormFields, readFormData, fillFormData, flattenForm, formDataToJson, formDataFromJson, type FormFieldSpec } from '@core/pdf/form-builder';
import { documentService } from './document-service';
import { useFormsStore, toast } from '../stores/ui-stores';
import { ipc } from './ipc';

async function pageHeight(docId: string, pageIndex: number): Promise<number> {
  const runtime = documentService.runtime(docId);
  if (!runtime) throw new Error('Document is not open');
  const page = await runtime.pdf.getPage(pageIndex + 1);
  return page.getViewport({ scale: 1 }).height;
}

export const formService = {
  async commitDrafts(docId: string): Promise<number> {
    const drafts = useFormsStore.getState().byDoc[docId] ?? [];
    if (drafts.length === 0) return 0;
    const specs: FormFieldSpec[] = [];
    for (const d of drafts) {
      const H = await pageHeight(docId, d.pageIndex);
      const rect = { x: d.x, y: H - d.y - d.h, width: d.w, height: d.h }; // y-down → y-up
      switch (d.kind) {
        case 'text':
          specs.push({ kind: 'text', name: d.name, pageIndex: d.pageIndex, rect, multiline: d.multiline, required: d.required });
          break;
        case 'checkbox':
          specs.push({ kind: 'checkbox', name: d.name, pageIndex: d.pageIndex, rect, required: d.required });
          break;
        case 'radio': {
          const options = (d.options.length > 0 ? d.options : ['Option 1', 'Option 2']).map((value, i) => ({
            value,
            rect: { ...rect, x: rect.x + i * (d.h + 8), width: d.h, height: d.h }
          }));
          specs.push({ kind: 'radio', name: d.name, pageIndex: d.pageIndex, options, required: d.required });
          break;
        }
        case 'dropdown':
          specs.push({ kind: 'dropdown', name: d.name, pageIndex: d.pageIndex, rect, options: d.options, required: d.required });
          break;
        case 'listbox':
          specs.push({ kind: 'listbox', name: d.name, pageIndex: d.pageIndex, rect, options: d.options, multiSelect: true, required: d.required });
          break;
        case 'date':
          specs.push({ kind: 'date', name: d.name, pageIndex: d.pageIndex, rect, required: d.required });
          break;
        case 'signature':
          specs.push({ kind: 'signature', name: d.name, pageIndex: d.pageIndex, rect, required: d.required });
          break;
      }
    }
    await documentService.applyOperation(docId, 'Add form fields', (bytes) => addFormFields(bytes, specs));
    useFormsStore.getState().clear(docId);
    toast.success('Form fields added', `${specs.length} field(s) created`);
    return specs.length;
  },

  async exportData(docId: string): Promise<void> {
    const runtime = documentService.runtime(docId);
    if (!runtime) return;
    const data = await readFormData(runtime.bytes);
    if (data.length === 0) {
      toast.warning('No form fields', 'This document has no fillable fields.');
      return;
    }
    const target = await ipc.files.saveDialog({
      title: 'Export Form Data',
      filters: [{ name: 'Form Data (JSON)', extensions: ['json'] }],
      defaultPath: 'form-data.json'
    });
    if (!target) return;
    await ipc.files.write(target, new TextEncoder().encode(formDataToJson(data)));
    toast.success('Form data exported', target);
  },

  async importData(docId: string): Promise<void> {
    const paths = await ipc.files.openDialog({
      title: 'Import Form Data',
      filters: [{ name: 'Form Data (JSON)', extensions: ['json'] }]
    });
    if (!paths || paths.length === 0) return;
    const json = new TextDecoder().decode(await ipc.files.read(paths[0]!));
    const values = formDataFromJson(json);
    await documentService.applyOperation(docId, 'Fill form', (bytes) => fillFormData(bytes, values));
    toast.success('Form data imported', `${values.length} field(s) filled`);
  },

  async flatten(docId: string): Promise<void> {
    await documentService.applyOperation(docId, 'Flatten form', (bytes) => flattenForm(bytes));
    toast.success('Form flattened', 'Fields are now static page content');
  }
};
