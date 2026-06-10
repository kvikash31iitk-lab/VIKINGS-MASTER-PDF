/**
 * Plugin discovery — scans userData/plugins/<id>/vikings-plugin.json,
 * validates manifests against declared permissions, and serves entry code
 * to the renderer plugin runtime. Execution happens renderer-side inside
 * the guarded VikingsPluginAPI surface.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { shell } from 'electron';
import type { PluginManifest, PluginRecord } from '../../shared/types';
import type { Logger } from './logger';

const VALID_PERMISSIONS = new Set([
  'commands', 'ribbon', 'panels', 'exporters', 'tools', 'ocr', 'ai', 'storage'
]);

export class PluginService {
  constructor(
    private pluginsDir: string,
    private logger: Logger
  ) {
    mkdirSync(pluginsDir, { recursive: true });
  }

  async list(): Promise<PluginRecord[]> {
    const records: PluginRecord[] = [];
    let entries: string[] = [];
    try {
      entries = await readdir(this.pluginsDir);
    } catch {
      return records;
    }

    for (const name of entries) {
      const dir = join(this.pluginsDir, name);
      try {
        if (!(await stat(dir)).isDirectory()) continue;
        const manifestPath = join(dir, 'vikings-plugin.json');
        if (!existsSync(manifestPath)) continue;
        const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as PluginManifest;
        const error = this.validate(manifest, dir);
        records.push({
          manifest,
          directory: dir,
          ...(error ? { error } : {})
        });
      } catch (e) {
        records.push({
          manifest: { id: name, name, version: '0.0.0', main: '', permissions: [] },
          directory: dir,
          error: `Manifest unreadable: ${(e as Error).message}`
        });
      }
    }
    return records;
  }

  private validate(manifest: PluginManifest, dir: string): string | undefined {
    if (!manifest.id || !/^[a-z0-9][a-z0-9-_.]*$/i.test(manifest.id)) return 'Invalid plugin id';
    if (!manifest.main) return 'Missing "main" entry file';
    const entryPath = normalize(join(dir, manifest.main));
    if (!entryPath.startsWith(normalize(dir))) return 'Entry file escapes the plugin directory';
    if (!existsSync(entryPath)) return `Entry file not found: ${manifest.main}`;
    if (!Array.isArray(manifest.permissions)) return 'Missing permissions array';
    for (const perm of manifest.permissions) {
      if (!VALID_PERMISSIONS.has(perm)) return `Unknown permission "${perm}"`;
    }
    return undefined;
  }

  /** Returns plugin entry source for the renderer runtime (path-confined). */
  async readEntry(pluginId: string): Promise<string> {
    const records = await this.list();
    const record = records.find((r) => r.manifest.id === pluginId);
    if (!record) throw new Error(`Plugin "${pluginId}" not found`);
    if (record.error) throw new Error(`Plugin "${pluginId}" is invalid: ${record.error}`);
    const entryPath = normalize(join(record.directory, record.manifest.main));
    this.logger.info('plugins', `Serving entry for ${pluginId}`);
    return readFile(entryPath, 'utf-8');
  }

  openFolder(): void {
    void shell.openPath(this.pluginsDir);
  }
}
