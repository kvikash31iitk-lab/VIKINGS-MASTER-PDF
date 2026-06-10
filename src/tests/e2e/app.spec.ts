/**
 * End-to-end smoke tests — launch the built Electron app and exercise the
 * primary flows. Requires `npm run build` first (./out must exist) and an
 * installed Electron binary.
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
  app = await electron.launch({ args: [MAIN] });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close();
});

test('launches with welcome screen and brand chrome', async () => {
  await expect(page.locator('text=Vikings Master PDF').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Professional PDF Editing Without Limits').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
});

test('ribbon tabs switch and expose their groups', async () => {
  await page.getByRole('tab', { name: 'Protect' }).click();
  await expect(page.locator('text=Password Protect')).toBeVisible();
  await page.getByRole('tab', { name: 'Organize' }).click();
  await expect(page.locator('text=Page Grid')).toBeVisible();
  await page.getByRole('tab', { name: 'Home' }).click();
});

test('command palette opens and filters commands', async () => {
  await page.keyboard.press('Control+Shift+P');
  const input = page.getByLabel('Command search');
  await expect(input).toBeVisible();
  await input.fill('watermark');
  await expect(page.locator('text=Watermark…')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('creates a blank PDF from the template picker and views it', async () => {
  await page.keyboard.press('Control+N');
  await page.locator('text=Blank (A4)').click();
  // A document tab appears with the viewer.
  await expect(page.getByRole('tab', { name: /Untitled\.pdf/ })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('text=Page').first()).toBeVisible();
});

test('settings dialog opens with categories', async () => {
  await page.keyboard.press('Control+,');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await page.locator('text=Appearance').click();
  await expect(page.locator('text=Theme').first()).toBeVisible();
  await page.keyboard.press('Escape');
});
