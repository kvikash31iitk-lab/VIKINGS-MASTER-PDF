/**
 * Repository layer — one class per aggregate, all SQL lives here.
 */
import type { DatabaseDriver } from './driver';
import type {
  RecentFileEntry,
  OcrHistoryEntry,
  AiHistoryEntry,
  TemplateMeta,
  SavedSignature,
  StampDefinition,
  VersionEntry,
  SessionState,
  AuditEntry
} from '../../shared/types';

const now = (): number => Date.now();

// ───────────────────────── Settings ─────────────────────────

export class SettingsRepository {
  constructor(private db: DatabaseDriver) {}

  getAll(): Array<[string, unknown]> {
    return this.db
      .all<{ key: string; value: string }>('SELECT key, value FROM settings')
      .map((r) => [r.key, JSON.parse(r.value)] as [string, unknown]);
  }

  set(key: string, value: unknown): void {
    this.db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), now()]
    );
  }

  reset(): void {
    this.db.run('DELETE FROM settings');
  }
}

// ───────────────────────── Recent files ─────────────────────────

interface RecentRow {
  path: string;
  title: string;
  page_count: number;
  file_size: number;
  pinned: number;
  favorite: number;
  last_page: number;
  last_zoom: number;
  opened_at: number;
}

const toRecent = (r: RecentRow): RecentFileEntry => ({
  path: r.path,
  title: r.title,
  pageCount: r.page_count,
  fileSize: r.file_size,
  pinned: !!r.pinned,
  favorite: !!r.favorite,
  lastPage: r.last_page,
  lastZoom: r.last_zoom,
  openedAt: r.opened_at
});

export class RecentFilesRepository {
  constructor(private db: DatabaseDriver) {}

  list(limit = 30): RecentFileEntry[] {
    return this.db
      .all<RecentRow>(
        'SELECT * FROM recent_files ORDER BY pinned DESC, opened_at DESC LIMIT ?',
        [limit]
      )
      .map(toRecent);
  }

  add(entry: { path: string; title: string; pageCount: number; fileSize: number }): void {
    this.db.run(
      `INSERT INTO recent_files (path, title, page_count, file_size, opened_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         title = excluded.title, page_count = excluded.page_count,
         file_size = excluded.file_size, opened_at = excluded.opened_at`,
      [entry.path, entry.title, entry.pageCount, entry.fileSize, now()]
    );
  }

  remove(path: string): void {
    this.db.run('DELETE FROM recent_files WHERE path = ?', [path]);
  }

  setPinned(path: string, pinned: boolean): void {
    this.db.run('UPDATE recent_files SET pinned = ? WHERE path = ?', [pinned ? 1 : 0, path]);
  }

  setFavorite(path: string, favorite: boolean): void {
    this.db.run('UPDATE recent_files SET favorite = ? WHERE path = ?', [favorite ? 1 : 0, path]);
  }

  updatePosition(path: string, lastPage: number, lastZoom: number): void {
    this.db.run('UPDATE recent_files SET last_page = ?, last_zoom = ? WHERE path = ?', [
      lastPage,
      lastZoom,
      path
    ]);
  }

  clear(): void {
    this.db.run('DELETE FROM recent_files WHERE pinned = 0');
  }
}

// ───────────────────────── OCR history ─────────────────────────

export class OcrHistoryRepository {
  constructor(private db: DatabaseDriver) {}

  add(entry: OcrHistoryEntry): void {
    this.db.run(
      `INSERT INTO ocr_history (file_path, languages, mode, page_count, duration_ms, mean_confidence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.filePath,
        JSON.stringify(entry.languages),
        entry.mode,
        entry.pageCount,
        entry.durationMs,
        entry.meanConfidence ?? null,
        now()
      ]
    );
  }

  list(limit = 50): OcrHistoryEntry[] {
    return this.db
      .all<{
        id: number;
        file_path: string;
        languages: string;
        mode: string;
        page_count: number;
        duration_ms: number;
        mean_confidence: number | null;
        created_at: number;
      }>('SELECT * FROM ocr_history ORDER BY created_at DESC LIMIT ?', [limit])
      .map((r) => ({
        id: r.id,
        filePath: r.file_path,
        languages: JSON.parse(r.languages) as string[],
        mode: r.mode as OcrHistoryEntry['mode'],
        pageCount: r.page_count,
        durationMs: r.duration_ms,
        ...(r.mean_confidence !== null ? { meanConfidence: r.mean_confidence } : {}),
        createdAt: r.created_at
      }));
  }
}

// ───────────────────────── Templates ─────────────────────────

export class TemplatesRepository {
  constructor(private db: DatabaseDriver) {}

  list(): TemplateMeta[] {
    return this.db
      .all<{ id: string; name: string; category: string; description: string | null; created_at: number }>(
        'SELECT id, name, category, description, created_at FROM templates ORDER BY created_at DESC'
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category as TemplateMeta['category'],
        ...(r.description ? { description: r.description } : {}),
        createdAt: r.created_at
      }));
  }

  getData(id: string): Uint8Array | undefined {
    const row = this.db.get<{ data: Buffer }>('SELECT data FROM templates WHERE id = ?', [id]);
    return row ? new Uint8Array(row.data) : undefined;
  }

  save(meta: Omit<TemplateMeta, 'createdAt'>, data: Uint8Array): void {
    this.db.run(
      `INSERT INTO templates (id, name, category, description, data, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, category = excluded.category,
         description = excluded.description, data = excluded.data`,
      [meta.id, meta.name, meta.category, meta.description ?? null, Buffer.from(data), now()]
    );
  }

  delete(id: string): void {
    this.db.run('DELETE FROM templates WHERE id = ?', [id]);
  }
}

// ───────────────────────── AI history ─────────────────────────

export class AiHistoryRepository {
  constructor(private db: DatabaseDriver) {}

  add(entry: AiHistoryEntry): void {
    this.db.run(
      `INSERT INTO ai_history (doc_path, provider, action, prompt, response, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entry.docPath ?? null, entry.provider, entry.action, entry.prompt, entry.response, now()]
    );
  }

  list(limit = 100): AiHistoryEntry[] {
    return this.db
      .all<{
        id: number;
        doc_path: string | null;
        provider: string;
        action: string;
        prompt: string;
        response: string;
        created_at: number;
      }>('SELECT * FROM ai_history ORDER BY created_at DESC LIMIT ?', [limit])
      .map((r) => ({
        id: r.id,
        ...(r.doc_path ? { docPath: r.doc_path } : {}),
        provider: r.provider,
        action: r.action as AiHistoryEntry['action'],
        prompt: r.prompt,
        response: r.response,
        createdAt: r.created_at
      }));
  }
}

// ───────────────────────── Signatures / stamps ─────────────────────────

export class SignaturesRepository {
  constructor(private db: DatabaseDriver) {}

  list(): SavedSignature[] {
    return this.db
      .all<{ id: string; name: string; kind: string; image_png: Buffer; created_at: number }>(
        'SELECT * FROM signatures ORDER BY created_at DESC'
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind as SavedSignature['kind'],
        imagePng: new Uint8Array(r.image_png),
        createdAt: r.created_at
      }));
  }

  save(sig: Omit<SavedSignature, 'createdAt'>): void {
    this.db.run(
      `INSERT INTO signatures (id, name, kind, image_png, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, image_png = excluded.image_png`,
      [sig.id, sig.name, sig.kind, Buffer.from(sig.imagePng), now()]
    );
  }

  delete(id: string): void {
    this.db.run('DELETE FROM signatures WHERE id = ?', [id]);
  }
}

export class StampsRepository {
  constructor(private db: DatabaseDriver) {}

  list(): StampDefinition[] {
    return this.db
      .all<{ id: string; name: string; config: string; created_at: number }>(
        'SELECT * FROM stamps ORDER BY created_at DESC'
      )
      .map((r) => ({ ...(JSON.parse(r.config) as StampDefinition), id: r.id, name: r.name, createdAt: r.created_at }));
  }

  save(stamp: Omit<StampDefinition, 'createdAt'>): void {
    this.db.run(
      `INSERT INTO stamps (id, name, config, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, config = excluded.config`,
      [stamp.id, stamp.name, JSON.stringify(stamp), now()]
    );
  }

  delete(id: string): void {
    this.db.run('DELETE FROM stamps WHERE id = ?', [id]);
  }
}

// ───────────────────────── Plugin data ─────────────────────────

export class PluginDataRepository {
  constructor(private db: DatabaseDriver) {}

  get(pluginId: string, key: string): unknown {
    const row = this.db.get<{ value: string }>(
      'SELECT value FROM plugin_data WHERE plugin_id = ? AND key = ?',
      [pluginId, key]
    );
    return row ? JSON.parse(row.value) : undefined;
  }

  set(pluginId: string, key: string, value: unknown): void {
    this.db.run(
      `INSERT INTO plugin_data (plugin_id, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(plugin_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [pluginId, key, JSON.stringify(value ?? null), now()]
    );
  }
}

// ───────────────────────── Versions ─────────────────────────

export class VersionsRepository {
  constructor(private db: DatabaseDriver) {}

  add(entry: Omit<VersionEntry, 'id' | 'createdAt'>): void {
    this.db.run(
      `INSERT INTO versions (doc_path, version_file, reason, file_size, created_at) VALUES (?, ?, ?, ?, ?)`,
      [entry.docPath, entry.versionFile, entry.reason, entry.fileSize, now()]
    );
  }

  listForDoc(docPath: string): VersionEntry[] {
    return this.db
      .all<{
        id: number;
        doc_path: string;
        version_file: string;
        reason: string;
        file_size: number;
        created_at: number;
      }>('SELECT * FROM versions WHERE doc_path = ? ORDER BY created_at DESC', [docPath])
      .map((r) => ({
        id: r.id,
        docPath: r.doc_path,
        versionFile: r.version_file,
        reason: r.reason as VersionEntry['reason'],
        fileSize: r.file_size,
        createdAt: r.created_at
      }));
  }

  delete(id: number): string | undefined {
    const row = this.db.get<{ version_file: string }>('SELECT version_file FROM versions WHERE id = ?', [id]);
    this.db.run('DELETE FROM versions WHERE id = ?', [id]);
    return row?.version_file;
  }

  /** Returns files that fell off the retention window so the caller can unlink them. */
  trim(docPath: string, keep: number): string[] {
    const excess = this.db.all<{ id: number; version_file: string }>(
      `SELECT id, version_file FROM versions WHERE doc_path = ?
       ORDER BY created_at DESC LIMIT -1 OFFSET ?`,
      [docPath, keep]
    );
    if (excess.length === 0) return [];
    // Single statement instead of N round-trips, so the synchronous SQLite call
    // doesn't stall the main process while pruning a long version history.
    const placeholders = excess.map(() => '?').join(', ');
    this.db.run(
      `DELETE FROM versions WHERE id IN (${placeholders})`,
      excess.map((r) => r.id)
    );
    return excess.map((r) => r.version_file);
  }
}

// ───────────────────────── Session ─────────────────────────

export class SessionRepository {
  constructor(private db: DatabaseDriver) {}

  save(state: SessionState, cleanExit: boolean): void {
    this.db.run(
      `INSERT INTO sessions (id, state, clean_exit, updated_at) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state = excluded.state, clean_exit = excluded.clean_exit,
         updated_at = excluded.updated_at`,
      [JSON.stringify(state), cleanExit ? 1 : 0, now()]
    );
  }

  load(): { state: SessionState; cleanExit: boolean } | undefined {
    const row = this.db.get<{ state: string; clean_exit: number }>(
      'SELECT state, clean_exit FROM sessions WHERE id = 1'
    );
    if (!row) return undefined;
    try {
      return { state: JSON.parse(row.state) as SessionState, cleanExit: !!row.clean_exit };
    } catch {
      return undefined;
    }
  }

  markClean(clean: boolean): void {
    this.db.run('UPDATE sessions SET clean_exit = ? WHERE id = 1', [clean ? 1 : 0]);
  }
}

// ───────────────────────── Audit ─────────────────────────

export class AuditRepository {
  constructor(private db: DatabaseDriver) {}

  add(entry: AuditEntry): void {
    this.db.run('INSERT INTO audit_log (event, detail, created_at) VALUES (?, ?, ?)', [
      entry.event,
      entry.detail ? JSON.stringify(entry.detail) : null,
      now()
    ]);
  }

  list(limit = 200): AuditEntry[] {
    return this.db
      .all<{ id: number; event: string; detail: string | null; created_at: number }>(
        'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?',
        [limit]
      )
      .map((r) => ({
        id: r.id,
        event: r.event,
        ...(r.detail ? { detail: JSON.parse(r.detail) as Record<string, unknown> } : {}),
        createdAt: r.created_at
      }));
  }
}
