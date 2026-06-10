/**
 * Main-process conversion capabilities:
 *  - HTML → PDF via offscreen BrowserWindow.printToPDF
 *  - Office → PDF via LibreOffice headless when present (probed once)
 *  - Clipboard content extraction for "PDF from clipboard"
 */
import { BrowserWindow, clipboard } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { HtmlToPdfRequest, OfficeToPdfRequest, ClipboardPdfContent } from '../../shared/types';
import type { Logger } from './logger';

const execFileAsync = promisify(execFile);

const SOFFICE_CANDIDATES = [
  'soffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/usr/bin/soffice',
  '/usr/local/bin/soffice',
  '/opt/libreoffice/program/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice'
];

export class ConvertService {
  private sofficePath: string | null | undefined; // undefined = not probed yet

  constructor(private logger: Logger) {}

  async htmlToPdf(req: HtmlToPdfRequest): Promise<Uint8Array> {
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: true,
        offscreen: true
      }
    });
    try {
      if (req.url) {
        await win.loadURL(req.url);
      } else {
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(req.html ?? '<html><body></body></html>')}`;
        await win.loadURL(dataUrl);
      }
      // Give late layout (web fonts/images) a beat to settle.
      await new Promise((resolve) => setTimeout(resolve, 250));
      const marginsMm = req.marginsMm ?? 12;
      const buffer = await win.webContents.printToPDF({
        landscape: req.landscape ?? false,
        pageSize: req.pageSize ?? 'A4',
        printBackground: true,
        margins: {
          top: marginsMm / 25.4,
          bottom: marginsMm / 25.4,
          left: marginsMm / 25.4,
          right: marginsMm / 25.4
        }
      });
      return new Uint8Array(buffer);
    } finally {
      win.destroy();
    }
  }

  async probeOffice(): Promise<{ available: boolean; path?: string }> {
    if (this.sofficePath !== undefined) {
      return this.sofficePath
        ? { available: true, path: this.sofficePath }
        : { available: false };
    }
    for (const candidate of SOFFICE_CANDIDATES) {
      try {
        if (candidate.includes('/') || candidate.includes('\\')) {
          if (!existsSync(candidate)) continue;
          await execFileAsync(candidate, ['--version'], { timeout: 15000 });
        } else {
          await execFileAsync(candidate, ['--version'], { timeout: 15000 });
        }
        this.sofficePath = candidate;
        this.logger.info('convert', `LibreOffice found at ${candidate}`);
        return { available: true, path: candidate };
      } catch {
        continue;
      }
    }
    this.sofficePath = null;
    this.logger.warn('convert', 'LibreOffice not found — Office→PDF conversion unavailable');
    return { available: false };
  }

  async officeToPdf(req: OfficeToPdfRequest): Promise<string> {
    const probe = await this.probeOffice();
    if (!probe.available || !probe.path) {
      throw new Error(
        'LibreOffice is required for Office document conversion. Install it from libreoffice.org and try again.'
      );
    }
    await mkdir(req.outputDir, { recursive: true });
    await execFileAsync(
      probe.path,
      ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', req.outputDir, req.inputPath],
      { timeout: 180000 }
    );
    const produced = join(req.outputDir, basename(req.inputPath).replace(/\.[^.]+$/, '.pdf'));
    if (!existsSync(produced)) {
      throw new Error(`Conversion did not produce the expected file: ${produced}`);
    }
    return produced;
  }

  readClipboardForPdf(): ClipboardPdfContent {
    const image = clipboard.readImage();
    if (!image.isEmpty()) {
      return { imagePng: new Uint8Array(image.toPNG()) };
    }
    const text = clipboard.readText();
    return { text };
  }

  async readProducedFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path));
  }
}
