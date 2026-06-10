/**
 * PDF worker (worker_threads) — executes CPU-heavy jobs off the main loop:
 * encryption, decryption, signing, verification, large merges and batch
 * pipelines. Imports only @core (no Electron APIs).
 */
import { parentPort } from 'node:worker_threads';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { encryptPdf, decryptPdf, WrongPasswordError } from '../../core/node/security/encryption';
import { signPdf } from '../../core/node/signing/signer';
import { verifySignatures } from '../../core/node/signing/verifier';
import { mergePdfs } from '../../core/pdf/page-ops';
import { applyWatermark, type WatermarkOptions } from '../../core/pdf/watermark';
import { applyHeaderFooter, type HeaderFooterOptions } from '../../core/pdf/header-footer';
import { applyBatesNumbering, type BatesOptions } from '../../core/pdf/bates';
import { compressPdf, COMPRESSION_PROFILES, type CompressionProfile } from '../../core/pdf/compression';
import type { WorkerRequest, WorkerResponse } from './worker-protocol';
import type { BatchJobRequest, BatchProgressEvent, EncryptRequest } from '../../shared/types';

if (!parentPort) {
  throw new Error('pdf-worker must run inside a worker thread');
}
const port = parentPort;

const cancelled = new Set<string>();

const respond = (msg: WorkerResponse): void => port.postMessage(msg);

port.on('message', (req: WorkerRequest) => {
  if (req.kind === 'cancel') {
    cancelled.add(req.jobId);
    return;
  }
  void handle(req).catch((e: unknown) => {
    respond({
      jobId: req.jobId,
      type: 'error',
      code: e instanceof WrongPasswordError ? 'E_WRONG_PASSWORD' : 'E_INTERNAL',
      message: (e as Error).message
    });
  });
});

async function handle(req: Exclude<WorkerRequest, { kind: 'cancel' }>): Promise<void> {
  switch (req.kind) {
    case 'encrypt': {
      const bytes = await encryptPdf(req.payload.bytes, req.payload);
      respond({ jobId: req.jobId, type: 'result', bytes });
      break;
    }
    case 'decrypt': {
      const bytes = await decryptPdf(req.payload.bytes, req.payload.password);
      respond({ jobId: req.jobId, type: 'result', bytes });
      break;
    }
    case 'sign': {
      const bytes = await signPdf(req.payload);
      respond({ jobId: req.jobId, type: 'result', bytes });
      break;
    }
    case 'verify': {
      const verifications = verifySignatures(req.payload.bytes);
      respond({ jobId: req.jobId, type: 'result', verifications });
      break;
    }
    case 'merge': {
      const bytes = await mergePdfs(req.payload.files);
      respond({ jobId: req.jobId, type: 'result', bytes });
      break;
    }
    case 'batch': {
      await runBatch(req.jobId, req.payload);
      break;
    }
  }
}

// ───────────────────────── Batch pipeline ─────────────────────────

async function runBatch(jobId: string, job: BatchJobRequest): Promise<void> {
  const progress = (event: BatchProgressEvent): void =>
    respond({ jobId, type: 'progress', event });

  await mkdir(job.outputDir, { recursive: true });
  const mergeAccumulator: Uint8Array[] = [];
  const hasMerge = job.steps.some((s) => s.kind === 'merge-into');
  let batesNext: number | undefined;

  for (let i = 0; i < job.inputPaths.length; i++) {
    if (cancelled.has(jobId)) {
      progress({ jobId, filePath: '', fileIndex: i, fileCount: job.inputPaths.length, status: 'cancelled' });
      cancelled.delete(jobId);
      return;
    }
    const inputPath = job.inputPaths[i]!;
    progress({
      jobId,
      filePath: inputPath,
      fileIndex: i,
      fileCount: job.inputPaths.length,
      status: 'running'
    });

    try {
      let bytes: Uint8Array = new Uint8Array(await readFile(inputPath));

      for (const step of job.steps) {
        if (cancelled.has(jobId)) break;
        progress({
          jobId,
          filePath: inputPath,
          fileIndex: i,
          fileCount: job.inputPaths.length,
          stepKind: step.kind,
          status: 'running'
        });
        switch (step.kind) {
          case 'watermark':
            bytes = await applyWatermark(bytes, step.options as unknown as WatermarkOptions);
            break;
          case 'header-footer':
            bytes = await applyHeaderFooter(bytes, {
              ...(step.options as unknown as HeaderFooterOptions),
              fileName: basename(inputPath)
            });
            break;
          case 'bates': {
            const options = { ...(step.options as unknown as BatesOptions) };
            if (batesNext !== undefined) options.startNumber = batesNext;
            const result = await applyBatesNumbering(bytes, options);
            bytes = result.bytes;
            batesNext = result.nextNumber; // continuous numbering across files
            break;
          }
          case 'encrypt':
            bytes = await encryptPdf(bytes, step.options as unknown as EncryptRequest);
            break;
          case 'compress': {
            const profileId = (step.options as { profile?: string }).profile ?? 'office';
            const profile: CompressionProfile =
              COMPRESSION_PROFILES[profileId] ?? COMPRESSION_PROFILES.office!;
            const result = await compressPdf(bytes, {
              profile,
              hasher: (data) => createHash('sha256').update(data).digest('hex')
            });
            bytes = result.bytes;
            break;
          }
          case 'merge-into':
            mergeAccumulator.push(bytes);
            break;
          case 'rename':
            break; // handled at output naming
        }
      }

      if (!hasMerge) {
        const outName = applyRenamePattern(job.renamePattern, inputPath, i);
        await writeFile(join(job.outputDir, outName), bytes);
      }
      progress({
        jobId,
        filePath: inputPath,
        fileIndex: i,
        fileCount: job.inputPaths.length,
        status: 'file-done'
      });
    } catch (e) {
      progress({
        jobId,
        filePath: inputPath,
        fileIndex: i,
        fileCount: job.inputPaths.length,
        status: 'file-error',
        message: (e as Error).message
      });
    }
  }

  if (hasMerge && mergeAccumulator.length > 0) {
    const merged = await mergePdfs(mergeAccumulator);
    await writeFile(join(job.outputDir, applyRenamePattern(job.renamePattern, 'merged.pdf', 0)), merged);
  }

  progress({
    jobId,
    filePath: '',
    fileIndex: job.inputPaths.length,
    fileCount: job.inputPaths.length,
    status: 'done'
  });
}

function applyRenamePattern(pattern: string | undefined, inputPath: string, index: number): string {
  const name = basename(inputPath).replace(/\.pdf$/i, '');
  if (!pattern) return `${name}.pdf`;
  const date = new Date().toISOString().slice(0, 10);
  const out = pattern
    .replace(/\{name\}/gi, name)
    .replace(/\{n\}/gi, String(index + 1).padStart(3, '0'))
    .replace(/\{date\}/gi, date);
  return out.toLowerCase().endsWith('.pdf') ? out : `${out}.pdf`;
}
