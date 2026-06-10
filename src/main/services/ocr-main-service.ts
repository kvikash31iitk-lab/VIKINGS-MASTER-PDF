/**
 * OCR service — tesseract.js running in the main process (its recognition
 * work happens on internal worker threads, so the event loop stays live).
 * Language data is cached under userData/tessdata; downloads happen here,
 * outside the renderer's CSP. Offline deployments can drop *.traineddata.gz
 * files into that folder manually.
 */
import { createWorker, type Worker } from 'tesseract.js';
import { mkdirSync, readdirSync } from 'node:fs';
import type { Logger } from './logger';
import type { OcrWord } from '../../core/ocr/searchable-overlay';

export type OcrMode = 'fast' | 'balanced' | 'accurate';

export interface RecognizeRequest {
  imagePng: Uint8Array;
  languages: string[];
  mode: OcrMode;
}

export interface RecognizeResult {
  words: OcrWord[];
  text: string;
  confidence: number;
}

export class OcrMainService {
  private workers = new Map<string, Promise<Worker>>();

  constructor(
    private tessdataDir: string,
    private logger: Logger
  ) {
    mkdirSync(tessdataDir, { recursive: true });
  }

  private async getWorker(languages: string[]): Promise<Worker> {
    const key = [...languages].sort().join('+') || 'eng';
    let workerPromise = this.workers.get(key);
    if (!workerPromise) {
      workerPromise = (async () => {
        this.logger.info('ocr', `Creating tesseract worker for ${key}`);
        const worker = await createWorker(languages.length > 0 ? languages : ['eng'], 1, {
          cachePath: this.tessdataDir,
          gzip: true
        });
        return worker;
      })();
      this.workers.set(key, workerPromise);
      workerPromise.catch(() => this.workers.delete(key));
    }
    return workerPromise;
  }

  async recognize(req: RecognizeRequest): Promise<RecognizeResult> {
    const worker = await this.getWorker(req.languages);
    const started = Date.now();
    const result = await worker.recognize(Buffer.from(req.imagePng));
    this.logger.debug('ocr', `Page recognized in ${Date.now() - started}ms`, {
      confidence: result.data.confidence
    });

    const words: OcrWord[] = (result.data.words ?? []).map((w) => ({
      text: w.text,
      x0: w.bbox.x0,
      y0: w.bbox.y0,
      x1: w.bbox.x1,
      y1: w.bbox.y1,
      confidence: w.confidence
    }));
    return { words, text: result.data.text, confidence: result.data.confidence };
  }

  listCachedLanguages(): string[] {
    try {
      return readdirSync(this.tessdataDir)
        .filter((f) => f.endsWith('.traineddata') || f.endsWith('.traineddata.gz'))
        .map((f) => f.replace(/\.traineddata(\.gz)?$/, ''));
    } catch {
      return [];
    }
  }

  async dispose(): Promise<void> {
    for (const [, workerPromise] of this.workers) {
      try {
        const worker = await workerPromise;
        await worker.terminate();
      } catch {
        /* already gone */
      }
    }
    this.workers.clear();
  }
}
