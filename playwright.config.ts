import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests drive the packaged Electron application through
 * Playwright's _electron launcher. Run `npm run build` first so that
 * ./out contains the compiled main process.
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
