import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@shared/event-bus';
import { ok, err, unwrap, wrapError } from '@shared/result';
import {
  DEFAULT_SETTINGS,
  flattenSettings,
  mergeWithDefaults,
  setByPath,
  getByPath
} from '@shared/settings-schema';
import { INVOKE_CHANNELS, EVENT_CHANNELS, IPC } from '@shared/ipc-channels';

describe('event bus', () => {
  it('delivers typed events and supports unsubscribe', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const dispose = bus.on('page:changed', handler);
    bus.emit('page:changed', { docId: 'a', page: 2 });
    expect(handler).toHaveBeenCalledWith({ docId: 'a', page: 2 });
    dispose();
    bus.emit('page:changed', { docId: 'a', page: 3 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('isolates faulty subscribers', () => {
    const bus = new EventBus();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.on('document:closed', bad);
    bus.on('document:closed', good);
    bus.emit('document:closed', { docId: 'x' });
    expect(good).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('once() fires a single time', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('ocr:done', handler);
    bus.emit('ocr:done', { docId: 'a' });
    bus.emit('ocr:done', { docId: 'b' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('result type', () => {
  it('wraps success and failure', () => {
    expect(unwrap(ok(42))).toBe(42);
    const failure = err('E_TEST', 'failed');
    expect(failure.ok).toBe(false);
    expect(() => unwrap(failure)).toThrow('failed');
    const wrapped = wrapError(new Error('kaput'));
    expect(wrapped.ok).toBe(false);
    if (!wrapped.ok) expect(wrapped.error.message).toBe('kaput');
  });
});

describe('settings schema', () => {
  it('flattens and rebuilds settings with defaults', () => {
    const flat = flattenSettings(DEFAULT_SETTINGS as unknown as Record<string, unknown>);
    expect(flat.find(([k]) => k === 'appearance.theme')![1]).toBe('system');

    const merged = mergeWithDefaults([
      ['appearance.theme', 'dark'],
      ['ocr.mode', 'accurate'],
      ['nonsense.key', 'dropped']
    ]);
    expect(merged.appearance.theme).toBe('dark');
    expect(merged.ocr.mode).toBe('accurate');
    expect(merged.general.restoreSession).toBe(DEFAULT_SETTINGS.general.restoreSession);
    expect((merged as unknown as Record<string, unknown>).nonsense).toBeUndefined();
  });

  it('get/set by dot path', () => {
    const obj: Record<string, unknown> = { a: { b: { c: 1 } } };
    expect(getByPath(obj, 'a.b.c')).toBe(1);
    setByPath(obj, 'a.b.d', 'x');
    expect(getByPath(obj, 'a.b.d')).toBe('x');
    expect(getByPath(obj, 'a.missing.deep')).toBeUndefined();
  });
});

describe('ipc channel registry', () => {
  it('separates invoke and event channels with no overlap', () => {
    for (const channel of EVENT_CHANNELS) {
      expect(INVOKE_CHANNELS.has(channel)).toBe(false);
    }
    expect(INVOKE_CHANNELS.has(IPC.FileRead)).toBe(true);
    expect(EVENT_CHANNELS.has(IPC.BatchProgress)).toBe(true);
  });
});
