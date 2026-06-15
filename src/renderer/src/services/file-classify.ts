/**
 * Pure classification of a dropped/opened file by extension. Kept dependency-free
 * so it is trivially unit-testable and importable without pulling in services.
 */
export type DropKind = 'pdf' | 'image' | 'text' | 'rtf' | 'unsupported';

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg']);
const TEXT_EXT = new Set(['txt', 'md', 'log', 'csv']);

export function fileExtension(nameOrPath: string): string {
  const base = nameOrPath.split(/[\\/]/).pop() ?? nameOrPath;
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function classifyFile(nameOrPath: string): DropKind {
  const ext = fileExtension(nameOrPath);
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXT.has(ext)) return 'image';
  if (TEXT_EXT.has(ext)) return 'text';
  if (ext === 'rtf') return 'rtf';
  return 'unsupported';
}
