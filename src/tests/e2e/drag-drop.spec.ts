/**
 * Drag-and-drop wiring (e2e) — verifies the global drop target reacts to a
 * file drag and shows its overlay in the real packaged renderer.
 *
 * Note: the actual open pipeline (path → read → convert → open) is covered
 * deterministically by src/tests/stores/file-open.test.ts. It cannot be driven
 * here because resolving a dropped File to a real OS path needs a genuine OS
 * drag (Electron's webUtils.getPathForFile), and the contextBridge API is
 * immutable so it cannot be stubbed from the page.
 *
 * The page.evaluate callback runs in the browser but is type-checked under the
 * Node project (no DOM lib), so browser globals are reached via globalThis.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface Browserish {
  DataTransfer: new () => { types: readonly string[] };
  DragEvent: new (type: string, init: Record<string, unknown>) => unknown;
  dispatchEvent: (event: unknown) => boolean;
}

const MAIN = join(__dirname, '../../../out/main/index.js');

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  test.skip(!existsSync(MAIN), 'Run `npm run build` before the e2e suite');
  app = await electron.launch({
    args: [MAIN, ...(process.env.CI ? ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [])]
  });
  page = await app.firstWindow();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  await app?.close();
});

test('shows the drop overlay while dragging files over the window', async () => {
  await expect(page.getByTestId('file-drop-overlay')).toHaveCount(0);
  await page.evaluate(() => {
    const g = globalThis as unknown as Browserish;
    const dt = new g.DataTransfer();
    // Real OS file drags expose a "Files" type — internal drags do not.
    Object.defineProperty(dt, 'types', { value: ['Files'], configurable: true });
    g.dispatchEvent(new g.DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
    g.dispatchEvent(new g.DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
  });
  await expect(page.getByTestId('file-drop-overlay')).toBeVisible();
  await expect(page.locator('text=Drop to open')).toBeVisible();

  // Leaving the window hides the overlay again.
  await page.evaluate(() => {
    const g = globalThis as unknown as Browserish;
    const dt = new g.DataTransfer();
    Object.defineProperty(dt, 'types', { value: ['Files'], configurable: true });
    g.dispatchEvent(new g.DragEvent('dragleave', { dataTransfer: dt, bubbles: true }));
  });
  await expect(page.getByTestId('file-drop-overlay')).toHaveCount(0);
});

test('ignores internal drags that carry no files', async () => {
  await page.evaluate(() => {
    const g = globalThis as unknown as Browserish;
    const dt = new g.DataTransfer();
    Object.defineProperty(dt, 'types', { value: ['text/plain'], configurable: true });
    g.dispatchEvent(new g.DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
  });
  await expect(page.getByTestId('file-drop-overlay')).toHaveCount(0);
});
