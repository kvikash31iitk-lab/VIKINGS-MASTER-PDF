/**
 * End-to-end smoke tests — launch the built Electron app and exercise the
 * primary flows. Requires `npm run build` first (./out must exist) and an
 * installed Electron binary.
 *
 * Note: Playwright restarts the worker (and therefore the app) after a test
 * failure, so beforeAll must bring the app to a ready state every time.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const MAIN = join(__dirname, '../../../out/main/index.js');

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  test.skip(!existsSync(MAIN), 'Run `npm run build` before the e2e suite');
  app = await electron.launch({
    args: [
      MAIN,
      // CI containers (and root users) cannot use the Chromium sandbox.
      ...(process.env.CI ? ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [])
    ]
  });
  page = await app.firstWindow();
  // Wait until the renderer is fully interactive (shortcuts registered).
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(300);
});

test.afterAll(async () => {
  await app?.close();
});

// A failed assertion can leave an overlay (palette/dialog) open for the next
// test in the same worker — clear it.
test.beforeEach(async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
});

test('launches with welcome screen and brand chrome', async () => {
  await expect(page.locator('text=Vikings Master PDF').first()).toBeVisible();
  await expect(page.locator('text=Professional PDF Editing Without Limits').first()).toBeVisible();
});

test('ribbon tabs switch and expose their groups', async () => {
  await page.getByRole('tab', { name: 'Protect' }).click();
  await expect(page.locator('text=Password Protect')).toBeVisible();
  await page.getByRole('tab', { name: 'Organize' }).click();
  await expect(page.locator('text=Page Grid')).toBeVisible();
  await page.getByRole('tab', { name: 'Home', exact: true }).click();
});

test('command palette opens and filters commands', async () => {
  await page.keyboard.press('Control+Shift+P');
  const input = page.getByLabel('Command search');
  await expect(input).toBeVisible();
  // Use a command that is enabled with no document open.
  await input.fill('about');
  await expect(page.locator('text=About Vikings Master PDF')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(input).not.toBeVisible();
});

test('creates a blank PDF from the template picker and views it', async () => {
  await page.keyboard.press('Control+N');
  await expect(page.getByRole('button', { name: /Blank \(A4\)/ })).toBeVisible();
  await page.getByRole('button', { name: /Blank \(A4\)/ }).click();
  // A document tab appears with the viewer.
  await expect(page.getByRole('tab', { name: /Untitled\.pdf/ })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-page-index="0"]')).toBeVisible({ timeout: 20000 });
});

test('settings dialog opens with categories', async () => {
  await page.keyboard.press('Control+,');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.locator('text=Appearance').click();
  await expect(page.locator('text=Theme').first()).toBeVisible();
  await page.keyboard.press('Escape');
});
