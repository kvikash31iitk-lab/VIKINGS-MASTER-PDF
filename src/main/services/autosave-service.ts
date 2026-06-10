/**
 * Autosave / version history — snapshots document bytes under
 * userData/versions/<hash>/ with retention trimming; powers crash recovery
 * and the Version History dialog.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { VersionsRepository } from '../database/repositories';
import type { SettingsService } from './settings-service';
import type { Logger } from './logger';
import type { VersionEntry } from '../../shared/types';

export class AutosaveService {
  constructor(
    private versionsDir: string,
    private repo: VersionsRepository,
    private settings: SettingsService,
    private logger: Logger
  ) {}

  private docDir(docPath: string): string {
    const hash = createHash('sha1').update(docPath).digest('hex').slice(0, 16);
    return join(this.versionsDir, hash);
  }

  async writeSnapshot(
    docPath: string,
    bytes: Uint8Array,
    reason: VersionEntry['reason']
  ): Promise<string> {
    const dir = this.docDir(docPath);
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${Date.now()}-${reason}.pdf`);
    await writeFile(file, bytes);
    this.repo.add({ docPath, versionFile: file, reason, fileSize: bytes.length });

    const keep = this.settings.get<number>('autosave.maxVersionsPerDocument') || 20;
    const expired = this.repo.trim(docPath, keep);
    for (const old of expired) {
      await unlink(old).catch(() => undefined);
    }
    this.logger.debug('autosave', `snapshot ${reason} for ${docPath}`);
    return file;
  }

  list(docPath: string): VersionEntry[] {
    return this.repo.listForDoc(docPath);
  }

  async readVersion(versionFile: string): Promise<Uint8Array> {
    // Only files inside the versions sandbox may be read through this API.
    if (!versionFile.startsWith(this.versionsDir)) {
      throw new Error('Version file outside the versions directory');
    }
    return new Uint8Array(await readFile(versionFile));
  }

  async deleteVersion(id: number): Promise<void> {
    const file = this.repo.delete(id);
    if (file) await unlink(file).catch(() => undefined);
  }
}
