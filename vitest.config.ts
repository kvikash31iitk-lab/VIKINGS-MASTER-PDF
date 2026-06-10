import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@core': resolve(__dirname, 'src/core'),
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['src/tests/renderer/**', 'jsdom'],
      ['src/tests/stores/**', 'jsdom']
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/core/**', 'src/shared/**', 'src/renderer/src/stores/**', 'src/renderer/src/utils/**'],
      exclude: ['**/*.d.ts', '**/index.ts']
    },
    testTimeout: 30000
  }
});
