/**
 * Command system — every ribbon button, shortcut, palette entry and plugin
 * action goes through here. Commands declare availability via `when`.
 */
import { eventBus } from '@shared/event-bus';
import { rlog } from './ipc';
import { toast } from '../stores/ui-stores';

export interface CommandContext {
  hasDocument: boolean;
  docId: string | null;
}

export interface CommandDefinition {
  id: string;
  label: string;
  /** Short description for the palette / tooltips. */
  description?: string;
  shortcut?: string; // e.g. "Ctrl+Shift+S"
  when?: (ctx: CommandContext) => boolean;
  run: (payload?: unknown) => void | Promise<void>;
  /** Source plugin id when contributed by a plugin. */
  pluginId?: string;
}

type ContextProvider = () => CommandContext;

class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private contextProvider: ContextProvider = () => ({ hasDocument: false, docId: null });

  setContextProvider(provider: ContextProvider): void {
    this.contextProvider = provider;
  }

  register(def: CommandDefinition): () => void {
    if (this.commands.has(def.id)) {
      rlog.warn('commands', `Command re-registered: ${def.id}`);
    }
    this.commands.set(def.id, def);
    return () => this.commands.delete(def.id);
  }

  registerMany(defs: CommandDefinition[]): void {
    for (const def of defs) this.register(def);
  }

  unregisterByPlugin(pluginId: string): void {
    for (const [id, def] of this.commands) {
      if (def.pluginId === pluginId) this.commands.delete(id);
    }
  }

  get(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  all(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  isEnabled(id: string): boolean {
    const def = this.commands.get(id);
    if (!def) return false;
    return def.when ? def.when(this.contextProvider()) : true;
  }

  async execute(id: string, payload?: unknown): Promise<void> {
    const def = this.commands.get(id);
    if (!def) {
      rlog.warn('commands', `Unknown command: ${id}`);
      return;
    }
    if (!this.isEnabled(id)) return;
    try {
      await def.run(payload);
      eventBus.emit('command:executed', { commandId: id });
    } catch (e) {
      const message = (e as Error).message;
      rlog.error('commands', `Command ${id} failed`, { error: message });
      toast.error(def.label, message);
    }
  }
}

export const commands = new CommandRegistry();

// ───────────────────────── Keyboard shortcuts ─────────────────────────

function normalizeAccelerator(accel: string): string {
  return accel
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .sort()
    .join('+');
}

function eventToAccelerator(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = e.key.toLowerCase();
  if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
    parts.push(key === ' ' ? 'space' : key);
  }
  return parts.sort().join('+');
}

export function installKeyboardShortcuts(overrides: Record<string, string> = {}): () => void {
  const handler = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    const inEditable =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable);

    const pressed = eventToAccelerator(e);
    for (const def of commands.all()) {
      const accel = overrides[def.id] ?? def.shortcut;
      if (!accel) continue;
      if (normalizeAccelerator(accel) !== pressed) continue;
      // Let text fields keep their native clipboard/undo behavior.
      if (inEditable && ['ctrl+c', 'ctrl+v', 'ctrl+x', 'ctrl+z', 'ctrl+y', 'ctrl+a'].includes(pressed)) {
        return;
      }
      if (!commands.isEnabled(def.id)) return;
      e.preventDefault();
      e.stopPropagation();
      void commands.execute(def.id);
      return;
    }
  };
  window.addEventListener('keydown', handler, { capture: true });
  return () => window.removeEventListener('keydown', handler, { capture: true });
}
