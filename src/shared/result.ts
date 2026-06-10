/**
 * Result type used at every IPC boundary — exceptions never cross the bridge raw.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export interface AppError {
  code: string;
  message: string;
  detail?: string;
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T = never>(code: string, message: string, detail?: string): Result<T> {
  return { ok: false, error: { code, message, ...(detail !== undefined ? { detail } : {}) } };
}

export function wrapError<T = never>(e: unknown, code = 'E_INTERNAL'): Result<T> {
  if (e instanceof Error) {
    return err(code, e.message, e.stack);
  }
  return err(code, String(e));
}

/** Unwraps a Result or throws — for call sites that prefer exceptions. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  const e = new Error(result.error.message);
  e.name = result.error.code;
  throw e;
}

export const ErrorCodes = {
  INTERNAL: 'E_INTERNAL',
  NOT_FOUND: 'E_NOT_FOUND',
  ACCESS_DENIED: 'E_ACCESS_DENIED',
  INVALID_INPUT: 'E_INVALID_INPUT',
  CANCELLED: 'E_CANCELLED',
  IO: 'E_IO',
  ENCRYPTED: 'E_ENCRYPTED',
  WRONG_PASSWORD: 'E_WRONG_PASSWORD',
  UNSUPPORTED: 'E_UNSUPPORTED',
  CONVERTER_MISSING: 'E_CONVERTER_MISSING',
  NETWORK: 'E_NETWORK',
  PLUGIN: 'E_PLUGIN'
} as const;
