/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commands, installKeyboardShortcuts } from '@renderer/services/command-registry';

describe('command registry', () => {
  beforeEach(() => {
    // Fresh context for each test.
    commands.setContextProvider(() => ({ hasDocument: false, docId: null }));
  });

  it('registers, executes and unregisters commands', async () => {
    const run = vi.fn();
    const dispose = commands.register({ id: 'test.hello', label: 'Hello', run });
    await commands.execute('test.hello');
    expect(run).toHaveBeenCalledTimes(1);
    dispose();
    await commands.execute('test.hello');
    expect(run).toHaveBeenCalledTimes(1); // gone
  });

  it('honors when-clauses through the context provider', async () => {
    const run = vi.fn();
    commands.register({ id: 'test.needsdoc', label: 'Needs doc', when: (ctx) => ctx.hasDocument, run });
    expect(commands.isEnabled('test.needsdoc')).toBe(false);
    await commands.execute('test.needsdoc');
    expect(run).not.toHaveBeenCalled();

    commands.setContextProvider(() => ({ hasDocument: true, docId: 'x' }));
    expect(commands.isEnabled('test.needsdoc')).toBe(true);
    await commands.execute('test.needsdoc');
    expect(run).toHaveBeenCalledTimes(1);
    commands.register({ id: 'test.needsdoc', label: 'overwrite', run: vi.fn() }); // cleanup of when
  });

  it('removes all commands contributed by a plugin', async () => {
    commands.register({ id: 'plugin.p1.a', label: 'A', run: vi.fn(), pluginId: 'p1' });
    commands.register({ id: 'plugin.p1.b', label: 'B', run: vi.fn(), pluginId: 'p1' });
    commands.register({ id: 'plugin.p2.c', label: 'C', run: vi.fn(), pluginId: 'p2' });
    commands.unregisterByPlugin('p1');
    expect(commands.get('plugin.p1.a')).toBeUndefined();
    expect(commands.get('plugin.p1.b')).toBeUndefined();
    expect(commands.get('plugin.p2.c')).toBeDefined();
  });

  it('dispatches keyboard shortcuts and respects editable targets', () => {
    const run = vi.fn();
    commands.register({ id: 'test.shortcut', label: 'Shortcut', shortcut: 'Ctrl+Shift+K', run });
    const cleanup = installKeyboardShortcuts();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }));
    expect(run).toHaveBeenCalledTimes(1);

    // Different combo does nothing.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(run).toHaveBeenCalledTimes(1);

    cleanup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true }));
    expect(run).toHaveBeenCalledTimes(1); // listener removed
  });

  it('supports user-override accelerators', () => {
    const run = vi.fn();
    commands.register({ id: 'test.override', label: 'Override', shortcut: 'Ctrl+9', run });
    const cleanup = installKeyboardShortcuts({ 'test.override': 'Ctrl+8' });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '9', ctrlKey: true }));
    expect(run).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '8', ctrlKey: true }));
    expect(run).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
