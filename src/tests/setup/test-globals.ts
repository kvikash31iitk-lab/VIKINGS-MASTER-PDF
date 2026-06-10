/**
 * Global test setup — provides browser shims (matchMedia, window.vikings
 * bridge mock) for jsdom suites; no-ops under the node environment.
 */
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null
      }))
    });
  }

  if (!(window as unknown as { vikings?: unknown }).vikings) {
    const invoke = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    Object.defineProperty(window, 'vikings', {
      writable: true,
      value: {
        invoke,
        on: vi.fn().mockReturnValue(() => undefined),
        platform: 'linux'
      }
    });
  }
}
