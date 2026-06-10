# Vikings Master PDF — Database Schema

Engine: **SQLite** (better-sqlite3, WAL mode) — file: `userData/vikings.db`.
All migrations live in `src/main/database/migrations.ts` and run at startup inside a
transaction; `schema_version` tracks the applied level. A JSON fallback driver implements the
same `DatabaseDriver` interface for environments where the native module cannot load.

```sql
-- 001 ─ settings: dot-notation keys, JSON-encoded values
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,            -- JSON
  updated_at INTEGER NOT NULL          -- unix ms
);

-- 002 ─ recent files / pinned / favorites
CREATE TABLE recent_files (
  path        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  page_count  INTEGER NOT NULL DEFAULT 0,
  file_size   INTEGER NOT NULL DEFAULT 0,
  pinned      INTEGER NOT NULL DEFAULT 0,
  favorite    INTEGER NOT NULL DEFAULT 0,
  last_page   INTEGER NOT NULL DEFAULT 1,   -- restore reading position
  last_zoom   REAL    NOT NULL DEFAULT 1.0,
  opened_at   INTEGER NOT NULL
);
CREATE INDEX idx_recent_opened ON recent_files(opened_at DESC);

-- 003 ─ OCR history
CREATE TABLE ocr_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path   TEXT NOT NULL,
  languages   TEXT NOT NULL,           -- JSON array
  mode        TEXT NOT NULL,           -- fast | balanced | accurate
  page_count  INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  mean_confidence REAL,
  created_at  INTEGER NOT NULL
);

-- 004 ─ templates (form/page templates, generated or user-saved)
CREATE TABLE templates (
  id          TEXT PRIMARY KEY,        -- uuid
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,           -- blank | letterhead | invoice | form | custom
  description TEXT,
  data        BLOB NOT NULL,           -- PDF bytes
  created_at  INTEGER NOT NULL
);

-- 005 ─ AI conversation history
CREATE TABLE ai_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_path    TEXT,
  provider    TEXT NOT NULL,
  action      TEXT NOT NULL,           -- summarize | keypoints | actions | faq | chat
  prompt      TEXT NOT NULL,
  response    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

-- 006 ─ saved signatures (drawn/typed/uploaded images, never private keys)
CREATE TABLE signatures (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,           -- draw | type | upload
  image_png   BLOB NOT NULL,
  created_at  INTEGER NOT NULL
);

-- 007 ─ custom stamps
CREATE TABLE stamps (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  config      TEXT NOT NULL,           -- JSON StampDefinition
  created_at  INTEGER NOT NULL
);

-- 008 ─ plugin data (namespaced key/value per plugin)
CREATE TABLE plugin_data (
  plugin_id   TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,           -- JSON
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (plugin_id, key)
);

-- 009 ─ autosave version history
CREATE TABLE versions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_path    TEXT NOT NULL,
  version_file TEXT NOT NULL,          -- file under userData/versions/
  reason      TEXT NOT NULL,           -- autosave | manual | pre-destructive
  file_size   INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_versions_doc ON versions(doc_path, created_at DESC);

-- 010 ─ session state for crash recovery / restore
CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton row
  state       TEXT NOT NULL,           -- JSON SessionState
  clean_exit  INTEGER NOT NULL DEFAULT 1,
  updated_at  INTEGER NOT NULL
);

-- 011 ─ audit log (security-relevant events)
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event       TEXT NOT NULL,           -- doc.open | doc.save | sec.encrypt | sec.sign | ...
  detail      TEXT,                    -- JSON
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_audit_time ON audit_log(created_at DESC);
```

## Repositories

| Repository             | Table(s)        | Main consumers                  |
| ---------------------- | --------------- | -------------------------------- |
| `SettingsRepository`   | settings        | SettingsService, all modules     |
| `RecentFilesRepository`| recent_files    | Home module, session restore     |
| `OcrHistoryRepository` | ocr_history     | OCR module                       |
| `TemplatesRepository`  | templates       | Home / Forms                     |
| `AiHistoryRepository`  | ai_history      | AI assistant                     |
| `SignaturesRepository` | signatures      | eSign module                     |
| `StampsRepository`     | stamps          | Stamps designer                  |
| `PluginDataRepository` | plugin_data     | Plugin runtime                   |
| `VersionsRepository`   | versions        | Autosave / version history       |
| `SessionRepository`    | sessions        | Crash recovery, session restore  |
| `AuditRepository`      | audit_log       | Logger, Protect module           |
