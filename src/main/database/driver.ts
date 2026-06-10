/**
 * Database driver abstraction. Primary driver wraps better-sqlite3 (WAL mode);
 * if the native module cannot load (e.g. ABI mismatch before a rebuild), a
 * null driver keeps the application running with in-memory defaults and the
 * failure is surfaced through the logger — graceful degradation, not a crash.
 */
import type { Logger } from '../services/logger';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export interface DatabaseDriver {
  readonly kind: 'sqlite' | 'null';
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): RunResult;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  transaction(fn: () => void): void;
  pragma(name: string): unknown;
  close(): void;
}

class NullDriver implements DatabaseDriver {
  readonly kind = 'null' as const;
  exec(): void {}
  run(): RunResult {
    return { changes: 0, lastInsertRowid: 0 };
  }
  get<T>(): T | undefined {
    return undefined;
  }
  all<T>(): T[] {
    return [];
  }
  transaction(fn: () => void): void {
    fn();
  }
  pragma(): unknown {
    return undefined;
  }
  close(): void {}
}

export function createDriver(dbPath: string, logger: Logger): DatabaseDriver {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3');
    const db = new BetterSqlite3(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    logger.info('database', `SQLite open at ${dbPath}`);

    return {
      kind: 'sqlite',
      exec: (sql) => db.exec(sql),
      run: (sql, params = []) => {
        const result = db.prepare(sql).run(...(params as never[]));
        return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
      },
      get: <T>(sql: string, params: unknown[] = []) =>
        db.prepare(sql).get(...(params as never[])) as T | undefined,
      all: <T>(sql: string, params: unknown[] = []) => db.prepare(sql).all(...(params as never[])) as T[],
      transaction: (fn) => db.transaction(fn)(),
      pragma: (name) => db.pragma(name),
      close: () => db.close()
    };
  } catch (e) {
    logger.error('database', 'better-sqlite3 failed to load — running without persistence', {
      error: (e as Error).message
    });
    return new NullDriver();
  }
}
