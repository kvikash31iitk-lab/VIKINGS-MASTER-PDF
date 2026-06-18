# Vikings Master PDF — Android

A commercial-grade PDF workstation for Android by **Vikings Technologies**, built
with Kotlin, Jetpack Compose (Material 3), and Clean Architecture + MVVM.

> This is the Android client. The desktop (Electron) app lives at the repository
> root. The two share branding but are independent codebases.

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Language / UI  | Kotlin · Jetpack Compose · Material 3 (dynamic + OLED dark) |
| Architecture   | Clean Architecture + MVVM (unidirectional state) |
| DI             | Dagger Hilt |
| Persistence    | Room (recents, settings, stamps, signatures, bookmarks) |
| Concurrency    | Coroutines + Flow |
| Rendering      | `android.graphics.pdf.PdfRenderer` (hardware-accelerated, low memory) |
| Manipulation   | `com.tom-roush:pdfbox-android` (reorder/delete/rotate, text, save) |
| Scan / OCR     | ML Kit document scanner + on-device text recognition |
| Networking     | Retrofit + OkHttp (streaming AI assistant) |
| Min / Target   | SDK 26 / SDK 34 |

## Module layout

```
data/      database (Room) · network (Retrofit/AI) · pdf (renderer + PdfBox) · repository
domain/    model (pure) · repository (interfaces) · usecase · util (Resource)
ui/        theme · components · navigation · home · viewer · scan · tools · settings
di/        Hilt modules (Database, Network, Repository, Dispatcher) + qualifiers
app/       Application (@HiltAndroidApp) + MainActivity
```

## Performance design (large-document safety)

The viewer targets 500 MB / 1000+ page files without OOM:

- **Native, descriptor-backed rendering** — `PdfRenderer` decodes pages on demand
  from a seekable `ParcelFileDescriptor`; the whole document is never in memory.
- **Serialized access** — `PdfRenderer` allows one open page at a time and isn't
  thread-safe, so every call goes through a coroutine `Mutex`.
- **Byte-budgeted page cache** — rendered pages live in an `LruCache` sized to a
  fraction of the heap; evicted pages are left to the GC (never force-recycled,
  since Compose may still be drawing a visible page).
- **Area-capped bitmaps** — each page bitmap is sized to the viewport width and
  hard-capped in total area, bounding peak memory regardless of page size.
- **List virtualization** — the viewer is a `LazyColumn`; only visible pages are
  composed and rendered, and placeholders carry each page's aspect ratio so the
  list never shifts as bitmaps stream in.
- **Off-heap manipulation** — PdfBox loads with a temp-file-only memory setting.

## Editing & productivity features

- **Annotation** — freehand ink, custom text stamps, and hand-drawn signatures
  committed back into the PDF (PdfBox ink/image annotations).
- **Forms** — AcroForm field detection with a Compose fill-in panel.
- **Viewer** — pinch-to-zoom + pan (list scrolling preserved at rest), bookmarks
  (bottom sheet with add/delete/jump), and a streaming AI assistant panel.
- **Page tools** — reorder/delete, rotate, image recompression, whole-document
  text extraction (copy/share), and multi-file merge, each via Storage Access
  Framework destinations.
- **Home** — instant search, sort chips, page-0 thumbnails, and a
  "Continue Reading" hero that restores the last-read page.

## Building

Requires the **Android SDK** (Android Studio Koala+ or `cmdline-tools`).

```bash
cd android
./gradlew assembleDebug          # build a debug APK
./gradlew installDebug           # install to a connected device/emulator
./gradlew lintDebug              # static analysis
```

The debug APK is produced at `app/build/outputs/apk/debug/`. CI
(`.github/workflows/android.yml`) builds and lints on every push that touches
`android/**` and uploads the APK as an artifact.

## AI assistant

The assistant streams over an OpenAI-compatible chat-completions endpoint. Set
the endpoint URL, model, and API key under **Settings → AI Assistant**; nothing
is hard-coded or shipped with a default key.
