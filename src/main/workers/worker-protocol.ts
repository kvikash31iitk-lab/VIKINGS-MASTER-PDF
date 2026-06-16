/** Message protocol between the main process and the PDF worker pool. */
import type {
  EncryptRequest,
  DecryptRequest,
  SignRequest,
  BatchJobRequest,
  BatchProgressEvent,
  SignatureVerificationResult
} from '../../shared/types';
import type { PdfOpDescriptor } from '../../core/pdf/op-runner';

export type WorkerRequest =
  | { jobId: string; kind: 'encrypt'; payload: EncryptRequest }
  | { jobId: string; kind: 'decrypt'; payload: DecryptRequest }
  | { jobId: string; kind: 'sign'; payload: SignRequest }
  | { jobId: string; kind: 'verify'; payload: { bytes: Uint8Array } }
  | { jobId: string; kind: 'merge'; payload: { files: Uint8Array[] } }
  | { jobId: string; kind: 'apply-op'; payload: { bytes: Uint8Array; op: PdfOpDescriptor } }
  | { jobId: string; kind: 'batch'; payload: BatchJobRequest }
  | { jobId: string; kind: 'cancel' };

export type WorkerResponse =
  | { jobId: string; type: 'result'; bytes?: Uint8Array; verifications?: SignatureVerificationResult[] }
  | { jobId: string; type: 'error'; code: string; message: string }
  | { jobId: string; type: 'progress'; event: BatchProgressEvent };
