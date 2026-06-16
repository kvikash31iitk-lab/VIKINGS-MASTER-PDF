/**
 * File service — the only place that touches the file system on behalf of
 * the renderer. Dialogs anchor to the focused window; writes are atomic
 * (temp file + rename) so a crash can never truncate a user document.
 */
import { dialog, shell, BrowserWindow } from 'electron';
import { readFile, writeFile, rename, stat, mkdir, unlink } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import type { FileFilter, FileStatInfo, OpenDialogRequest, SaveDialogRequest } from '../../shared/types';
import type { Logger } from './logger';

export class FileService {
  constructor(private logger: Logger) {}

  async showOpenDialog(req: OpenDialogRequest): Promise<string[] | null> {
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showOpenDialog(win as BrowserWindow, {
      title: req.title ?? 'Open',
      properties: req.multi ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: (req.filters as FileFilter[]) ?? [],
      ...(req.defaultPath ? { defaultPath: req.defaultPath } : {})
    });
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths;
  }

  async showSaveDialog(req: SaveDialogRequest): Promise<string | null> {
    // Test seam: when set, skip the native dialog (used by automated export
    // tests; never set in normal use).
    if (process.env.VK_TEST_SAVE_PATH) return process.env.VK_TEST_SAVE_PATH;
    const win = BrowserWindow.getFocusedWindow() ?? undefined;
    const result = await dialog.showSaveDialog(win as BrowserWindow, {
      title: req.title ?? 'Save',
      filters: (req.filters as FileFilter[]) ?? [],
      ...(req.defaultPath ? { defaultPath: req.defaultPath } : {})
    });
    return result.canceled || !result.filePath ? null : result.filePath;
  }

  async read(path: string): Promise<Uint8Array> {
    const safe = normalize(path);
    const bytes = await readFile(safe);
    this.logger.debug('files', `read ${safe} (${bytes.length} bytes)`);
    return new Uint8Array(bytes);
  }

  /** Atomic write: write to sibling temp file, then rename over the target. */
  async write(path: string, bytes: Uint8Array): Promise<void> {
    const safe = normalize(path);
    await mkdir(dirname(safe), { recursive: true });
    const tmp = join(dirname(safe), `.vikings-tmp-${process.pid}-${Date.now()}`);
    try {
      await writeFile(tmp, bytes);
      await rename(tmp, safe);
      this.logger.info('files', `wrote ${safe} (${bytes.length} bytes)`);
    } catch (e) {
      await unlink(tmp).catch(() => undefined);
      throw e;
    }
  }

  async statInfo(path: string): Promise<FileStatInfo | null> {
    try {
      const s = await stat(path);
      return { path, size: s.size, mtimeMs: s.mtimeMs, isFile: s.isFile() };
    } catch {
      return null;
    }
  }

  showInFolder(path: string): void {
    shell.showItemInFolder(normalize(path));
  }

  async openPath(path: string): Promise<string> {
    return shell.openPath(normalize(path));
  }
}
