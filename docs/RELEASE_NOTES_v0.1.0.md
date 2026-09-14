# Panvas v0.1.0

Panvas v0.1.0 is the first public release of a local-first visual workspace for notes, handwriting, PDFs, and spatial thinking.

## Availability

- **Windows 10/11 (64-bit):** `Panvas-0.1.0-Setup.exe`, distributed from the [GitHub Release](https://github.com/sumitahmed/Panvas/releases).
- **Web:** [panvas.vercel.app/app](https://panvas.vercel.app/app), a browser-local build using origin-scoped IndexedDB.
- **Project site:** [panvas.vercel.app](https://panvas.vercel.app/).

The release page is the source of truth for asset availability. If the installer is not listed yet, use the source-build instructions in the repository README rather than an unofficial mirror.

## Highlights

- Structured workspaces with folders, notebooks, sections, and pages.
- Vector notebook ink, pressure-aware input, smoothing, erasing, ruler tools, page templates, layers, sticky notes, images, and voice notes.
- Rich text, local search, trash/restore, and workspace backup export/import.
- PDF.js viewing with vector annotation and annotated-PDF export through `pdf-lib`.
- Excalidraw-powered visual canvases with Panvas custom content blocks.
- Windows filesystem persistence with queued writes and recovery data; browser persistence through Dexie/IndexedDB.

## Local-first behavior

Normal editing does not require a Panvas account or a network connection. Windows stores workspace data under `Documents/Panvas/` by default; the web build is scoped to the browser origin. Google Drive Cloud Sync is release-gated and disabled by default in v0.1.0.

Handwriting-to-text uses Windows Ink on the Windows Electron path and a browser-native API where available. Unsupported environments keep the original ink. The experimental local neural fallback is disabled.

## Installer verification

The Windows installer is unsigned, so SmartScreen may warn on first launch. Download `SHA256SUMS.txt` from the same GitHub Release and verify locally:

```powershell
Get-FileHash Panvas-0.1.0-Setup.exe -Algorithm SHA256
```

The calculated digest must match the line for the installer in `SHA256SUMS.txt`. Do not rely on a hash copied from a different page.

## Limitations

Read [KNOWN_LIMITATIONS.md](../KNOWN_LIMITATIONS.md) before installing. Important constraints include unsigned Windows packaging, browser storage quotas, platform-dependent handwriting recognition, large-PDF resource use, and release-gated Cloud Sync.

## Links

- [README and source](https://github.com/sumitahmed/Panvas)
- [Issues](https://github.com/sumitahmed/Panvas/issues)
- [Security advisories](https://github.com/sumitahmed/Panvas/security/advisories)
- [MIT license](../LICENSE)
