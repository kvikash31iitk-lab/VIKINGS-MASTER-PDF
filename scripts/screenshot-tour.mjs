/**
 * Screenshot tour — launches the built app (out/) headlessly and captures
 * key screens to ./screenshots. Useful for smoke-checking a build and for
 * documentation refreshes.
 *
 *   npm run build && xvfb-run --auto-servernum node scripts/screenshot-tour.mjs
 */
import { _electron as electron } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'screenshots');
mkdirSync(outDir, { recursive: true });

const app = await electron.launch({
  args: [
    join(root, 'out/main/index.js'),
    // Container/CI friendliness (root user, no GPU):
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage'
  ]
});

const page = await app.firstWindow();
await page.setViewportSize({ width: 1440, height: 900 });
const shot = async (name) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: join(outDir, name) });
  console.log(`captured ${name}`);
};

// 1 — Welcome screen
await page.waitForSelector('text=Professional PDF Editing Without Limits', { timeout: 20000 });
await shot('01-welcome.png');

// 2 — New document from template picker
await page.keyboard.press('Control+N');
await page.waitForSelector('text=Blank (A4)');
await shot('02-new-pdf-templates.png');
await page.getByRole('button', { name: /Invoice/ }).click();
await page.waitForSelector('[data-page-index="0"]', { timeout: 20000 });
await shot('03-viewer-invoice.png');

// 3 — Ribbon tabs
await page.getByRole('tab', { name: 'Review', exact: true }).click();
await shot('04-ribbon-review.png');
await page.getByRole('tab', { name: 'Protect', exact: true }).click();
await shot('05-ribbon-protect.png');

// 4 — Watermark dialog (Tools tab)
await page.getByRole('tab', { name: 'Tools', exact: true }).click();
await page.locator('text=Watermark').first().click();
await page.waitForSelector('text=Add Watermark');
await shot('06-watermark-dialog.png');
await page.locator('text=Apply').click();
await page.waitForTimeout(900);
await shot('07-watermark-applied.png');

// 5 — Encrypt dialog
await page.getByRole('tab', { name: 'Protect', exact: true }).click();
await page.locator('text=Password Protect').click();
await page.waitForSelector('text=Encryption algorithm');
await shot('08-encrypt-dialog.png');
await page.keyboard.press('Escape');

// 6 — Dark theme
await page.getByRole('tab', { name: 'View', exact: true }).click();
await page.locator('button:has-text("Dark")').first().click();
await shot('09-dark-theme.png');

// 7 — Command palette
await page.keyboard.press('Control+Shift+P');
await page.waitForSelector('[aria-label="Command search"]');
await page.getByLabel('Command search').fill('bates');
await shot('10-command-palette.png');
await page.keyboard.press('Escape');

// 8 — Settings
await page.keyboard.press('Control+,');
await page.waitForSelector('text=Reset all to defaults');
await shot('11-settings.png');
await page.keyboard.press('Escape');

// 9 — AI assistant panel (offline engine)
await page.getByLabel('AI Assistant').click();
await page.waitForSelector('button:has-text("Summarize")');
await page.locator('button:has-text("Summarize")').click();
await page.waitForTimeout(1200);
await shot('12-ai-assistant.png');

// 10 — Organize page grid
await page.getByRole('tab', { name: 'Organize', exact: true }).click();
await page.locator('text=Page Grid').click();
await page.waitForTimeout(900);
await shot('13-organize-grid.png');

await app.close();
console.log(`done → ${outDir}`);
