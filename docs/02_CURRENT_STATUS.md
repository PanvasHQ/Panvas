# Panvas Current Project Status

> [!NOTE]
> **Historical Document**: This document reflects early planning/development phases (August-September 2026). For the canonical v0.1.0 architecture and documentation, see [README.md](../README.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md).

## Focused cloud-sync status — 2026-08-30

The current repair excludes same-cycle acknowledged publishes from the remote-apply handoff while preserving genuinely newer remote records. Page metadata completes before page content/drawings. A valid content-empty workspace publishes its root; a missing root remains a real error. Any failed workspace keeps account status out of full success. Browser Google Identity Services now executes `initTokenClient` and `requestAccessToken` using only `VITE_PANVAS_GOOGLE_WEB_CLIENT_ID`; its short-lived access token remains memory-only.

Automated evidence: focused Google/cloud tests 55/55; full suite 333 passed, 0 failed, 1 platform-only skip; renderer/Electron typecheck and production build passed. Electron/browser processes were not launched. Status: **IMPLEMENTED / TEST-PASSING — PENDING USER MANUAL CROSS-DEVICE VERIFICATION**.

*Last updated: 2026-08-30 (focused Google Drive publish/apply and browser GIS repair).*

## Google Drive implementation reconciliation — 2026-08-30

The earlier cloud-sync planning entries below are historical roadmap context. Current source has the provider-neutral engine and Google Drive adapter for Electron and browser/PWA. Google OAuth in Electron and real Drive object/manifest creation have manual evidence. Stable second-sync behavior, browser Google Identity Services sign-in, remote-workspace discovery, dependency-ordered reconstruction, and Electron ↔ browser round trips are implemented and automated-tested, but still require user runtime verification. OneDrive remains unimplemented.

Earlier reconciliation snapshot: focused Google/cloud tests 47/47; full suite 324 passed, 0 failed, 1 platform-only skip. The newer focused status above supersedes these counts.

Legend:
- ✅ **Complete & Wired**: Fully implemented, tested, and active in current source.
- 🟡 **In Progress / Polish**: Functional baseline exists; pending UX polish or platform fallback.
- 🔴 **Planned / Required for V1**: Formally specified; implementation pending in strict roadmap sequence.
- ❌ **Deferred to Post-V1**: Explicitly out of scope for V1 release ([V2] or [FUTURE]).

---

## 1. Real Application Capabilities

- ✅ **Core Bootstrap & Shell**: React SPA bootstraps via `src/main.tsx` and `App.tsx` with pre-React and post-bootstrap branded loading states.
- ✅ **Window Framing & TopBar**: Frameless Electron window with 3-zone layout and native 144px caption safe-zone spacer.
- ✅ **5-Tier Hierarchy & Persistence**: Full `Workspace → Folder → Notebook → Section → Page` hierarchy; atomic filesystem writes (`.panvas/workspace.json`) in Electron and Dexie IndexedDB in browser.
- ✅ **Library / Shelf**: Real repository-backed visual shelf with cover art, folder customization, dynamic recents (`lastOpenedAt`), favorites (`isPinned`), and lossless trash recovery (`deletedByAncestorId`) — **COMPLETED — MANUALLY VERIFIED** (verified in runtime by user with restart persistence).
- ✅ **Browse Navigation**: Subview switching (`Recent`, `Favorites`, `Trash`, `Library`) with dedicated empty states — **COMPLETED — MANUALLY VERIFIED**.
- ✅ **2D Vector Ink Engine**: High-performance canvas, pressure curves, Pen/Pencil/Marker/Highlighter/Eraser, gestures (scribble-to-erase, circle-to-select, straight-line snap, rough-shape recognition), interactive Ruler, Layers, and presentation Laser.
- ✅ **Rich Content Engine**: TipTap rich text, KaTeX LaTeX, Lowlight code blocks, contextual text-formatting strip (B/I/U/S, colors, typography menu), image placement, and mixed canvas layout.
- ✅ **PDF Workspace**: Local offline PDF.js rendering, in-place vector annotation, rotation transforms, page operations (rotate/reorder/extract), whole-notebook export, and isolated printing.
- ✅ **Infinite Freeform Canvas (Excalidraw)**: Embedded Excalidraw with 4-tier hierarchy placement, Draw-to-Shape, and Voice Notes.
- ⚠️ **Infinite Freeform Canvas (Excalidraw — V1 Production Hardening Required)**: Embedded Excalidraw with 4-tier hierarchy placement, Draw-to-Shape, and Voice Notes. V1 hardening pass required for bundle code-splitting (`HARDEN-012`), CSP library downloads (`HARDEN-009`), asset saving without inline base64 data URLs, and zero data loss.
- ⏳ **Embedded Web Research Workspace (CONFIRMED FOR V1)**: Dedicated `Web` tool in primary workspace toolbar; Google default destination; desktop isolated `WebContentsView` (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, zero preload bridge, zero IPC, partitioned session `persist:panvas_research_browser`); clean external browser fallback for Web/PWA builds.
- ⏳ **MCP Support & Panvas Extension Foundation (CONFIRMED FOR V1)**: Extensibility platform; native Model Context Protocol server registration (stdio/SSE), tool/resource discovery, connection monitoring, and explicit trust approval UI; standard extension manifest (`panvas-extension.json`), public API façade decoupling plugins from internal state, least-privilege capability permissions (`workspace.read`, `notebook.write`, `canvas.read`, etc.).
- 🔮 **Embedded Web Research Workspace (MOVED TO V2)**: *Moved to V2 on 2026-09-09*. Dedicated research browsing surface inside Panvas; isolated `WebContentsView` on desktop with clean external browser fallback for Web/PWA builds.
- 🔮 **MCP Support & Panvas Extension Foundation (MOVED TO V2)**: *Moved to V2 on 2026-09-09*. Extensibility platform; native Model Context Protocol server registration (stdio/SSE), tool/resource discovery, connection monitoring, and sandboxed extension manifest architecture.
- 🔮 **Panvas Intelligence & AI Features (PLANNED V2 — STRICTLY POST-V1)**: Contextual note assistant, document QA, auto-summarization, AI mind maps, and autonomous agent workflows belong strictly to V2. V1 core is 100% self-sufficient and offline.
- ✅ **Study & Voice Notes**: Immutable page-linked audio recordings, dual-surface players (Page utilities and floating cards), and academic templates.
- ✅ **Search & Command Palette**: Deterministic local search across TipTap text, PDF digital streams, recognized handwriting, and `Ctrl+K` command palette.
- ✅ **Handwriting to Editable Text (Windows Electron)**: Windows WinRT recognition, font preview dialog, and canvas text placement — **COMPLETED — MANUALLY VERIFIED** (Web/PWA H→Text recognition deferred to [V2]; raw ink preserved).
- ✅ **Discord Rich Presence (Windows Electron Desktop V1)**: Native local IPC client connecting over local named pipes (`\\?\pipe\discord-ipc-0..9`). Shows `Panvas` / `Using Panvas` with `panvas-logo_1`. Zero private document/user metadata exposed. Silent failure on startup if Discord is offline, automatic reconnect when Discord opens, graceful disconnect, clean quit teardown — **IMPLEMENTED / TEST-PASSING / PENDING USER MANUAL RUNTIME VERIFICATION**.
- 🔴 **PWA Application Shell & Persistent Storage (PLANNED / NOT YET IMPLEMENTED)**: Web App Manifest, offline service worker, `navigator.storage.persist()` API, Settings Storage Status UX, and OPFS asset adoption.
- 🔴 **Windows Storage-Location Configuration (PLANNED / NOT YET IMPLEMENTED)**: Configurable user data directory (`path.join(app.getPath('documents'), 'Panvas')` default) and safe atomic migration.
- 🟡 **Security Foundation for Release & Cloud**: Google Desktop PKCE OAuth, safeStorage token protection, capability-scoped IPC, and `drive.file` are implemented; OAuth and Drive folder creation are **MANUALLY VERIFIED WORKING**. Remaining release hardening is still pending.
- 🟡 **Provider-Neutral Cloud Sync / Google Drive**: Stable journal coalescing, manifest concurrency, content-addressed objects, bounded transfer/retry behavior, canonical Electron payloads, browser/PWA OAuth, remote discovery/reconstruction, tombstones, conflicts, and false-success prevention are implemented and automated-tested. **ELECTRON STABLE SYNC: PENDING USER RETEST. BROWSER/PWA SYNC: PENDING USER MANUAL VERIFICATION.** OneDrive is not implemented.
- 🔴 **Windows Distribution & Installer (PLANNED / NOT YET IMPLEMENTED)**: Setup wizard (NSIS is the current recommended Windows installer candidate), Start Menu/Desktop shortcuts, Authenticode code signing.
- 🔴 **Official Landing & Download Website (PLANNED / NOT YET IMPLEMENTED)**: Dedicated download and web access portal with terms, privacy, and release documentation.

> [!IMPORTANT]
> **Canonical V1 Product Scope**: Complete V1 feature definitions, security architecture, and release gates are maintained in [`docs/panvas-handover/V1_FEATURE_SCOPE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/V1_FEATURE_SCOPE.md).
> **Canonical V1 & V2 Specifications**:
> - **Panvas V1 Scope**: [`docs/panvas-handover/V1_FEATURE_SCOPE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/V1_FEATURE_SCOPE.md) (Core Product + Production Readiness)
> - **Panvas V2 Roadmap**: [`docs/panvas-handover/V2_ROADMAP.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/V2_ROADMAP.md) (Extensibility + Intelligence)
> **Authoritative Specifications & Master Roadmap**:
> - **Master Product Roadmap**: [`docs/ROADMAP.md`](ROADMAP.md) (V1 Foundation → V2 Knowledge Canvas → V3 Platform)
> - **Panvas V1 Scope**: [`docs/panvas-handover/V1_FEATURE_SCOPE.md`](panvas-handover/V1_FEATURE_SCOPE.md) (Core Product + Production Readiness)
> - **Future Engineering Reference**: [`docs/panvas-handover/V2_ROADMAP.md`](panvas-handover/V2_ROADMAP.md)

---

## 2. Platform & Distribution Status

| Delivery Form | Current Status | Notes |
| --- | --- | --- |
| **Windows Desktop (Electron)** | 🟡 Active Development | Full core feature set functional; storage config, installer wizard, and code signing remaining. |
| **Web / PWA Application** | 🟡 Active Development | Responsive shell, mobile drawer (<600px), and bottom sheet functional; PWA manifest, offline service worker shell, and storage persist API remaining. |
| **Embedded Web Workspace** | ⏳ Confirmed for V1 (`V1 REQUIRED`) | Isolated `WebContentsView` on desktop with Google default; clean external browser fallback on Web/PWA. |
| **MCP & Extension Platform** | ⏳ Confirmed for V1 (`V1 REQUIRED`) | Model Context Protocol foundation (stdio/SSE) and sandboxed extension manifest architecture. |
| **Embedded Web Workspace** | 🔮 Planned for V2 ([V2]) | Moved to V2 on 2026-09-09. Isolated `WebContentsView` on desktop with Google default; clean external browser fallback on Web/PWA. |
| **MCP & Extension Platform** | 🔮 Planned for V2 ([V2]) | Moved to V2 on 2026-09-09. Model Context Protocol foundation (stdio/SSE) and sandboxed extension manifest architecture. |
| **Direct Website Installer** | 🔴 Planned / Not Yet Implemented (V1) | Installer wizard (NSIS candidate) with branding, shortcut options, and clean uninstall. |
| **Microsoft Store Package** | ❌ Deferred ([FUTURE]) | Not a V1 release dependency; direct website distribution is V1 priority. |
| **Native iOS / Android Apps** | ❌ Deferred ([FUTURE]) | Mobile and tablet access is delivered via responsive browser and installable PWA. |
| **Cloud Sync (OneDrive & Google Drive)** | 🟡 Google Drive desktop + browser implemented; runtime verification pending | Electron OAuth and real object/manifest creation have manual evidence. Stable Electron sync and browser/PWA cross-device behavior await user verification. OneDrive is not implemented. |
| **Developer Coding Workspace** | 🔴 Planned / Not Yet Implemented ([V2]) | Integrated code editing (Monaco/CodeMirror), multi-language, external folder workspace, desktop terminal, Notes ↔ Code backlinks. |
| **Panvas Intelligence (AI)** | 🔮 Planned for V2 ([V2]) | Note assistant, auto-summarization, document QA, and AI mind mapping. Strictly post-V1. |
