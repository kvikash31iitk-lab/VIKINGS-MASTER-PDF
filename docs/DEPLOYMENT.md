# Vikings Master PDF — Deployment & Production Release Guide

## 1. Environments

| Stage | Command | Output |
| ----- | ------- | ------ |
| Development | `npm run dev` | hot-reloading app (electron-vite) |
| Quality gates | `npm run typecheck && npm run lint && npm run test:coverage` | CI parity |
| Production build | `npm run build` | `out/` (main, preload, renderer, pdf worker) |
| E2E | `npm run build && npm run test:e2e` | Playwright against the built app |
| Packaging | `npm run package[:win|:mac|:linux]` | installers under `release/<version>/` |

First-time native setup: `npm install && npm run rebuild` (rebuilds
better-sqlite3 against the local Electron ABI; electron-builder repeats this
automatically when packaging).

## 2. Continuous integration

`.github/workflows/ci.yml` runs on every push/PR:

1. **quality** — `npm ci`, typecheck (node+web projects), ESLint (0 warnings
   budget), Vitest with V8 coverage (artifact uploaded), production build.
2. **e2e** — builds and drives the Electron binary under `xvfb`.
3. **package-windows / package-linux** — on `v*` tags only; artifacts are the
   NSIS installer (+ portable) and AppImage/deb/rpm.

## 3. Release workflow

```bash
# 1. ensure a clean main with green CI
npm version 1.2.0            # bumps package.json, creates v1.2.0 tag
git push --follow-tags       # tag triggers packaging jobs
# 2. collect artifacts from the workflow run (or run locally):
npm run release              # build + electron-builder --publish always
```

`electron-builder.yml` publishes to **GitHub Releases**
(`provider: github`, `owner: kvikash31iitk-lab`, `repo: VIKINGS-MASTER-PDF`).
The CI `package-windows` job runs `npm run release:win` with
`GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `permissions: contents: write`, which
builds the installer and uploads it — together with `latest.yml` and the
`.blockmap` for differential downloads — to a Release named `v{version}` from
`package.json`. The installed app reads that feed and updates itself.

**Shipping an update:** bump `version` in `package.json`, then push a commit
whose message contains `[build-installers]` (or run the workflow manually). CI
publishes the new Release; installed apps download it in the background and offer
a one-click restart (and install on next quit otherwise). Each version must be
unique — electron-builder will not overwrite an existing Release's assets.

> First install is still manual (from the Release page). Auto-update only works
> from a build that already has the GitHub feed baked in (v1.0.1 and later).
> If publishing fails with 403, enable **Settings ▸ Actions ▸ General ▸
> Workflow permissions ▸ Read and write permissions** for the repo.

### Code signing

| Platform | Requirement |
| -------- | ----------- |
| Windows | EV/OV Authenticode cert — set `CSC_LINK` + `CSC_KEY_PASSWORD` (or `WIN_CSC_*`) secrets; unsigned builds trip SmartScreen |
| macOS | Developer ID cert + notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`; entitlements already in `build/` |
| Linux | optional GPG signing of repos |

### Auto-update behavior

- Checks ~15 s after launch (packaged builds, opt-out in Settings ▸ General).
- Status surfaces in the status bar; download/install are user-initiated
  (`autoDownload = false`).
- `dev-app-update.yml` lets you test the updater wiring in development.

## 4. Runtime footprint

| Item | Location |
| ---- | -------- |
| Database | `<userData>/vikings.db` (SQLite WAL; falls back to memory-only if the native module is unavailable) |
| Logs | `<userData>/logs/` — `app-YYYY-MM-DD.log` (10 MB × 5 rotation), `error.log`, `audit.log` |
| Autosave versions | `<userData>/versions/<doc-hash>/` |
| OCR language data | `<userData>/tessdata/` (drop `.traineddata.gz` here for offline) |
| Plugins | `<userData>/plugins/<id>/` |

`<userData>` = `%APPDATA%/vikings-master-pdf` (Windows),
`~/Library/Application Support/vikings-master-pdf` (macOS),
`~/.config/vikings-master-pdf` (Linux).

## 5. Enterprise notes

- **Office→PDF** uses a detected LibreOffice (`soffice`) — preinstall it in
  managed images for that feature.
- **Offline AI** is the default provider; no document content leaves the
  machine unless an administrator configures Ollama/OpenAI-compatible
  endpoints in Settings ▸ AI.
- **Network surface**: auto-update host, optional OCR language CDN (first use
  per language), optional AI endpoints. Everything else is local.
- **Audit**: `audit.log` + the `audit_log` table record open/save/print/
  encrypt/decrypt/sign/redact/export events with timestamps.
- **Virtual printer** ("Vikings PDF Printer") requires a signed Windows port
  monitor driver and ships as an installer add-on (see ROADMAP); the in-app
  equivalents are Convert ▸ Create PDF and HTML/Office conversion.

## 6. Troubleshooting

| Symptom | Resolution |
| ------- | ---------- |
| `better-sqlite3` ABI error at start | `npm run rebuild` (the app still boots with in-memory persistence and logs the failure) |
| OCR stuck at "Creating worker" | No network to fetch language data — drop traineddata files into `tessdata/` |
| Office conversion error | Install LibreOffice / add `soffice` to PATH |
| Encrypted file won't open for editing | Files using encrypted object streams (some Acrobat outputs) are view-only in this release — see TECHNICAL-DESIGN §9 |
| Blank window on Linux | Launch with `--disable-gpu` (or disable hardware acceleration in Settings) |
