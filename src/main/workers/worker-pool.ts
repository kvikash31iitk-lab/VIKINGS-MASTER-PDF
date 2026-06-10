/**
 * Worker pool — lazily spawns up to N pdf-workers, queues jobs, correlates
 * responses by job id, and forwards batch progress callbacks.
 */
import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { cpus } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { WorkerRequest, WorkerResponse } from './worker-protocol';
import type { BatchProgressEvent, SignatureVerificationResult } from '../../shared/types';
import type { Logger } from '../services/logger';

interface PendingJob {
  resolve: (value: { bytes?: Uint8Array; verifications?: SignatureVerificationResult[] }) => void;
  reject: (error: Error & { code?: string }) => void;
  onProgress?: (event: BatchProgressEvent) => void;
  worker: Worker;
}

interface QueuedJob {
  request: Exclude<WorkerRequest, { kind: 'cancel' }>;
  pending: Omit<PendingJob, 'worker'>;
}

export class WorkerPool {
  private workers: Array<{ worker: Worker; busy: number }> = [];
  private pending = new Map<string, PendingJob>();
  private queue: QueuedJob[] = [];
  private readonly maxWorkers: number;

  constructor(
    private logger: Logger,
    configuredWorkers = 0
  ) {
    const auto = Math.max(1, Math.min(4, cpus().length - 1));
    this.maxWorkers = configuredWorkers > 0 ? Math.min(configuredWorkers, 8) : auto;
  }

  private spawn(): { worker: Worker; busy: number } {
    const worker = new Worker(join(__dirname, 'workers/pdf-worker.js'));
    const entry = { worker, busy: 0 };
    worker.on('message', (msg: WorkerResponse) => this.onMessage(entry, msg));
    worker.on('error', (e) => {
      this.logger.error('worker-pool', 'Worker crashed', { error: e.message });
      // Fail everything pending on this worker.
      for (const [jobId, job] of this.pending) {
        if (job.worker === worker) {
          job.reject(Object.assign(new Error(`Worker crashed: ${e.message}`), { code: 'E_INTERNAL' }));
          this.pending.delete(jobId);
        }
      }
      this.workers = this.workers.filter((w) => w.worker !== worker);
    });
    this.workers.push(entry);
    this.logger.info('worker-pool', `Spawned PDF worker (${this.workers.length}/${this.maxWorkers})`);
    return entry;
  }

  private onMessage(entry: { worker: Worker; busy: number }, msg: WorkerResponse): void {
    const job = this.pending.get(msg.jobId);
    if (!job) return;
    if (msg.type === 'progress') {
      job.onProgress?.(msg.event);
      if (msg.event.status === 'done' || msg.event.status === 'cancelled') {
        this.pending.delete(msg.jobId);
        entry.busy--;
        job.resolve({});
        this.drain();
      }
      return;
    }
    this.pending.delete(msg.jobId);
    entry.busy--;
    if (msg.type === 'result') {
      job.resolve({
        ...(msg.bytes ? { bytes: msg.bytes } : {}),
        ...(msg.verifications ? { verifications: msg.verifications } : {})
      });
    } else {
      job.reject(Object.assign(new Error(msg.message), { code: msg.code }));
    }
    this.drain();
  }

  private pickWorker(): { worker: Worker; busy: number } | null {
    const idle = this.workers.find((w) => w.busy === 0);
    if (idle) return idle;
    if (this.workers.length < this.maxWorkers) return this.spawn();
    return null;
  }

  private drain(): void {
    while (this.queue.length > 0) {
      const slot = this.pickWorker();
      if (!slot) return;
      const next = this.queue.shift()!;
      this.dispatch(slot, next.request, next.pending);
    }
  }

  private dispatch(
    slot: { worker: Worker; busy: number },
    request: Exclude<WorkerRequest, { kind: 'cancel' }>,
    pending: Omit<PendingJob, 'worker'>
  ): void {
    slot.busy++;
    this.pending.set(request.jobId, { ...pending, worker: slot.worker });
    slot.worker.postMessage(request);
  }

  run(
    request: Omit<Exclude<WorkerRequest, { kind: 'cancel' }>, 'jobId'> & { jobId?: string },
    onProgress?: (event: BatchProgressEvent) => void
  ): Promise<{ bytes?: Uint8Array; verifications?: SignatureVerificationResult[] }> {
    const jobId = request.jobId ?? randomUUID();
    const fullRequest = { ...request, jobId } as Exclude<WorkerRequest, { kind: 'cancel' }>;
    return new Promise((resolve, reject) => {
      const pending = { resolve, reject, ...(onProgress ? { onProgress } : {}) };
      const slot = this.pickWorker();
      if (slot) this.dispatch(slot, fullRequest, pending);
      else this.queue.push({ request: fullRequest, pending });
    });
  }

  cancel(jobId: string): void {
    const job = this.pending.get(jobId);
    job?.worker.postMessage({ jobId, kind: 'cancel' } satisfies WorkerRequest);
  }

  async dispose(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.worker.terminate()));
    this.workers = [];
  }
}
