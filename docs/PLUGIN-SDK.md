# Vikings Master PDF — Plugin SDK

Plugins extend the workstation without forking it: new ribbon buttons, commands,
panels, exporters, tools, OCR engines and AI providers.

## Anatomy

A plugin is a folder under `<userData>/plugins/<id>/`:

```
word-counter/
├── vikings-plugin.json   ← manifest
└── index.js              ← CommonJS entry: module.exports.activate(api)
```

### Manifest (`vikings-plugin.json`)

```jsonc
{
  "id": "word-counter",          // [a-z0-9-_.]+, unique
  "name": "Word Counter",
  "version": "1.0.0",
  "description": "…",
  "author": "…",
  "main": "index.js",            // entry, must stay inside the plugin folder
  "permissions": ["commands", "ribbon", "panels", "storage"]
}
```

**Permissions** gate every API surface. Calling an API without its permission
throws. Available: `commands`, `ribbon`, `panels`, `exporters`, `tools`,
`ocr`, `ai`, `storage`.

### Entry module

```js
module.exports.activate = function activate(api) {
  // register contributions here
};
```

The entry is validated main-process-side (manifest shape, path confinement,
permission names) and executed in the renderer inside a scoped function — it
receives ONLY the `api` object; there is no Node, no `require`, no Electron.

## VikingsPluginAPI

```ts
interface VikingsPluginAPI {
  readonly pluginId: string;

  /** Commands appear in the Command Palette; id is auto-namespaced to
      `plugin.<pluginId>.<id>`. */
  registerCommand(def: {
    id: string;
    label: string;
    description?: string;
    shortcut?: string;                      // e.g. "Ctrl+Alt+W"
    when?: (ctx: { hasDocument: boolean; docId: string | null }) => boolean;
    run: (payload?: unknown) => void | Promise<void>;
  }): void;

  /** Adds a button to an existing ribbon tab (home|edit|review|forms|protect|
      convert|ocr|organize|esign|view|tools|help). Buttons referencing your
      commands must use the namespaced id. */
  registerRibbonButton(button: {
    tabId: string;
    groupLabel: string;     // new or existing plugin group on that tab
    commandId: string;      // e.g. "plugin.word-counter.count-words"
    label: string;
    icon?: string;          // built-in icon name (see Icon.tsx)
  }): void;

  /** Contributes a right-rail panel. mount() receives a host element and may
      return a cleanup function. Framework-agnostic: render any DOM you like. */
  registerPanel(panel: {
    id: string;
    title: string;
    mount: (host: HTMLElement) => void | (() => void);
  }): void;

  /** Adds an entry to Export — receives the document text, returns bytes. */
  registerExporter(exporter: {
    id: string;
    label: string;
    extension: string;
    export: (docText: string) => Promise<Uint8Array> | Uint8Array;
  }): void;

  /** Key/value storage namespaced to the plugin (SQLite-backed). */
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };

  /** Typed application events (see src/shared/event-bus.ts for the catalog):
      document:opened/closed/saved/modified, page:changed, zoom:changed,
      ocr:progress/done, search:results, theme:changed, … */
  events: {
    on(event: string, handler: (payload: unknown) => void): () => void;
  };

  ui: {
    toast(kind: 'info' | 'success' | 'warning' | 'error', title: string, detail?: string): void;
  };
}
```

## Lifecycle

1. At startup (Settings ▸ Plugins enabled), the main process scans the plugins
   folder and validates manifests.
2. Allow-listed (or all, when the list is empty) valid plugins load; failures
   surface as toasts and in the Plugin Manager — they never crash the host.
3. `Plugin Manager` (Tools tab) shows status, errors and granted permissions,
   and can load plugins on demand.

## Security model

- Entry code runs with **no ambient capabilities** — only the `api` surface.
- Each capability is permission-gated and namespaced (`plugin.<id>.*` command
  ids, per-plugin storage rows).
- File-system access, network and Node APIs are *not* exposed. Exporters and
  panels operate on data the host hands them.
- The manifest's `main` path may not escape the plugin directory.

## Sample

`resources/sample-plugin/` ships a complete, commented example (Word Counter)
demonstrating commands, ribbon buttons, panels, storage and events. Copy it to
`<userData>/plugins/word-counter/` and reload to try it.
