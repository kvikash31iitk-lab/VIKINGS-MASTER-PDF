/**
 * Minimal typed dependency-injection container for the main process.
 * Services register factories; resolution is lazy and memoized.
 */
export class Container {
  private factories = new Map<string, () => unknown>();
  private instances = new Map<string, unknown>();

  register<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }

  resolve<T>(token: string): T {
    if (this.instances.has(token)) return this.instances.get(token) as T;
    const factory = this.factories.get(token);
    if (!factory) throw new Error(`No service registered for token "${token}"`);
    const instance = factory();
    this.instances.set(token, instance);
    return instance as T;
  }

  /** Disposes instances that expose dispose()/close() — called on app quit. */
  async disposeAll(): Promise<void> {
    for (const [, instance] of this.instances) {
      const candidate = instance as { dispose?: () => unknown; close?: () => unknown };
      try {
        if (typeof candidate.dispose === 'function') await candidate.dispose();
        else if (typeof candidate.close === 'function') await candidate.close();
      } catch {
        /* best-effort shutdown */
      }
    }
    this.instances.clear();
  }
}

export const TOKENS = {
  Logger: 'logger',
  Database: 'database',
  Settings: 'settings-service',
  Files: 'file-service',
  Recents: 'recent-files-service',
  Autosave: 'autosave-service',
  Session: 'session-service',
  Print: 'print-service',
  Convert: 'convert-service',
  AiProxy: 'ai-proxy-service',
  Updates: 'update-service',
  Plugins: 'plugin-service',
  Batch: 'batch-service',
  WorkerPool: 'worker-pool',
  Galleries: 'galleries-service'
} as const;

export const container = new Container();
