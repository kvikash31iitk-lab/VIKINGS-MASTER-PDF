# Vikings Master PDF — Technical Design Document

This document specifies how each feature area is implemented. Companion documents:
`ARCHITECTURE.md` (system view), `DATABASE-SCHEMA.md`, `COMPONENT-HIERARCHY.md`,
`WIREFRAMES.md`, `PLUGIN-SDK.md`.

---

## 1. PDF Viewer (`renderer/services/document-service.ts`, `components/viewer/*`)

- **Engine:** PDF.js (`pdfjs-dist`) with module worker (`pdf.worker.min.mjs?url`).
- **Virtualization:** `PageVirtualizer` computes page layout boxes from page sizes × zoom;
  renders only pages intersecting the viewport ± 2 pages of overscan. Canvases above the
  recycle threshold are released (`page.cleanup()`), keeping memory flat on 1000+ page files.
- **Layers per page:** raster canvas → PDF.js text layer (selection/search) → annotation
  import layer (existing PDF annotations) → Fabric.js overlay (live editing) → form-designer
  overlay (Forms mode).
- **Zoom:** two-phase — instant CSS transform for feedback, then crisp re-render at the new
  scale on idle. Levels 10%–6400% plus Fit Width / Fit Page / Actual Size.
- **View modes:** continuous, single page, facing, book (cover + pairs), reading mode
  (chrome-collapsed). Display themes: light / dark / high-contrast (canvas invert filter in
  dark reading mode is optional and off by default).

## 2. Editing (`modules/edit`, `services/annotation-service.ts`)

- Fabric.js v6 overlay per page; PowerPoint-style selection handles (rotate/resize/move).
- **Objects:** text boxes, images, shapes (rect/ellipse/line/arrow/cloud/callout), hyperlinks
  (rect + URI action on save), tables (grid of cells rendered to vector ops on save).
- **Text edit-in-place:** existing PDF text is not destructively re-flowed; the edit tool
  covers the original glyph run (white-out rect matched to page background) and writes a new
  text object with chosen font/size/color — the approach used by mainstream editors for
  non-tagged PDFs. Font family/size/weight/color, alignment, line & character spacing
  supported via the Formatting panel.
- **Persistence:** on save, overlay objects are compiled by `@core/pdf/annotation-writer` and
  `@core/pdf/content-composer` into real PDF objects (annotations or page content), not
  screenshots. Undo/redo: Fabric object-level undo + document-level snapshot history.

## 3. Page Organization (`modules/organize`, `@core/pdf/page-ops.ts`)

pdf-lib `copyPages`-based, bytes-in/bytes-out pure functions:
insert (blank/from file), delete, duplicate, rotate ±90/180, extract, split (ranges/every N/
bookmarks), merge (N files with order), reorder (drag-drop in Organize grid), crop (CropBox).
All operations are multi-select and batch-aware and create a pre-destructive version snapshot.

## 4. Creation & Conversion (`modules/convert`, `@core/convert/*`)

| Direction | Path |
| --------- | ---- |
| Images → PDF | jpg/png via pdf-lib embed; other formats decoded through renderer canvas |
| TXT/RTF → PDF | text layout engine in `@core/convert/text-to-pdf.ts` (pagination, margins); RTF de-formatted via lightweight parser |
| HTML → PDF | main process offscreen `BrowserWindow.printToPDF` |
| Office → PDF | LibreOffice headless adapter (`soffice --convert-to pdf`) when detected; clear error + guidance otherwise |
| Clipboard → PDF | main reads clipboard (text/image) → core builders |
| PDF → Word | paragraph reconstruction from PDF.js text items (line clustering, style runs) → `docx` |
| PDF → Excel | table detection (x-cluster columns) → native SpreadsheetML writer (`xlsx-writer.ts`, zero-dep via JSZip) |
| PDF → PowerPoint | page renders → minimal OOXML writer (`pptx-writer.ts`) one slide/page |
| PDF → PNG/JPG | canvas export at chosen DPI |
| PDF → TIFF | own baseline TIFF encoder (single & multi-page) `tiff-encoder.ts` |
| PDF → HTML | absolutely-positioned spans preserving layout + fonts info |
| PDF → TXT/RTF | text extraction → plain / RTF writer |

**Virtual printer:** "Vikings PDF Printer" ships as an OS print-queue driver in the installer
phase (Windows driver signing required — see `DEPLOYMENT.md`); the application exposes the
same entry point via *File ▸ Create ▸ From another application* and a watched-folder mode.

## 5. OCR (`modules/ocr`, `services/ocr-service.ts`, `@core/ocr/searchable-overlay.ts`)

- tesseract.js v5 worker pool (cores − 1); languages: eng, hin, fra, deu, spa, chi_sim, jpn.
- Modes map to engine parameters: **Fast** (DPI 150), **Balanced** (DPI 220),
  **Accurate** (DPI 300 + LSTM-only).
- Pipeline: render page bitmap → recognize → word boxes → `searchable-overlay` writes
  invisible text (render mode 3) scaled to the page → searchable PDF. "Editable" mode emits
  text boxes instead. Area OCR recognizes a marquee selection. Batch OCR runs through the
  batch engine with per-page progress. Language data is cached under `userData/tessdata`.

## 6. Annotations & Review (`modules/review`, `@core/pdf/annotation-writer.ts`)

- Markup: highlight, underline, strikeout, squiggly (QuadPoints from text selection);
  drawing: pencil (Ink), marker (translucent Ink), arrow/line, rectangle, ellipse, cloud
  (Polygon with cloud border effect), callout (FreeText + callout line), text box (FreeText),
  sticky note (Text annotation with popup).
- All annotations are written as standard PDF annotation dictionaries **with appearance
  streams** so any reader displays them; author/subject/dates/replies (IRT) and review status
  are round-tripped. Comments panel groups by page/author with reply threads + resolve.
- **Compare:** side-by-side synchronized scroll; overlay mode renders both versions tinted
  (red/cyan) with per-pixel diff highlights; text diff via Myers algorithm with insert/delete
  report; exportable review report (PDF/HTML).

## 7. Forms (`modules/forms`, `@core/pdf/form-builder.ts`)

- Designer overlay with grid snapping (configurable px), smart alignment guides, multi-select,
  duplicate, tab-order editor, properties panel.
- Field types via pdf-lib AcroForm: text, checkbox, radio group, dropdown, list box, date
  picker (text field + AFDate format script), signature field (sig dict placeholder).
- Form templates saved to the templates repository; fill mode with field navigation,
  import/export of form data (FDF-style JSON).

## 8. Digital Signatures (`modules/esign`, `@core/node/signing/*`)

- Visible signatures: draw (pointer/touch), type (cursive font presets), upload (PNG).
- **Cryptographic signing:** PKCS#7 detached (adbe.pkcs7.detached) via node-forge with
  PKCS#12 certificates; ByteRange placeholder injection post-serialization; optional signed
  timestamp attribute; incremental-update friendly (signature appended last).
- **Validation:** parses SigDict, verifies message digest over ByteRange, reports certificate
  chain, modification status, and signing time in the Signature panel.

## 9. Security (`modules/protect`, `@core/node/security/*`)

- **Encryption:** standard security handler implemented in-house:
  AES-256 (PDF 2.0 / R6) and AES-128 (R4 / V4) including key derivation (Algorithm 2.A/2.B),
  /O /U /OE /UE /Perms computation, object-key derivation, string & stream encryption applied
  through the pdf-lib object graph. Owner + user passwords, permission flags (print, copy,
  edit, annotate, form-fill).
- **Decryption** of password-protected files on open (user supplies password; PDF.js handles
  view-only, core handler produces editable decrypted bytes).
- Certificate-based protection: architecture present behind `SecurityHandler` interface.

## 10. Redaction (`modules/protect/redaction`, `@core/pdf/redaction.ts`)

- Mark via rectangles, search hits, or built-in patterns (email, phone, Aadhaar, PAN, credit
  card with Luhn check) — all marks previewed before applying.
- **Apply = destroy:** affected pages are re-rasterized at configurable DPI with redacted
  regions removed *before* the bitmap leaves the renderer, page content streams are replaced
  (original text/images discarded), optional re-OCR restores searchability of the remaining
  text, and document metadata/attachments named in the sweep are scrubbed. Audit-logged.

## 11. Document Decoration

- **Watermarks** (`@core/pdf/watermark.ts`): text & image, opacity/rotation/scale, 9-zone or
  tiled placement, page ranges, behind/above content.
- **Headers & Footers** (`header-footer.ts`): 6 slots (L/C/R × header/footer), dynamic tokens
  `{page} {pages} {date} {time} {filename} {custom}`, fonts/margins, ranges.
- **Bates numbering** (`bates.ts`): prefix/suffix, start, zero-pad width, position, ranges,
  batch across files with continuous numbering.
- **Stamps** (`stamps.ts`): built-ins (APPROVED, DRAFT, CONFIDENTIAL, FINAL, PAID) generated
  as vector appearances; custom designer (text/border/colors) persisted to DB.

## 12. Navigation Structures

Bookmarks: full outline CRUD, nesting, drag-reorder, import/export JSON, auto-generate from
font-size heuristics. Attachments: embedded files (EmbeddedFiles name tree) add/extract/
preview. Layers: OCG listing + visibility toggle.

## 13. Search (`@core/search/text-index.ts`, `modules/tools/search`)

Per-document index of normalized page texts with original-offset mapping; literal /
case-sensitive / whole-word / regex; multi-document across all open tabs; results panel with
context snippets; viewer highlight boxes from PDF.js text-item geometry.

## 14. AI Assistant (`modules/ai`, `@core/ai/*`)

`AiProvider` interface (`chat(messages, opts) → stream`) with three built-ins:
**Offline engine** (extractive: frequency-scored summarization, key points, action items,
FAQ generation — no network), **Ollama** (`/api/chat`), **OpenAI-compatible** (`/v1/chat/
completions`, configurable base URL/key/model). Document Q&A grounds answers on extracted
page text with citation of page numbers. All remote calls proxied via main; keys stored in
settings (OS keychain integration listed in roadmap).

## 15. Batch Processing (`modules/batch`, `main/workers/pdf-worker.ts`)

Job model: `{ inputs[], steps[] }` where steps reuse core ops (ocr, convert, watermark,
encrypt, compress, rename pattern `{name}{n}{date}`). Runs in the worker pool with per-file
progress events, cancellation, and a summary report.

## 16. Compression (`@core/pdf/compression.ts`)

Image downsampling/re-encode (JPEG quality per profile), metadata cleanup, duplicate stream
deduplication (SHA-256), object-stream packing, font subsetting hook. Profiles: Web (96 DPI),
Office (150), Print (300), Custom. Reports before/after sizes.

## 17. PDF/A (`@core/pdf/pdfa.ts`)

Conversion adds XMP `pdfaid` metadata, sRGB OutputIntent (ICC profile generated by
`icc-profile.ts`), embeds DocumentID, strips encryption/JS/launch actions and transparency
where required. Validator checks: encryption absent, fonts embedded, XMP id, OutputIntent,
forbidden actions, annotation flags — with a structured report (rule id, severity, location).
Conformance targets: A-1b, A-2b, A-3b (A-3 allows attachments).

## 18. Autosave / Recovery (`main/services/autosave-service.ts`)

Background autosave every N min (default 5) to `userData/versions`, version history browser,
crash detection via `clean_exit` flag, session restore (open tabs, page, zoom).

## 19. Logging (`main/services/logger.ts`)

Levels trace…fatal; daily files `logs/app-YYYY-MM-DD.log` with size-capped rotation
(10 MB × 5), separate `error.log` and `audit.log`; export-logs command zips the folder.

## 20. Settings (`shared/settings-schema.ts`)

Typed schema with defaults; categories: General, Appearance, OCR, Security, Performance, AI,
Plugins, Shortcuts. Persisted via SettingsRepository; live-propagated over the event bus.

## 21. Plugins (`renderer/src/plugins/*`, `docs/PLUGIN-SDK.md`)

Manifest (`vikings-plugin.json`: id, name, version, main, permissions, contributes) →
runtime loads entry in a scoped context exposing `VikingsPluginAPI` (registerCommand,
registerRibbonTab/Group, registerPanel, registerExporter, registerTool, registerOcrEngine,
registerAiProvider, storage, events). Sample plugin included under `resources/sample-plugin`.

## 22. Accessibility

Full keyboard model (ribbon arrow-key navigation, F6 region cycling, shortcut manager with
user remapping), ARIA roles/labels on all interactive elements, focus-visible rings,
high-contrast theme, screen-reader announcements for async operations (aria-live), reading
order honored from tagged PDFs when present. Targets WCAG 2.1 AA.

## 23. Testing Strategy

- **Unit (Vitest, node):** entire `@core` engine (pdf ops verified by reloading outputs with
  pdf-lib and asserting structure), security round-trips, writers, search, AI offline engine.
- **Unit (jsdom):** Zustand stores, command registry, utils.
- **Integration:** IPC contract tests with mocked Electron, repository tests on temp SQLite.
- **E2E (Playwright):** Electron launch, open → annotate → save flow, ribbon navigation.
- Coverage gate: 95% on `@core` and stores (CI enforced).
