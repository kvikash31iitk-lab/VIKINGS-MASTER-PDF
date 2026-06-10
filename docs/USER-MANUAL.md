# Vikings Master PDF — User Manual

## 1. Getting started

**Open** a PDF with `Ctrl+O`, by double-clicking a `.pdf` file (Windows file
association), or from the Welcome screen's recent list (pin ★ favorites to keep
them on top). **Create** a new document with `Ctrl+N` (blank page or a starter
template), or build one from other content via **Convert ▸ Create PDF** —
images, text/RTF, HTML, Office documents (LibreOffice required) or the clipboard.

The window is organized as: title bar with Quick Access Toolbar (Save, Undo,
Redo, Print) → **ribbon** (12 tabs) → document tabs → workspace with **left
panels** (Thumbnails, Bookmarks, Attachments, Layers, Comments) and **right
panels** (Properties, Formatting, Inspector, AI Assistant) → status bar.

## 2. Viewing & navigation

- **Zoom**: `Ctrl + =` / `Ctrl + -`, `Ctrl+wheel`, the status-bar selector
  (10%–6400%), `Ctrl+1` fit width, `Ctrl+2` fit page, `Ctrl+0` actual size.
- **Page display** (View tab): Continuous, Single page (wheel turns pages),
  Facing, Book (cover alone). **Reading mode** `Ctrl+H` hides all chrome;
  `F11` toggles fullscreen.
- **Go to page** `Ctrl+G`; thumbnails and bookmarks jump on click.
- **Themes**: View ▸ Theme — Light, Dark, High Contrast, or follow system.

## 3. Find & advanced search

`Ctrl+F` opens the find bar: case-sensitive (`Aa`), whole-word (`W`), regular
expressions (`.*`) and **All** to search every open document. `F3`/`Shift+F3`
walk results; matches highlight on the page with the active hit emphasized.

## 4. Annotating & review (Review tab)

Select text with a markup tool active to create **highlight, underline,
strikeout, squiggly**. Draw with **pencil/marker**; place **sticky notes,
text boxes, callouts, lines, arrows, rectangles, ellipses, clouds**; pick
colors, stroke width and opacity in the **Formatting** panel (set your author
name there too). Drafts are listed in the **Comments** panel — click **Apply**
(or save) to write them into the PDF as standard annotations every reader
understands. Reply to and resolve comments from the panel.
**Compare Documents** opens both versions plus a difference report listing
insertions/deletions per page.

## 5. Editing pages & content (Edit tab)

Add **text**, place **images**, draw shapes, **white-out** regions, add
**hyperlinks** (drag an area, enter the URL) and **crop** (drag an area or use
margins). Undo/redo with `Ctrl+Z` / `Ctrl+Y` covers every document operation.

## 6. Organizing pages (Organize tab)

**Page Grid** shows all pages: click to select, `Ctrl`-click for multi-select,
**drag to reorder**. Insert (blank or from another PDF), delete, duplicate,
rotate (`Ctrl+Shift+L/R`), **extract** to a new document, **split** by ranges
or every N pages, **merge** any number of PDFs with custom order.

## 7. OCR (OCR tab)

**Recognize Text** supports English, Hindi, French, German, Spanish, Chinese
(Simplified) and Japanese in Fast / Balanced / Accurate modes. Output is a
**searchable PDF** (invisible text under the scan) or **editable text** boxes.
Language data downloads once and is cached; drop `.traineddata.gz` files into
`<userData>/tessdata` for offline use. OCR runs appear in the status bar and
respect cancellation.

## 8. Forms (Forms tab)

Open the **Form Designer**, pick a field type (text, checkbox, radio,
dropdown, list box, date, signature) and drag it onto the page — grid snapping
and red alignment guides keep layouts tidy; double-click a field for
properties (name, options, required, multiline). **Create Fields** writes real
AcroForm fields. Import/export form data as JSON; **Flatten** makes values
permanent.

## 9. Protecting documents (Protect tab)

- **Password Protect**: AES-256 or AES-128 with separate open/permissions
  passwords and granular permissions (print, copy, edit, comment, form-fill).
- **Remove Security** with a valid password.
- **Redaction**: mark areas by dragging, by search (plain or regex) or by
  built-in patterns — emails, phone numbers, Aadhaar, PAN, credit cards (Luhn
  validated). Review the red marks, then **Apply** — marked pages are
  re-rendered with the content underneath permanently destroyed and the action
  is audit-logged. *This cannot be undone after saving.*
- **Metadata** editing and the **Audit Log** viewer round out sanitization.

## 10. Signatures (eSign tab)

- **My Signatures**: draw with the pointer, type in a script style, or upload
  a PNG; saved signatures can be placed on any page.
- **Certificate Sign**: sign with a PKCS#12 (`.p12`/`.pfx`) certificate —
  optional reason/location and a visible signature block. **Validate** checks
  every signature: integrity (has the file changed?), certificate subject/
  issuer/validity and whether it covers the whole document.

## 11. Converting & optimizing (Convert tab)

**Export** to Word (paragraphs, headings, tables), Excel (detected tables),
PowerPoint (slide per page), PNG/JPEG (chosen DPI), multi-page TIFF, HTML
(layout-preserving or flowing), TXT and RTF. **Compress** with Web / Office /
Print profiles (image downsampling, duplicate-object removal, metadata
cleanup) and see the before/after report. **PDF/A** converts toward
A-1b/A-2b/A-3b and validates with a rule-by-rule report.

## 12. Document furniture (Tools tab)

**Watermarks** (text or image; opacity, rotation, 9 positions or tiled, behind
or above content, page ranges), **headers & footers** with `{page} {pages}
{date} {time} {filename}` tokens, **Bates numbering** (prefix/suffix/zero-pad,
continues across batch files), **stamps** (Approved, Draft, Confidential,
Final, Paid + your own designs), **attachments** (embed any file; preview text
files inline), **version history** (autosave snapshots you can reopen), and
**batch processing** — run watermark/Bates/compress/encrypt/merge pipelines
over whole folders with progress and per-file error reporting.

## 13. AI Assistant

Open with `Ctrl+Shift+A`. Choose a provider in the panel or Settings ▸ AI:

- **Built-in engine (offline)** — instant summaries, key points, action items,
  FAQs and grounded Q&A with page citations; no network, no data leaves your
  machine.
- **Ollama** — point at your local LLM server.
- **OpenAI-compatible** — any API speaking `/v1/chat/completions`.

Answers stream into the conversation; history is stored locally (toggle in
Settings).

## 14. Recovery & safety

Background **autosave** snapshots dirty documents every few minutes (interval
and retention configurable). After a crash the previous session is restored,
including unsaved snapshots. Every save is atomic — a failure can never
truncate your file. Security-relevant actions (open/save/encrypt/sign/redact/
print) are recorded in the local **audit log** (Tools ▸ Audit Log; export all
logs as a zip from Tools ▸ Export Logs).

## 15. Keyboard shortcuts

`Ctrl+/` shows the full list. Highlights: palette `Ctrl+Shift+P`, save
`Ctrl+S`, save-as `Ctrl+Shift+S`, print `Ctrl+P`, close tab `Ctrl+W`, find
`Ctrl+F`, go-to-page `Ctrl+G`, zoom `Ctrl+=/-/0/1/2`, reading mode `Ctrl+H`,
fullscreen `F11`, settings `Ctrl+,`, ribbon arrow-keys navigate tabs.
