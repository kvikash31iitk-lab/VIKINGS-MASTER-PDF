/**
 * Typed in-process event bus. Each process (main, renderer) instantiates its own;
 * cross-process events travel over IPC and are re-emitted locally.
 */

export interface AppEvents {
  'document:opened': { docId: string; path?: string; pageCount: number };
  'document:closed': { docId: string };
  'document:saved': { docId: string; path: string };
  'document:modified': { docId: string };
  'document:reloaded': { docId: string };
  'page:changed': { docId: string; page: number };
  'zoom:changed': { docId: string; zoom: number };
  'selection:changed': { docId: string; kind: 'none' | 'text' | 'object' | 'pages' };
  'annotation:added': { docId: string; pageIndex: number; type: string };
  'annotation:removed': { docId: string; id: string };
  'tool:changed': { tool: string };
  'ocr:progress': { docId: string; page: number; pageCount: number; progress: number };
  'ocr:done': { docId: string };
  'search:results': { docId: string; total: number };
  'settings:changed': { key: string; value: unknown };
  'theme:changed': { theme: string };
  'plugin:loaded': { pluginId: string };
  'plugin:error': { pluginId: string; error: string };
  'ai:response-chunk': { conversationId: string; chunk: string };
  'batch:progress': { jobId: string; status: string };
  'command:executed': { commandId: string };
}

export type EventName = keyof AppEvents;
type Handler<E extends EventName> = (payload: AppEvents[E]) => void;

export class EventBus {
  private handlers = new Map<EventName, Set<Handler<EventName>>>();

  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<EventName>);
    return () => this.off(event, handler);
  }

  once<E extends EventName>(event: E, handler: Handler<E>): () => void {
    const dispose = this.on(event, ((payload: AppEvents[E]) => {
      dispose();
      handler(payload);
    }) as Handler<E>);
    return dispose;
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    this.handlers.get(event)?.delete(handler as Handler<EventName>);
  }

  emit<E extends EventName>(event: E, payload: AppEvents[E]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (e) {
        // A faulty subscriber must never break other subscribers.
        console.error(`[event-bus] handler for "${event}" threw`, e);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
