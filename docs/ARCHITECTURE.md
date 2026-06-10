# Vikings Master PDF — System Architecture

**Product:** Vikings Master PDF · **Company:** Vikings Technologies
**Tagline:** Professional PDF Editing Without Limits

---

## 1. Overview

Vikings Master PDF is an enterprise-grade desktop PDF workstation built on Electron, React and
TypeScript. The architecture follows Clean Architecture with MVVM in the presentation layer,
a service layer over repositories, and an event-bus that decouples feature modules.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RENDERER (Chromium)                            │
│  ┌───────────────┐ ┌──────────────────┐ ┌─────────────────────────────┐ │
│  │   View (TSX)  │ │ ViewModel/Stores │ │     Renderer Services       │ │
│  │ Ribbon,Viewer │◄┤    (Zustand)     │◄┤ DocumentService, OcrService │ │
│  │ Panels,Dialogs│ │ documents, view  │ │ AnnotationService, Search…  │ │
│  └───────────────┘ └──────────────────┘ └──────────────┬──────────────┘ │
│          ▲                  ▲                          │                │
│          │            CommandRegistry ◄── Plugins      │                │
│          │                  ▲                          ▼                │
│  ┌───────┴──────────────────┴──────────┐  ┌──────────────────────────┐  │
│  │            Event Bus                │  │   @core PDF Engine       │  │
│  └─────────────────────────────────────┘  │ (pdf-lib ops, writers,   │  │
│                                           │  validators — pure TS)   │  │
│                                           └──────────────────────────┘  │
└────────────────────────────────────┬────────────────────────────────────┘
                              window.vikings (typed, validated)
                                     │ contextBridge / IPC
┌────────────────────────────────────┴────────────────────────────────────┐
│                            MAIN (Node.js)                               │
│ ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐  │
│ │ WindowMgr  │ │IPC Router │ │ Services │ │ Workers │ │ AutoUpdater  │  │
│ │ frameless  │ │ validated │ │ files,   │ │ pdf ops │ │ (electron-   │  │
│ │ multi-win  │ │ channels  │ │ print,   │ │ encrypt │ │  updater)    │  │
│ └────────────┘ └───────────┘ │ convert  │ │ sign    │ └──────────────┘  │
│ ┌──────────────────────────┐ └──────────┘ └─────────┘ ┌──────────────┐  │
│ │ SQLite (better-sqlite3)  │ ┌─────────────────────┐  │   Logger     │  │
│ │ repositories + migrations│ │ @core/node Security │  │ rotation +   │  │
│ │ JSON fallback driver     │ │ AES-256/128, PKCS#7 │  │ audit log    │  │
│ └──────────────────────────┘ └─────────────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Process Model

| Process            | Responsibility                                                                |
| ------------------ | ----------------------------------------------------------------------------- |
| **Main**           | Window lifecycle, native dialogs, file system, SQLite, printing, conversion via offscreen windows, auto-update, logging, crash recovery, plugin discovery |
| **PDF worker** (worker_threads) | CPU-heavy jobs: encryption, signing, merge of large files, batch pipelines — keeps the main loop responsive |
| **Renderer**       | UI, PDF.js rendering/virtualization, Fabric.js annotation overlay, OCR (tesseract.js web workers), search index, conversion writers |
| **Preload**        | Single hardened bridge: typed `window.vikings` API; channel allow-list |

### Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Strict CSP in `index.html`; navigation and `window.open` blocked
- All file access flows through main with path validation; renderer never touches `fs`
- AI provider HTTP calls proxied through main (renderer stays network-isolated)
- Audit log records security-relevant events (open, save, encrypt, sign, redact, print)

## 3. Layering (Clean Architecture)

```
src/
├── shared/        Contracts: IPC channels, DTOs, settings schema, event names
├── core/          ENTERPRISE CORE — environment-neutral PDF engine (no DOM, no Electron)
│   ├── pdf/       page ops, watermarks, headers/footers, bates, stamps, attachments,
│   │              bookmarks, annotation writer, form builder, compression, pdfa, redaction
│   ├── convert/   docx/xlsx/pptx/rtf/html/tiff writers, image→pdf, text→pdf
│   ├── search/    text index, regex/whole-word/multi-doc search
│   ├── ai/        provider abstraction + offline extractive engine
│   ├── ocr/       searchable-PDF text overlay builder
│   └── node/      NODE-ONLY: AES-256/128 PDF encryption, PKCS#7 signing/validation
├── main/          Electron main: windows, ipc, services, database, workers, logging
├── preload/       contextBridge API
└── renderer/src/  React app
    ├── modules/   feature modules (home, edit, review, forms, protect, convert, ocr,
    │              organize, esign, view, tools, help, ai, batch, settings)
    ├── components/ ribbon, viewer, sidebars, dialogs, common controls
    ├── layouts/   application shell, dockable panels
    ├── services/  renderer services (MVVM "model" side)
    ├── stores/    Zustand stores (ViewModels)
    ├── hooks/     reusable hooks
    ├── plugins/   plugin runtime + SDK surface
    ├── utils/     helpers
    └── types/     renderer-only types
```

**Dependency rule:** `shared ← core ← (main | renderer)`. Nothing in `core` imports Electron,
React or the DOM. `core/node` additionally uses `node:crypto` and is consumed only by
main-process services and workers, which keeps the entire engine unit-testable in Node.

## 4. Key Patterns

| Pattern               | Where                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| MVVM                  | React views ↔ Zustand stores (ViewModels) ↔ renderer services (Models) |
| Service Layer         | `src/main/services/*`, `src/renderer/src/services/*`                  |
| Repository            | `src/main/database/repositories/*` over a `DatabaseDriver` interface  |
| Dependency Injection  | Lightweight container (`src/main/container.ts`, renderer `services/registry.ts`) |
| Event Bus             | `src/shared/event-bus.ts` — typed pub/sub used by modules and plugins |
| Command Pattern       | `CommandRegistry`: every ribbon button, shortcut and palette entry is a command |
| Plugin Architecture   | Manifest-driven extension points: ribbon tabs, commands, panels, exporters, tools, OCR engines, AI providers |

## 5. Document Pipeline

1. **Open** — main reads bytes → renderer creates `OpenDocument` (PDF.js for rendering,
   raw bytes retained for pdf-lib mutations).
2. **Render** — virtualized page list; only visible ± overscan pages render
   (canvas + text layer + annotation layer + Fabric overlay). 60 fps scrolling target.
3. **Mutate** — feature services call `@core/pdf` functions: bytes-in → bytes-out, then the
   document reloads incrementally. `HistoryManager` provides undo/redo via capped snapshots
   + cheap Fabric-level undo for in-progress annotations.
4. **Save** — bytes → main → atomic write (temp + rename), autosave versioning, audit entry.
   Optional save-time pipeline: flatten annotations → encrypt → sign.

## 6. Performance Strategy

| Target                | Mechanism                                                            |
| --------------------- | -------------------------------------------------------------------- |
| Startup < 2 s         | Lazy module loading, deferred DB warmup, no synchronous IPC at boot  |
| Open < 3 s (500 MB)   | Streamed read, PDF.js `disableAutoFetch` + range loading, lazy page tree |
| 1000+ pages           | Virtualized viewer + thumbnail IntersectionObserver rendering        |
| Instant search        | Incremental per-page text index, cached after first build            |
| Smooth zoom           | CSS pre-scale then re-render at target scale (two-phase zoom)        |
| OCR throughput        | Pool of tesseract.js workers (N = cores − 1), page-bitmap streaming  |
| Memory                | Page canvas recycling, snapshot LRU in HistoryManager, byte-buffer reuse |

## 7. Data Stores

- **SQLite** (better-sqlite3, WAL mode) at `userData/vikings.db` — see `DATABASE-SCHEMA.md`.
- **JSON fallback driver** keeps the app functional if the native module fails to load.
- **File system** — autosave versions under `userData/versions/<docId>/`, logs under
  `userData/logs/`, plugins under `userData/plugins/`.

## 8. Error Handling & Telemetry

- `Result<T>`-style returns at IPC boundaries; exceptions never cross the bridge raw.
- Central `Logger` (main) with daily rotation + size caps; renderer logs forwarded over IPC.
- Crash reporting hooks (`crashReporter` + renderer `error-boundary`) with local crash dumps;
  remote submission is opt-in and disabled by default.

## 9. Extensibility

Plugins are folders under `userData/plugins/<id>/` with a `vikings-plugin.json` manifest and a
JS entry. The runtime exposes a guarded `VikingsPluginAPI` (commands, ribbon, panels, exporters,
OCR engines, AI providers, storage namespaced per plugin). See `docs/PLUGIN-SDK.md`.

## 10. Cloud-Ready Abstraction

`CloudProvider` interface (list/read/write/metadata) with no hardcoded vendors; OneDrive,
Google Drive, Dropbox and SharePoint ship later as providers (or plugins) without core changes.
