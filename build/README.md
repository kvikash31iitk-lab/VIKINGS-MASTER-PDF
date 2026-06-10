# Build resources

electron-builder consumes the assets in this folder when packaging:

| File | Used for |
| ---- | -------- |
| `icon.ico` | Windows executable + NSIS installer (256×256 multi-size ICO) |
| `icon.icns` | macOS bundle |
| `icons/` | Linux PNG set (`16x16.png` … `512x512.png`) |
| `entitlements.mac.plist` | macOS hardened-runtime entitlements (included) |

Icons are intentionally not committed as binaries — generate them from the
brand mark (the “V” shield) with your icon pipeline, e.g.:

```bash
npx electron-icon-builder --input=brand/vikings-mark.png --output=build
```

Packaging works without them (electron-builder falls back to the default
Electron icon with a warning), so CI builds remain green before brand assets land.
