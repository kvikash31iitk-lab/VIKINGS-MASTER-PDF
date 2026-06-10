# Vikings Master PDF — Product Roadmap

## Phase 1 — Windows Desktop (current)

- ✅ Core workstation: viewer, editing, organize, annotate, forms, protect, convert, OCR,
  eSign, batch, AI assistant, plugin SDK
- ✅ NSIS installer + portable build, auto-update channel
- ◻ Vikings PDF Printer virtual driver (signed Windows print queue) — installer add-on
- ◻ MS Office COM add-in for one-click PDF export
- ◻ Windows Explorer thumbnail/preview handlers

## Phase 2 — macOS

- ◻ Notarized DMG, hardened runtime (entitlements already in repo)
- ◻ macOS menu bar parity & native services integration
- ◻ Quick Look extension

## Phase 3 — Linux

- ◻ AppImage/deb/rpm hardening pass, distro QA matrix
- ◻ CUPS virtual printer integration

## Continuous

- ◻ Cloud providers behind existing abstraction: OneDrive, Google Drive, Dropbox, SharePoint
- ◻ OS keychain storage for AI keys & certificates
- ◻ Certificate-based document encryption (handler interface in place)
- ◻ Real-time co-review (CRDT comment sync) — server component
- ◻ Tagged-PDF accessibility editor & PDF/UA checker
- ◻ Plugin marketplace with signature verification
- ◻ ML table extraction model for higher-fidelity PDF→Excel
- ◻ Localized UI (i18n framework, 10 languages)
