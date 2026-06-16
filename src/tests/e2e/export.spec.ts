/**
 * Export (PDF → Word) — verifies the converter completes, writes the file, and
 * clears its progress spinner. Regression guard for the bug where the export
 * finished but the "Exporting…" spinner was never dismissed (orphaned by a
 * throwing finally block), making the converter appear to run forever.
 *
 * The native save dialog is bypassed via the VK_TEST_SAVE_PATH seam; the
 * document is opened by sending the OS-open IPC from the main process.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const MAIN = join(__dirname, '../../../out/main/index.js');

let app: ElectronApplication;
let page: Page;
let pdfPath: string;
let outPath: string;

test.beforeAll(async () => {
  test.skip(!existsSync(MAIN), 'Run `npm run build` before the e2e suite');

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 0; p < 6; p++) {
    const pg = doc.addPage([595, 842]);
    let y = 780;
    for (let i = 0; i < 30; i++) {
      pg.drawText(`Page ${p + 1} line ${i}: the quick brown fox jumps over the lazy dog`, {
        x: 54,
        y,
        size: 11,
        font
      });
      y -= 18;
    }
  }
  const dir = mkdtempSync(join(tmpdir(), 'vk-export-'));
  pdfPath = join(dir, 'sample.pdf');
  outPath = join(dir, 'out.docx');
  writeFileSync(pdfPath, await doc.save());

  app = await electron.launch({
    args: [
      MAIN,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'vk-e2e-'))}`,
      ...(process.env.CI ? ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [])
    ],
    env: { ...process.env, VK_TEST_SAVE_PATH: outPath }
  });
  page = await app.firstWindow();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500); // let the renderer register IPC listeners

  await app.evaluate(({ BrowserWindow }, p) => {
    BrowserWindow.getAllWindows()[0]!.webContents.send('file:opened-externally', p);
  }, pdfPath);
  await expect(page.locator('[data-page-index="0"]')).toBeVisible({ timeout: 25000 });
});

test.afterAll(async () => {
  await app?.close();
});

test('exports to Word, writes the file, and clears the spinner', async () => {
  await page.getByRole('tab', { name: 'Convert', exact: true }).click();
  await page.locator('button:has-text("Export")').first().click();
  await expect(page.getByRole('dialog', { name: 'Export Document' })).toBeVisible();
  await page.locator('div[role=dialog] button:has-text("Export")').click();

  // Completion toast appears…
  await expect(page.locator('text=Export complete')).toBeVisible({ timeout: 30000 });
  // …the file is written…
  expect(existsSync(outPath)).toBe(true);
  // …and the progress spinner is gone (the actual regression being guarded).
  await expect(page.locator('text=Exporting')).toHaveCount(0);
});
