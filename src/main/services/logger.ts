/**
 * Application logger — daily files with size-capped rotation, separate error
 * and audit logs, console mirroring in development, zip export.
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WriteStream } from 'node:fs';
import JSZip from 'jszip';
import type { LogLevel } from '../../shared/types';

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATIONS = 5;

export class Logger {
  private appStream: WriteStream | null = null;
  private errorStream: WriteStream | null = null;
  private auditStream: WriteStream | null = null;
  private currentDate = '';
  private minLevel: LogLevel;

  constructor(
    private readonly logsDir: string,
    options: { minLevel?: LogLevel; mirrorToConsole?: boolean } = {}
  ) {
    this.minLevel = options.minLevel ?? 'info';
    this.mirror = options.mirrorToConsole ?? false;
    mkdirSync(logsDir, { recursive: true });
    this.openStreams();
  }

  private mirror: boolean;

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private openStreams(): void {
    this.currentDate = this.today();
    this.appStream = this.openRotated(`app-${this.currentDate}.log`);
    this.errorStream = this.openRotated('error.log');
    this.auditStream = this.openRotated('audit.log');
  }

  private openRotated(name: string): WriteStream {
    const file = join(this.logsDir, name);
    if (existsSync(file) && statSync(file).size > MAX_FILE_BYTES) {
      this.rotate(file);
    }
    return createWriteStream(file, { flags: 'a' });
  }

  /** name.log → name.log.1 … name.log.N (oldest dropped). */
  private rotate(file: string): void {
    try {
      const oldest = `${file}.${MAX_GENERATIONS}`;
      if (existsSync(oldest)) unlinkSync(oldest);
      for (let i = MAX_GENERATIONS - 1; i >= 1; i--) {
        const from = `${file}.${i}`;
        if (existsSync(from)) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('node:fs').renameSync(from, `${file}.${i + 1}`);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').renameSync(file, `${file}.1`);
    } catch {
      /* rotation is best-effort */
    }
  }

  private line(level: LogLevel, scope: string, message: string, meta?: unknown): string {
    const metaStr = meta === undefined ? '' : ` ${safeJson(meta)}`;
    return `${new Date().toISOString()} [${level.toUpperCase().padEnd(5)}] [${scope}] ${message}${metaStr}\n`;
  }

  write(level: LogLevel, scope: string, message: string, meta?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    if (this.today() !== this.currentDate) {
      this.appStream?.end();
      this.openStreams();
    }
    const text = this.line(level, scope, message, meta);
    this.appStream?.write(text);
    if (LEVEL_ORDER[level] >= LEVEL_ORDER.error) this.errorStream?.write(text);
    if (this.mirror) {
      // eslint-disable-next-line no-console
      (level === 'error' || level === 'fatal' ? console.error : console.warn)(text.trimEnd());
    }
  }

  trace(scope: string, msg: string, meta?: unknown): void { this.write('trace', scope, msg, meta); }
  debug(scope: string, msg: string, meta?: unknown): void { this.write('debug', scope, msg, meta); }
  info(scope: string, msg: string, meta?: unknown): void { this.write('info', scope, msg, meta); }
  warn(scope: string, msg: string, meta?: unknown): void { this.write('warn', scope, msg, meta); }
  error(scope: string, msg: string, meta?: unknown): void { this.write('error', scope, msg, meta); }
  fatal(scope: string, msg: string, meta?: unknown): void { this.write('fatal', scope, msg, meta); }

  /** Audit trail for security-relevant events (also mirrored to SQLite). */
  audit(event: string, detail?: unknown): void {
    const text = `${new Date().toISOString()} ${event}${detail !== undefined ? ` ${safeJson(detail)}` : ''}\n`;
    this.auditStream?.write(text);
  }

  /** Zips the entire logs directory for support export. */
  async exportLogs(targetZipPath: string): Promise<void> {
    const zip = new JSZip();
    for (const name of readdirSync(this.logsDir)) {
      const full = join(this.logsDir, name);
      if (statSync(full).isFile()) {
        zip.file(name, await readFile(full));
      }
    }
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    await writeFile(targetZipPath, bytes);
  }

  dispose(): void {
    this.appStream?.end();
    this.errorStream?.end();
    this.auditStream?.end();
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
