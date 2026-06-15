/**
 * Unified "open this file" entry point used by drag-and-drop, OS file
 * associations and (potentially) other import paths. PDFs open directly;
 * images and text/RTF are converted to PDF on the fly via the core writers
 * and opened as new documents; anything else gets a friendly hint.
 */
import { imagesToPdf } from '@core/convert/image-to-pdf';
import { textToPdf } from '@core/convert/text-to-pdf';
import { rtfToText } from '@core/convert/rtf';
import { documentService } from './document-service';
import { ipc, rlog } from './ipc';
import { toast, useDialogStore } from '../stores/ui-stores';
import { baseName } from '../utils';
import { classifyFile } from './file-classify';

const toPdfName = (path: string): string => baseName(path).replace(/\.[^.]+$/, '.pdf');

/** Opens (or converts-then-opens) a single absolute file path. */
export async function openFilePath(path: string): Promise<void> {
  const kind = classifyFile(path);
  try {
    switch (kind) {
      case 'pdf': {
        try {
          await documentService.openFromPath(path);
        } catch (e) {
          if ((e as Error).name === 'PasswordRequiredError') {
            useDialogStore.getState().show('password-prompt', { path });
          } else {
            throw e;
          }
        }
        return;
      }
      case 'image': {
        const bytes = await ipc.files.read(path);
        const format = /\.jpe?g$/i.test(path) ? 'jpg' : 'png';
        const pdf = await imagesToPdf([{ bytes, format }]);
        await documentService.openFromBytes(pdf, { title: toPdfName(path) });
        toast.success('Image converted to PDF', baseName(path));
        return;
      }
      case 'text':
      case 'rtf': {
        const raw = new TextDecoder().decode(await ipc.files.read(path));
        const text = kind === 'rtf' ? rtfToText(raw) : raw;
        const pdf = await textToPdf(text, { title: baseName(path) });
        await documentService.openFromBytes(pdf, { title: toPdfName(path) });
        toast.success('Document converted to PDF', baseName(path));
        return;
      }
      default:
        toast.warning(`Can't open ${baseName(path)}`, 'Use Home ▸ Create PDF to convert this file type.');
    }
  } catch (e) {
    rlog.error('file-open', `Failed to open ${path}`, { error: (e as Error).message });
    toast.error(`Could not open ${baseName(path)}`, (e as Error).message);
  }
}

/** Opens every resolved path from a drop, sequentially (keeps ordering & memory sane). */
export async function openDroppedPaths(paths: string[]): Promise<void> {
  const usable = paths.filter(Boolean);
  if (usable.length === 0) {
    toast.warning('Could not read the dropped file', 'Try File ▸ Open instead.');
    return;
  }
  for (const path of usable) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await openFilePath(path);
  }
}
