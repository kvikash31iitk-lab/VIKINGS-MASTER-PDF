# Vikings Master PDF — API Documentation

Internal module APIs for contributors. Three layers, one dependency rule:
`shared ← core ← (main | renderer)`.

## @core — PDF engine (environment-neutral)

All operations are **pure**: `Uint8Array` in → `Uint8Array` out.

### Pages — `core/pdf/page-ops`
```ts
createBlankPdf(pages?, size?)                       → bytes
insertBlankPages(bytes, index, count?, size?)       → bytes
insertPagesFromPdf(bytes, sourceBytes, index, range?) → bytes
deletePages(bytes, indices)                         → bytes   // refuses to delete all
duplicatePages(bytes, indices)                      → bytes
rotatePages(bytes, indices, deltaDegrees)           → bytes
extractPages(bytes, indices)                        → bytes (new doc)
splitByRanges(bytes, exprs[]) / splitEveryN(bytes, n) → {label, bytes}[]
mergePdfs(files[])                                  → bytes
reorderPages(bytes, permutation[])                  → bytes
cropPages(bytes, indices, {x,y,width,height})       → bytes
readBasicInfo(bytes)                                → {pageCount, title…, encrypted}
```

### Decorations
```ts
applyWatermark(bytes, TextWatermarkOptions | ImageWatermarkOptions)
applyHeaderFooter(bytes, HeaderFooterOptions)        // tokens {page}{pages}{date}{time}{filename}
applyBatesNumbering(bytes, BatesOptions)             → {bytes, nextNumber, applied}
applyStamp(bytes, StampSpec, StampPlacement)
```

### Annotations — `core/pdf/annotation-writer`
```ts
addAnnotations(bytes, NewAnnotation[])               // 15 kinds, AP streams included
deleteAnnotationsByName(bytes, names[])              // /NM-addressed, removes replies
updateAnnotationContents(bytes, name, contents)
addReply(bytes, parentName, {id, author, contents})
setReviewState(bytes, parentName, state, author, stateId)
removeAllAnnotations(bytes)
```
Coordinates are PDF points (y-up). Quad order: TL TR BL BR.

### Forms — `core/pdf/form-builder`
```ts
addFormFields(bytes, FormFieldSpec[])                // text|checkbox|radio|dropdown|listbox|date|signature
readFormData(bytes) → FormFieldValue[]
fillFormData(bytes, values[])
flattenForm(bytes)
formDataToJson / formDataFromJson
```

### Structure
```ts
// bookmarks
writeBookmarks(bytes, BookmarkNode[]) / readBookmarks(bytes)
buildOutlineFromHeadings(HeadingCandidate[]) → BookmarkNode[]
// attachments
addAttachment(bytes, fileBytes, name, {mimeType?, description?})
listAttachments(bytes) / extractAttachment(bytes, name) / removeAttachment(bytes, name)
// metadata
readMetadata / writeMetadata / stripMetadata
```

### Security — `core/node/security` (Node-only)
```ts
encryptPdf(bytes, {algorithm: 'aes-256'|'aes-128', userPassword, ownerPassword, permissions})
decryptPdf(bytes, password)        // AES-256/R6, AES-128/R4, legacy RC4 read
getEncryptionInfo(bytes)           → {encrypted, algorithm?, permissions?}
// throws WrongPasswordError | UnsupportedEncryptionError
```

### Signing — `core/node/signing` (Node-only)
```ts
signPdf({bytes, p12, passphrase, reason?, location?, visible?}) → bytes  // PKCS#7 detached
verifySignatures(bytes) → SignatureVerificationResult[]                  // digest + RSA + cert info
```

### Redaction / compression / PDF/A
```ts
applyRedactions(bytes, CensoredPage[])               // page → censored raster, content destroyed
findPatternMatches(text, ids[]) / findSearchMatches(text, query, opts)
compressPdf(bytes, {profile, codec?, hasher})        → {bytes, before, after, imagesRecoded, duplicatesRemoved}
convertToPdfA(bytes, {level, title?}) / validatePdfA(bytes, level) → report
buildSrgbIccProfile() → Uint8Array                   // ICC v2 RGB profile, generated
```

### Conversion — `core/convert/*`
```ts
reconstructPage(pageIndex, w, h, items) → {lines, paragraphs, text}   // layout analysis
detectTables(lines) → {rows[][]}
textToPdf(text, opts) / imagesToPdf(images, opts)
rtfToText / textToRtf
buildDocxDocument(pages, title?) → docx Document      // pack with Packer
buildXlsx(sheets) / buildPptx(slides) → bytes         // native OOXML writers
encodeTiff(pages) → bytes                             // baseline TIFF, multi-page
buildHtml(pages, {mode: 'layout'|'flow'})
```

### Search & AI
```ts
new TextIndex(); index.setPage(i, text); index.search(q, {caseSensitive, wholeWord, regex})
searchAcrossDocuments(docs, q, opts) → MultiDocHit[]
// offline engine
summarize(pages) / keyPoints(pages) / actionItems(pages) / generateFaq(pages)
answerQuestion(pages, question)                      // grounded, cites (p. N)
// provider plumbing
buildOllamaRequest / parseOllamaLine / buildOpenAiRequest / parseOpenAiSseLine
buildActionPrompt(action, docText, question?)
```

### OCR overlay — `core/ocr/searchable-overlay`
```ts
addSearchableTextLayer(bytes, OcrPageResult[], {minConfidence, customFontBytes?})
  → {bytes, stats: {pagesProcessed, wordsPlaced, wordsSkipped}}
groupWordsIntoLines(words) → OcrLine[]
```

## IPC contract — `shared/ipc-channels` + `window.vikings`

Renderer access goes through the typed client `renderer/src/services/ipc.ts`.
Every handler returns `Result<T>`; errors carry stable codes
(`E_WRONG_PASSWORD`, `E_CONVERTER_MISSING`, …). Channel groups:

| Group | Channels |
| ----- | -------- |
| app/window | get-info, quit, relaunch, minimize, toggle-maximize, close, fullscreen, state-changed |
| files | open/save dialogs, read, write (atomic), stat, show-in-folder, opened-externally |
| recents | list, add, remove, pin, favorite, position, clear |
| settings | get-all, set, reset, changed |
| galleries | templates/signatures/stamps list-save-delete (+ template data) |
| history | ocr + ai add/list |
| ocr | recognize (main-side tesseract), list-cached-languages |
| pdf (worker pool) | encrypt, decrypt, sign, verify-signatures, merge-files |
| convert | html-to-pdf, office-to-pdf, probe-office, clipboard-read |
| print | print (system pipeline) |
| batch | run, cancel, progress events |
| versions/session | autosave write, list/read/delete, session save/load/mark-clean |
| logs | write, audit write/list, export-zip |
| ai | proxy-request, streaming chunks |
| plugins | list, read-entry, data get/set, open-folder |
| updates | check, download, install, events |

## Renderer services (singletons)

| Service | Responsibility |
| ------- | -------------- |
| `documentService` | open/close/save, `applyOperation(bytes→bytes)` with undo snapshots, text index, comments import, autosave/session |
| `annotationService` | draft→PDF conversion (y-flip), replies, review states |
| `pageRenderService` | DPI renders, PNG/JPEG/RGBA, censored bitmaps |
| `ocrService` | page rendering → main OCR → overlay/editable output |
| `exportService` | all PDF→X exports with save dialogs |
| `redactionService` | search/pattern geometry mapping, apply pipeline |
| `searchService` | per-doc + multi-doc search, navigation |
| `aiService` | provider routing, streaming, history |
| `formService` | designer drafts → AcroForm, data IO, flatten |
| `commands` | registry + shortcuts + palette (`commands.register/execute/isEnabled`) |
