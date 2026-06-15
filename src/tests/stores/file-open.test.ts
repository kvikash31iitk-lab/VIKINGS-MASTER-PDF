/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { TINY_PNG } from '../helpers/sample-pdf';

// Mock the heavy/side-effecting collaborators; keep the core converters real so
// the conversion → open dispatch is genuinely exercised.
const h = vi.hoisted(() => ({
  openFromPath: vi.fn<(p: string) => Promise<void>>(),
  openFromBytes: vi.fn<(b: Uint8Array, o: { title: string }) => Promise<void>>(),
  read: vi.fn<(p: string) => Promise<Uint8Array>>(),
  show: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  logError: vi.fn()
}));

vi.mock('@renderer/services/document-service', () => ({
  documentService: { openFromPath: h.openFromPath, openFromBytes: h.openFromBytes }
}));
vi.mock('@renderer/services/ipc', () => ({
  ipc: { files: { read: h.read } },
  rlog: { error: h.logError, warn: vi.fn(), info: vi.fn() }
}));
vi.mock('@renderer/stores/ui-stores', () => ({
  toast: { success: h.toastSuccess, warning: h.toastWarning, error: h.toastError },
  useDialogStore: { getState: () => ({ show: h.show }) }
}));

import { openFilePath, openDroppedPaths } from '@renderer/services/file-open';

beforeEach(() => {
  vi.clearAllMocks();
  h.openFromPath.mockResolvedValue(undefined);
  h.openFromBytes.mockResolvedValue(undefined);
});

async function bytesAreValidPdf(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe('openFilePath', () => {
  it('opens a dropped PDF directly (no conversion)', async () => {
    await openFilePath('/docs/contract.pdf');
    expect(h.openFromPath).toHaveBeenCalledWith('/docs/contract.pdf');
    expect(h.openFromBytes).not.toHaveBeenCalled();
  });

  it('routes a password-protected PDF to the password prompt', async () => {
    h.openFromPath.mockRejectedValueOnce(
      Object.assign(new Error('needs password'), { name: 'PasswordRequiredError' })
    );
    await openFilePath('/docs/secret.pdf');
    expect(h.show).toHaveBeenCalledWith('password-prompt', { path: '/docs/secret.pdf' });
    expect(h.toastError).not.toHaveBeenCalled();
  });

  it('reports other PDF open failures as an error toast', async () => {
    h.openFromPath.mockRejectedValueOnce(new Error('corrupt xref'));
    await openFilePath('/docs/broken.pdf');
    expect(h.toastError).toHaveBeenCalled();
  });

  it('converts a dropped PNG to a real PDF and opens it', async () => {
    h.read.mockResolvedValueOnce(TINY_PNG);
    await openFilePath('/imgs/scan.PNG');
    expect(h.read).toHaveBeenCalledWith('/imgs/scan.PNG');
    expect(h.openFromBytes).toHaveBeenCalledTimes(1);
    const [bytes, opts] = h.openFromBytes.mock.calls[0]!;
    expect(await bytesAreValidPdf(bytes)).toBe(1);
    expect(opts.title).toBe('scan.pdf');
    expect(h.toastSuccess).toHaveBeenCalled();
  });

  it('converts dropped text to a real PDF and opens it', async () => {
    h.read.mockResolvedValueOnce(new TextEncoder().encode('Line one\nLine two'));
    await openFilePath('/notes/todo.txt');
    expect(h.openFromBytes).toHaveBeenCalledTimes(1);
    const [bytes, opts] = h.openFromBytes.mock.calls[0]!;
    expect(await bytesAreValidPdf(bytes)).toBeGreaterThanOrEqual(1);
    expect(opts.title).toBe('todo.pdf');
  });

  it('de-formats RTF before converting to PDF', async () => {
    h.read.mockResolvedValueOnce(
      new TextEncoder().encode('{\\rtf1\\ansi Hello \\b bold\\b0  world\\par}')
    );
    await openFilePath('/notes/memo.rtf');
    expect(h.openFromBytes).toHaveBeenCalledTimes(1);
    expect(h.openFromBytes.mock.calls[0]![1].title).toBe('memo.pdf');
  });

  it('warns (without opening) on unsupported types', async () => {
    await openFilePath('/sheets/data.xlsx');
    expect(h.toastWarning).toHaveBeenCalled();
    expect(h.openFromPath).not.toHaveBeenCalled();
    expect(h.openFromBytes).not.toHaveBeenCalled();
  });
});

describe('openDroppedPaths', () => {
  it('warns when no path could be resolved (e.g. all getPathForFile returned empty)', async () => {
    await openDroppedPaths(['', '']);
    expect(h.toastWarning).toHaveBeenCalled();
    expect(h.openFromPath).not.toHaveBeenCalled();
  });

  it('opens every usable path, skipping empties', async () => {
    await openDroppedPaths(['/a/one.pdf', '', '/a/two.pdf']);
    expect(h.openFromPath).toHaveBeenCalledTimes(2);
    expect(h.openFromPath).toHaveBeenNthCalledWith(1, '/a/one.pdf');
    expect(h.openFromPath).toHaveBeenNthCalledWith(2, '/a/two.pdf');
  });
});
