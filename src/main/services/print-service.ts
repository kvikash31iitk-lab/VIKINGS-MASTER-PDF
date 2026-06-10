/**
 * Print service — loads the PDF into a hidden window backed by Chromium's
 * native PDF plugin and drives the system print pipeline.
 */
import { BrowserWindow } from 'electron';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PrintRequest } from '../../shared/types';
import type { Logger } from './logger';

export class PrintService {
  constructor(private logger: Logger) {}

  async print(req: PrintRequest): Promise<void> {
    let path = req.path;
    let tempFile: string | null = null;
    if (!path) {
      if (!req.bytes) throw new Error('Print requires a path or bytes');
      tempFile = join(tmpdir(), `vikings-print-${Date.now()}.pdf`);
      await writeFile(tempFile, req.bytes);
      path = tempFile;
    }

    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        plugins: true // Chromium PDF viewer
      }
    });

    try {
      await win.loadURL(pathToFileURL(path).toString());
      // Let the PDF plugin finish rendering before printing.
      await new Promise((resolve) => setTimeout(resolve, 800));
      await new Promise<void>((resolve, reject) => {
        win.webContents.print(
          {
            silent: req.silent ?? false,
            printBackground: true,
            copies: req.copies ?? 1
          },
          (success, failureReason) => {
            if (success) resolve();
            else reject(new Error(failureReason || 'Print cancelled'));
          }
        );
      });
      this.logger.audit('doc.print', { path });
    } finally {
      win.destroy();
      if (tempFile) await unlink(tempFile).catch(() => undefined);
    }
  }
}
