<div align="center">

# ⛨ Vikings Master PDF

**Professional PDF Editing Without Limits**

Enterprise-grade PDF workstation by **Vikings Technologies**

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-2563eb)]()
[![Stack](https://img.shields.io/badge/stack-Electron%20·%20React%20·%20TypeScript-3b82f6)]()
[![License](https://img.shields.io/badge/license-Proprietary-444)]()

</div>

---

Vikings Master PDF is a complete professional PDF editor: viewing, editing, creation, OCR,
forms, digital signatures, conversion, security, redaction, review workflows, batch
processing and an AI assistant — engineered for 1000+ page documents and enterprise use.

## Feature Highlights

| | |
|---|---|
| 📄 **Viewer** | Virtualized 60 fps scrolling, 10%–6400% zoom, single/continuous/facing/book/reading modes, light/dark/high-contrast |
| ✏️ **Editing** | Text, images, shapes, links, tables with PowerPoint-style handles; full typography controls |
| 🗂 **Organize** | Insert, delete, duplicate, rotate, extract, split, merge, drag-reorder — multi-select & batch |
| 🔍 **OCR** | Tesseract engine, 7 languages, fast/balanced/accurate, searchable or editable output, area & batch OCR |
| 📝 **Annotate** | Full markup set with appearance streams, threaded comments, review status |
| 🧾 **Forms** | Visual designer with grid snapping & alignment guides; all AcroForm field types |
| 🔏 **Sign** | Draw/type/upload signatures + PKCS#7 certificate signing & validation |
| 🔐 **Protect** | AES-256 / AES-128 encryption, granular permissions, true content-destroying redaction with pattern search (email, phone, Aadhaar, PAN, cards) |
| 🔁 **Convert** | Word, Excel, PowerPoint, PNG, JPG, TIFF, HTML, TXT, RTF — both directions where applicable |
| 💧 **Decorate** | Watermarks, headers/footers with dynamic tokens, Bates numbering, stamp gallery + designer |
| 🗜 **Optimize** | Compression profiles (Web/Office/Print/Custom), PDF/A-1/2/3 conversion + validator |
| ✨ **AI** | Summaries, key points, action items, FAQ, document Q&A — offline engine, Ollama, or any OpenAI-compatible API |
| ⚙️ **Platform** | Plugin SDK, batch engine, autosave + version history + crash recovery, audit logging, auto-update |

## Getting Started

```bash
# install dependencies
npm install

# rebuild native modules against Electron (first time / after Electron upgrades)
npm run rebuild

# start in development (hot reload)
npm run dev

# quality gates
npm run typecheck
npm run lint
npm run test            # unit + integration (Vitest)
npm run test:coverage
npm run test:e2e        # Playwright (requires `npm run build` first)

# production build + installers
npm run package         # current platform
npm run package:win     # Windows NSIS + portable
```

## Repository Layout

```
src/shared      IPC contracts, DTOs, settings schema, event bus
src/core        Environment-neutral PDF engine (testable in pure Node)
src/core/node   Node-only crypto: AES-256/128 PDF encryption, PKCS#7 signing
src/main        Electron main process (windows, IPC, SQLite, workers, updater)
src/preload     Hardened context bridge
src/renderer    React application (ribbon UI, viewer, all feature modules)
src/tests       Vitest unit/integration + Playwright e2e
docs            Architecture, design, schema, wireframes, manuals, SDK, deployment
```

## Documentation

- [System Architecture](docs/ARCHITECTURE.md)
- [Technical Design](docs/TECHNICAL-DESIGN.md)
- [Database Schema](docs/DATABASE-SCHEMA.md)
- [UI Wireframes](docs/WIREFRAMES.md)
- [Component Hierarchy](docs/COMPONENT-HIERARCHY.md)
- [User Manual](docs/USER-MANUAL.md)
- [Plugin SDK](docs/PLUGIN-SDK.md)
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)

---

© 2026 Vikings Technologies. All rights reserved.
