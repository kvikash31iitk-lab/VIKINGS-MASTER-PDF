/** Structural logger type so modules can depend on the interface, not the class. */
export interface Logger {
  trace(scope: string, msg: string, meta?: unknown): void;
  debug(scope: string, msg: string, meta?: unknown): void;
  info(scope: string, msg: string, meta?: unknown): void;
  warn(scope: string, msg: string, meta?: unknown): void;
  error(scope: string, msg: string, meta?: unknown): void;
  fatal(scope: string, msg: string, meta?: unknown): void;
  audit(event: string, detail?: unknown): void;
}
