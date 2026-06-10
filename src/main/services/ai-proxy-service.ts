/**
 * AI network proxy — the renderer is network-isolated by CSP, so all AI
 * provider HTTP traffic flows through here. Streaming bodies are forwarded
 * chunk-by-chunk over IPC, tagged with the request id.
 */
import type { WebContents } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import type { AiProxyRequest, AiProxyChunk } from '../../shared/types';
import type { Logger } from './logger';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export class AiProxyService {
  private active = new Map<string, AbortController>();

  constructor(private logger: Logger) {}

  async request(sender: WebContents, req: AiProxyRequest): Promise<void> {
    const send = (chunk: AiProxyChunk): void => {
      if (!sender.isDestroyed()) sender.send(IPC.AiProxyChunk, chunk);
    };

    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      send({ requestId: req.requestId, kind: 'error', error: 'Invalid provider URL' });
      return;
    }
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      send({ requestId: req.requestId, kind: 'error', error: `Blocked protocol ${url.protocol}` });
      return;
    }

    const controller = new AbortController();
    this.active.set(req.requestId, controller);
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? 120000);

    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        ...(req.body !== undefined ? { body: req.body } : {}),
        signal: controller.signal
      });

      if (!response.ok && !response.body) {
        send({
          requestId: req.requestId,
          kind: 'error',
          status: response.status,
          error: `Provider returned HTTP ${response.status}`
        });
        return;
      }

      if (req.stream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          send({ requestId: req.requestId, kind: 'chunk', data: decoder.decode(value, { stream: true }) });
        }
        send({ requestId: req.requestId, kind: 'done', status: response.status });
      } else {
        const text = await response.text();
        send({ requestId: req.requestId, kind: 'chunk', data: text });
        send({ requestId: req.requestId, kind: 'done', status: response.status });
      }
    } catch (e) {
      const aborted = (e as Error).name === 'AbortError';
      this.logger.warn('ai-proxy', `request ${req.requestId} ${aborted ? 'aborted' : 'failed'}`, {
        error: (e as Error).message
      });
      send({
        requestId: req.requestId,
        kind: 'error',
        error: aborted ? 'Request timed out or was cancelled' : (e as Error).message
      });
    } finally {
      clearTimeout(timeout);
      this.active.delete(req.requestId);
    }
  }

  cancel(requestId: string): void {
    this.active.get(requestId)?.abort();
  }

  dispose(): void {
    for (const [, controller] of this.active) controller.abort();
    this.active.clear();
  }
}
