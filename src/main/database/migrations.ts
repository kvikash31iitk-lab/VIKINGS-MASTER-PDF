/**
 * Schema migrations — applied sequentially inside a transaction;
 * PRAGMA user_version tracks the level. See docs/DATABASE-SCHEMA.md.
 */
import type { DatabaseDriver } from './driver';
import type { Logger } from '../services/logger';

const MIGRATIONS: string[] = [
  // 001 — settings
  `CREATE TABLE IF NOT EXISTS settings (
     key        TEXT PRIMARY KEY,
     value      TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  // 002 — recent files
  `CREATE TABLE IF NOT EXISTS recent_files (
     path        TEXT PRIMARY KEY,
     title       TEXT NOT NULL,
     page_count  INTEGER NOT NULL DEFAULT 0,
     file_size   INTEGER NOT NULL DEFAULT 0,
     pinned      INTEGER NOT NULL DEFAULT 0,
     favorite    INTEGER NOT NULL DEFAULT 0,
     last_page   INTEGER NOT NULL DEFAULT 1,
     last_zoom   REAL    NOT NULL DEFAULT 1.0,
     opened_at   INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_recent_opened ON recent_files(opened_at DESC);`,
  // 003 — ocr history
  `CREATE TABLE IF NOT EXISTS ocr_history (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     file_path   TEXT NOT NULL,
     languages   TEXT NOT NULL,
     mode        TEXT NOT NULL,
     page_count  INTEGER NOT NULL,
     duration_ms INTEGER NOT NULL,
     mean_confidence REAL,
     created_at  INTEGER NOT NULL
   );`,
  // 004 — templates
  `CREATE TABLE IF NOT EXISTS templates (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     category    TEXT NOT NULL,
     description TEXT,
     data        BLOB NOT NULL,
     created_at  INTEGER NOT NULL
   );`,
  // 005 — ai history
  `CREATE TABLE IF NOT EXISTS ai_history (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     doc_path    TEXT,
     provider    TEXT NOT NULL,
     action      TEXT NOT NULL,
     prompt      TEXT NOT NULL,
     response    TEXT NOT NULL,
     created_at  INTEGER NOT NULL
   );`,
  // 006 — signatures
  `CREATE TABLE IF NOT EXISTS signatures (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     kind        TEXT NOT NULL,
     image_png   BLOB NOT NULL,
     created_at  INTEGER NOT NULL
   );`,
  // 007 — stamps
  `CREATE TABLE IF NOT EXISTS stamps (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     config      TEXT NOT NULL,
     created_at  INTEGER NOT NULL
   );`,
  // 008 — plugin data
  `CREATE TABLE IF NOT EXISTS plugin_data (
     plugin_id   TEXT NOT NULL,
     key         TEXT NOT NULL,
     value       TEXT NOT NULL,
     updated_at  INTEGER NOT NULL,
     PRIMARY KEY (plugin_id, key)
   );`,
  // 009 — versions
  `CREATE TABLE IF NOT EXISTS versions (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     doc_path     TEXT NOT NULL,
     version_file TEXT NOT NULL,
     reason       TEXT NOT NULL,
     file_size    INTEGER NOT NULL,
     created_at   INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_versions_doc ON versions(doc_path, created_at DESC);`,
  // 010 — session
  `CREATE TABLE IF NOT EXISTS sessions (
     id          INTEGER PRIMARY KEY CHECK (id = 1),
     state       TEXT NOT NULL,
     clean_exit  INTEGER NOT NULL DEFAULT 1,
     updated_at  INTEGER NOT NULL
   );`,
  // 011 — audit log
  `CREATE TABLE IF NOT EXISTS audit_log (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     event       TEXT NOT NULL,
     detail      TEXT,
     created_at  INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at DESC);`
];

export function runMigrations(db: DatabaseDriver, logger: Logger): void {
  if (db.kind === 'null') return;
  const current = Number((db.pragma('user_version') as Array<{ user_version: number }>)[0]?.user_version ?? 0);
  if (current >= MIGRATIONS.length) return;
  db.transaction(() => {
    for (let v = current; v < MIGRATIONS.length; v++) {
      db.exec(MIGRATIONS[v]!);
      logger.info('database', `Applied migration ${v + 1}/${MIGRATIONS.length}`);
    }
    db.exec(`PRAGMA user_version = ${MIGRATIONS.length}`);
  });
}
