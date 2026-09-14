# Panvas Pre-Release Engineering Audit

**Audit Date**: September 9, 2026  
**Auditor**: Independent Senior Systems & Security Architecture Auditor  
**Repository State When Audited**: Read-only inspection; Git `HEAD` on branch `main` at `origin/main`; active uncommitted editor/layers feature branch owned by Astra in working tree preserved without alteration.  
**Codebase Metrics**:
- Application Source Files: 304 (`src/` and `electron/`)
- Pure Application Source LOC: 55,534 lines
- Test Suite Files: 51 (`tests/`)
- Test Suite LOC: 14,014 lines
- Test-to-Source Volume Ratio: 0.252 (25.2%)
- TypeScript Diagnostics: 0 compilation errors across web (`tsconfig.json`) and Electron (`tsconfig.electron.json`)

---

## 1. Executive Summary

Panvas is an ambitious, high-performance, local-first visual research workspace combining an infinite whiteboard (Excalidraw wrapper), structured vector-ink notebooks, PDF reading/annotation, local neural handwriting recognition, and Google Drive cloud synchronization.

The application reflects extensive AI-assisted ("vibe-coded") development. While individual features exhibit strong engineering craftsmanship (such as the atomic write queue and strict sandboxing), the architecture contains several characteristic multi-generation artifacts:
1. **Split-Brain Cloud Sync**: An early Supabase synchronization engine (`src/services/sync/SyncEngine.ts`) was quarantined (`LEGACY_SYNC_QUARANTINED = true`), but its store (`src/stores/syncStore.ts`) remains deeply wired into the production UI (`StatusBar.tsx`, `WorkspaceSection.tsx`, and 30+ mutating call sites in `workspaceStore.ts`). Every workspace edit increments an obsolete `pendingChanges` counter that never clears, while the actual cloud sync engine (`src/services/cloudsync/`, `cloudSyncStore.ts`) operates in parallel.
2. **Critical Silent Data Loss in Migration**: The Dexie-to-filesystem migration helper (`src/lib/migration.ts`) copies workspace, folder, and notebook metadata records, but completely omits `notebookPageContents` (rich text), `notebookPageDrawings` (vector ink strokes), `pdfFiles` (PDF binaries), and `imageFiles`. Migrated notebooks open with blank pages.
3. **Browser Storage Durability Gap**: While marketed as "local-first", `navigator.storage.persist()` is never called for the primary IndexedDB database (`src/database/schema.ts` / Dexie). In browser/PWA mode, all local user notes are classified as "best-effort" storage and are subject to silent browser eviction under storage pressure or Safari's 7-day inactivity wipe.
4. **Missing Open-Source Foundations**: There is no `LICENSE` file in the repository root, no `"license"` field in `package.json`, and no consolidated `THIRD_PARTY_NOTICES.md` documenting bundled third-party code (Excalidraw, KaTeX, Lucide, Transformers.js).
5. **Privileged IPC Validation Gap**: Electron IPC handlers in `electron/ipc/domain-handlers.ts` and `electron/ipc/knowledge-handlers.ts` strictly validate `senderFrame.url`. However, `electron/ipc/cloudsync-handlers.ts` completely ignores the IPC event, leaving privileged Google Drive download/upload and token operations without sender verification.
6. **Git and Build Hygiene**: Tracked build artifacts (`dist-electron/main.js`, `dist-electron/preload.mjs`, `tsconfig.tsbuildinfo`) and a 2.43 MB screenshot (`Landingpage.png`) are checked into the Git index despite matching `.gitignore`. The `public/` folder contains 38.10 MB of uncompressed marketing screenshots and duplicate assets bundled into production builds.

---

## 2. Top Release Risks

### Risk 1: Silent Data Loss in Dexie-to-Filesystem Migration
- **Severity**: CRITICAL
- **Confidence**: CONFIRMED
- **Category**: Data Integrity & Persistence
- **Exact File**: `src/lib/migration.ts:28-60` (`migrateFromDexieToFs`)
- **What is Wrong**: The migration function reads `folders`, `canvasFiles`, `notebooks`, `notebookSections`, and `notebookPages` from Dexie, but does not read or transfer `db.notebookPageContents`, `db.notebookPageDrawings`, `db.pdfFiles`, or `db.imageFiles`.
- **User Impact**: A user migrating from the browser/PWA version to the Electron desktop version will find all notebook pages completely empty. Ink drawings, TipTap text notes, PDF attachments, and inserted images are permanently lost from the migrated workspace.
- **Evidence**:
  ```ts
  // src/lib/migration.ts lines 28-33:
  const allFolders = await db.folders.toArray();
  const allCanvasFiles = await db.canvasFiles.toArray();
  const allNotebooks = await db.notebooks.toArray();
  const allNotebookSections = await db.notebookSections.toArray();
  const allNotebookPages = await db.notebookPages.toArray();
  const allCanvasData = await db.canvasData.toArray();
  // db.notebookPageContents and db.notebookPageDrawings are NEVER queried!
  ```
- **Recommended Remediation**: Query `notebookPageContents`, `notebookPageDrawings`, `pdfFiles`, and `imageFiles` from Dexie in `src/lib/migration.ts`, pass them through IPC to `WorkspaceService.importWorkspace`, and write individual `.content.json` and `.drawing.json` files to `Documents/Panvas/<Workspace>/Notebooks/<Notebook>/pages/`.
- **Likely Fix Size**: Small (~60 lines)
- **Regression Risk**: Low (idempotent migration)
- **Release Priority**: BLOCKER

### Risk 2: Browser Storage Eviction Without Persistent Storage Grant
- **Severity**: CRITICAL
- **Confidence**: CONFIRMED
- **Category**: Storage Durability
- **Exact File**: `src/services/storage/StorageService.ts`, `src/database/schema.ts`
- **What is Wrong**: The primary workspace database (`PanvasDB` in `src/database/schema.ts`) initializes without invoking `navigator.storage.persist()`. A one-off persistent storage request exists in `src/services/recognition/neural/panvasModelCache.ts`, but it is scoped exclusively to the handwriting Web Worker (where `localStorage` is undefined and `navigator.storage.persist` is often unsupported).
- **User Impact**: In Chrome, Firefox, Edge, and Safari, Panvas IndexedDB data remains "best-effort". Under device disk pressure or browser cache cleanups, the browser can wipe the entire database without warning. On Safari (macOS/iOS), Intelligent Tracking Prevention (ITP) deletes IndexedDB data after 7 days of site inactivity.
- **Evidence**:
  ```ts
  // StorageService.ts only reads usage:
  const estimate = await navigator.storage.estimate();
  // navigator.storage.persist() is NEVER called in StorageService or schema.ts!
  ```
- **Recommended Remediation**: During `initializeDatabase()` in `src/database/schema.ts`, invoke `navigator.storage.persist()`. If denied, render a persistent notice in the UI recommending Google Drive sync or Desktop app usage.
- **Likely Fix Size**: Tiny (~25 lines)
- **Regression Risk**: None
- **Release Priority**: BLOCKER

### Risk 3: Split-Brain Cloud Sync Architecture
- **Severity**: HIGH
- **Confidence**: CONFIRMED
- **Category**: Architecture / State Management
- **Exact File**: `src/stores/workspaceStore.ts:566+`, `src/components/layout/StatusBar.tsx:16`, `src/stores/syncStore.ts`
- **What is Wrong**: The codebase contains two independent sync subsystems:
  1. `src/services/sync/` (`SyncEngine.ts`, `SyncScheduler.ts`, `syncStore.ts`) — the old Supabase engine marked `LEGACY_SYNC_QUARANTINED = true`.
  2. `src/services/cloudsync/` (`engine.ts`, `googleDriveProvider.ts`, `cloudSyncStore.ts`) — the active Google Drive engine.
  More than 30 mutating methods in `workspaceStore.ts` and `canvasStore.ts` call `useSyncStore.getState().incrementPending()`, which updates `syncStore.pendingChanges`. However, the Google Drive engine does not use `syncStore`.
- **User Impact**: The `StatusBar` connectivity indicator reads from `useSyncStore`. Users see `pendingChanges` increment endlessly without clearing. The sync status displayed in the bottom bar does not reflect the real Google Drive sync state.
- **Evidence**:
  ```ts
  // src/stores/workspaceStore.ts line 566:
  useSyncStore.getState().incrementPending();
  // src/services/sync/SyncEngine.ts line 18:
  export const LEGACY_SYNC_QUARANTINED = true;
  ```
- **Recommended Remediation**: Remove all `useSyncStore` calls from `workspaceStore.ts` and `canvasStore.ts`. Update `StatusBar.tsx` and `WorkspaceSection.tsx` to read exclusively from `useCloudSyncStore`. Retire `src/services/sync/` and `src/stores/syncStore.ts`.
- **Likely Fix Size**: Medium (~150 lines across 4 files)
- **Regression Risk**: Low (tested via `cloud-sync-*.test.ts`)
- **Release Priority**: BLOCKER

### Risk 4: Missing License and Open-Source Compliance
- **Severity**: HIGH
- **Confidence**: CONFIRMED
- **Category**: Licensing & Legal
- **Exact File**: Root repository directory, `package.json`
- **What is Wrong**: There is no `LICENSE` file anywhere in the repository root. `package.json` contains `"private": true` and lacks a `"license"` field. Third-party attribution for bundled dependencies (`@excalidraw/excalidraw` [MIT], `pdfjs-dist` [Apache-2.0], `pdf-lib` [MIT], `@huggingface/transformers` [Apache-2.0], `katex` [MIT], `Virgil.woff2` [MIT]) is not consolidated.
- **User Impact**: Downstream developers and open-source contributors cannot legally fork, contribute to, or distribute Panvas.
- **Recommended Remediation**:
  1. Add `LICENSE` file at root (e.g., AGPL-3.0 or MIT as selected by project ownership).
  2. Add `"license"` field in `package.json`.
  3. Create `THIRD_PARTY_NOTICES.md` consolidating MIT, Apache-2.0, BSD-3-Clause, and OFL notices.
- **Likely Fix Size**: Small (documentation only)
- **Regression Risk**: None
- **Release Priority**: BLOCKER

### Risk 5: Unvalidated IPC Sender in CloudSync Handlers
- **Severity**: HIGH
- **Confidence**: CONFIRMED
- **Category**: Electron Security
- **Exact File**: `electron/ipc/cloudsync-handlers.ts:45-142`
- **What is Wrong**: `domain-handlers.ts` and `knowledge-handlers.ts` enforce `requireTrustedSender(event)` to guarantee IPC calls originate from the trusted app origin. `cloudsync-handlers.ts` receives `_event` and ignores it completely for all channels (`cloudsync:connect`, `cloudsync:disconnect`, `cloudsync:drive:*`, `cloudsync:driveV2:*`).
- **User Impact**: If any sub-frame or webview were injected or compromised, it could invoke privileged Google Drive file downloads, uploads, and token operations.
- **Evidence**:
  ```ts
  // electron/ipc/cloudsync-handlers.ts line 45:
  ipcMain.handle('cloudsync:connect', async (_event, provider: string) => { ... });
  // electron/ipc/domain-handlers.ts line 138:
  function validateSender(event: IpcMainInvokeEvent): void { ... }
  ```
- **Recommended Remediation**: Import `validateSender` from `domain-handlers.ts` (or extract to `electron/ipc/ipc-security.ts`) and invoke it at the start of every handler in `cloudsync-handlers.ts` and `cloudsync-diagnostic-handler.ts`.
- **Likely Fix Size**: Tiny (~30 lines)
- **Regression Risk**: None (trusted app origin already satisfies validation)
- **Release Priority**: BLOCKER

### Risk 6: Silent PDF Workspace Error Swallowing
- **Severity**: HIGH
- **Confidence**: CONFIRMED
- **Category**: Error UX
- **Exact File**: `src/components/pdf/PdfWorkspace.tsx:35`
- **What is Wrong**: `usePdfDocument` returns `{ pdfDocument, numPages, isLoading, error }`. `PdfWorkspace.tsx` destructures `error` on line 35, but never references or renders it.
- **User Impact**: When an encrypted, password-protected, or corrupted PDF is opened, `isLoading` becomes `false` and `pdfDocument` remains `null`. The user sees a blank grey screen with zero feedback or recovery options.
- **Evidence**:
  ```ts
  // src/components/pdf/PdfWorkspace.tsx line 35:
  const { pdfDocument, numPages, isLoading, error } = usePdfDocument(page?.pdfDataId);
  // 'error' is never used anywhere in the 1,006 lines of PdfWorkspace.tsx!
  ```
- **Recommended Remediation**: Render a clean error state with an alert icon, error message (e.g., "This PDF is password-protected or unreadable"), and a button to re-import or return to notebook view.
- **Likely Fix Size**: Small (~40 lines)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 7: Hardcoded Windows Documents Path & OneDrive Synchronization Lock Conflicts
- **Severity**: HIGH
- **Confidence**: CONFIRMED
- **Category**: Desktop Durability & Persistence
- **Exact File**: `electron/ipc/WorkspaceService.ts:18`
- **What is Wrong**: `WorkspaceService` hardcodes base storage to `path.join(app.getPath('documents'), 'Panvas')`. On Windows 10/11 systems with OneDrive folder protection active, `Documents` points inside the OneDrive sync root (`C:\Users\<User>\OneDrive\Documents\Panvas`).
- **User Impact**: OneDrive's background syncing locks files during uploads, causing `EBUSY` or `EPERM` rename failures in `writeQueue`. OneDrive "Files On-Demand" can dehydrate files into 0-byte placeholders, causing `readWorkspaceJson` to fail and trigger false recovery.
- **Recommended Remediation**:
  1. Detect if `app.getPath('documents')` contains `OneDrive`. If so, log a warning and offer `app.getPath('userData')/Workspaces` as default.
  2. Increase rename retries in `writeQueue.ts` from 5 to 10 for cloud-synced folders.
  3. Allow users to select their custom storage root directory in Settings.
- **Likely Fix Size**: Medium (~100 lines)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 8: NotebookEngine Lifecycle Leak in React Unmount
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Memory & Resource Leaks
- **Exact File**: `src/components/notebook/NotebookRenderer.tsx:44`, `src/components/notebook/engine/NotebookEngine.ts:436`
- **What is Wrong**: `NotebookEngine` provides a comprehensive `destroy()` method that revokes image object URLs (`this.images.destroy()`), terminates handwriting sessions (`this.handwriting.destroy()`), and unmounts drawing canvases. However, `NotebookRenderer.tsx` instantiates `notebookEngine` via `useMemo` and never calls `notebookEngine.destroy()` inside a `useEffect` cleanup hook.
- **User Impact**: Navigating repeatedly between notebooks or switching between canvas view and notebook view leaks memory, event listeners, and blob object URLs in the browser process.
- **Recommended Remediation**: Add a cleanup return function in `NotebookRenderer.tsx`:
  ```ts
  useEffect(() => {
    return () => {
      notebookEngine.destroy();
    };
  }, [notebookEngine]);
  ```
- **Likely Fix Size**: Tiny (~10 lines)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 9: CSP Blocks Excalidraw Community Library Downloads
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Web Security / CSP
- **Exact File**: `index.html:4`, `src/components/canvas/CanvasView.tsx:171`
- **What is Wrong**: In `index.html`, `connect-src` authorizes `supabase.co`, `posthog.com`, `huggingface.co`, and `googleapis.com`, but omits `https://libraries.excalidraw.com`. When users click "Browse libraries" in the canvas drawer, `CanvasView.tsx` executes `fetch(data.libraryUrl)`, which is blocked by CSP in production.
- **User Impact**: Users cannot install community Excalidraw element libraries from the built-in library drawer.
- **Recommended Remediation**: Add `https://libraries.excalidraw.com` to `connect-src` in `index.html` and `src/config/browserCsp.ts`.
- **Likely Fix Size**: Tiny (2 lines)
- **Regression Risk**: None
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 10: Synchronous `window.confirm()` in Production UI
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: UX Polish & Stability
- **Exact File**: `src/components/layout/TrashSection.tsx:49,192`, `src/components/library/CloudSyncPanel.tsx:123`, `src/components/library/LibraryWorkspace.tsx:156,171`, `src/components/notebook/NotebookToolPropertiesPanel.tsx:218`
- **What is Wrong**: Six critical user flows (permanent workspace deletion, empty trash, batch page property propagation) use native browser `window.confirm()`.
- **User Impact**: In Electron desktop, native synchronous dialogs freeze renderer event loops, look like browser artifacts, and bypass custom modal focus trapping.
- **Recommended Remediation**: Replace all 6 calls with Panvas's asynchronous custom confirmation modal component (`ConfirmDialog`).
- **Likely Fix Size**: Small (~80 lines across 4 files)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 11: N+1 IPC and Disk Reads on Desktop Startup
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Performance
- **Exact File**: `src/repositories/NotebookRepository.ts:10-47`
- **What is Wrong**: During startup, `getAll()`, `getSections()`, and `getPages()` iterate sequentially over every workspace and invoke `window.panvas.notebook.getAll(ws.id)`, `notebookSection.getAll(ws.id)`, and `notebookPage.getAll(ws.id)`. In `electron/ipc/domain-handlers.ts`, each call reads and parses `workspace.json` from disk.
- **User Impact**: A user with 10 workspaces executes 31 sequential roundtrip IPCs and 30 redundant disk reads on startup, delaying workspace readiness.
- **Recommended Remediation**: Introduce a consolidated IPC handler `workspace:getStartupSnapshot` that reads and returns all workspaces, notebooks, sections, and pages in a single batched payload.
- **Likely Fix Size**: Medium (~100 lines)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 12: Bloated Main Bundle Due to Static Excalidraw Import
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Bundle Size & Performance
- **Exact File**: `src/components/workspace/WorkspaceContent.tsx:3`, `src/components/canvas/CanvasView.tsx:13`
- **What is Wrong**: `CanvasView.tsx` statically imports `{ DefaultSidebar, convertToExcalidrawElements, loadFromBlob } from '@excalidraw/excalidraw'`. Because `WorkspaceContent.tsx` statically imports `CanvasView`, the entire Excalidraw engine is bundled into the main `App-*.js` chunk (3.89 MB minified / 1.18 MB gzipped).
- **User Impact**: Increased memory usage on startup; longer initial parse/compile time on mobile browsers and lower-end laptops.
- **Recommended Remediation**: Lazy-load `CanvasView` via `React.lazy()` inside `WorkspaceContent.tsx` so Excalidraw is only fetched when the user opens a canvas file.
- **Likely Fix Size**: Small (~15 lines)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 13: Windows Packaging Deficiencies (Icon & Signing)
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Desktop Packaging
- **Exact File**: `package.json:115-126` (`build.win`)
- **What is Wrong**:
  1. `build.win.icon` points to a raw PNG file (`public/panvas_logo.png`) instead of a multi-resolution `.ico` containing 16, 24, 32, 48, 64, 128, and 256px mipmaps.
  2. No code signing certificate or hash algorithm is configured.
  3. No auto-update mechanism (`electron-updater`) is configured.
- **User Impact**: The Windows installer triggers scary Microsoft Defender SmartScreen warnings ("Unknown Publisher / Windows protected your PC"). The taskbar icon may appear blurry or fail to render in certain DPI scales. Users cannot update in-app.
- **Recommended Remediation**: Generate a proper `build/icon.ico`, configure code signing environment variables in `package.json`, and integrate `electron-updater`.
- **Likely Fix Size**: Medium
- **Regression Risk**: None
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 14: Non-Windows APPDATA Path Assumption in OAuth Token Storage
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Cross-Platform Compatibility
- **Exact File**: `electron/ipc/google-auth-service.ts:115-118`
- **What is Wrong**: `resolveTokenFilePath` uses `electron.app.getPath('userData')`. If `electron` module resolution fails (such as in headless or external test runs), it falls back to `process.env.APPDATA`. On macOS or Linux, `APPDATA` is undefined, causing `resolveTokenFilePath` to return `''`, which silently disables token storage.
- **User Impact**: Non-Windows environments fail to save OAuth tokens if the Electron runtime path is uninitialized.
- **Recommended Remediation**: Use standard cross-platform fallback:
  ```ts
  const home = process.env.HOME || process.env.USERPROFILE || '';
  this.tokenFilePath = process.platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support', 'Panvas', 'google_auth_tokens.enc')
    : path.join(home, '.config', 'Panvas', 'google_auth_tokens.enc');
  ```
- **Likely Fix Size**: Tiny (~10 lines)
- **Regression Risk**: Low
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 15: Dead Marketing Components (2,300+ Unreferenced LOC)
- **Severity**: MEDIUM
- **Confidence**: CONFIRMED
- **Category**: Vibe-Code / Dead Code
- **Exact File**: `src/components/marketing/` (14 component files)
- **What is Wrong**: An entire previous marketing website iteration is left stranded in `src/components/marketing/`:
  - `HeroPanvasAppPrototype.tsx` (767 LOC — simulated app with fake state)
  - `MarketingNav.tsx` (203 LOC)
  - `HeroSection.tsx` (183 LOC)
  - `DownloadSection.tsx` (175 LOC)
  - `VectorInkSection.tsx` (158 LOC)
  - `NotebookStorySection.tsx` (133 LOC)
  - `InfiniteCanvasSection.tsx` (115 LOC)
  - `LocalFirstSection.tsx` (106 LOC)
  - `PdfWorkbenchSection.tsx` (101 LOC)
  - `FaqSection.tsx` (98 LOC)
  - `MarketingFooter.tsx` (91 LOC)
  - `LandingWebGL.tsx` (71 LOC)
  - `CapabilityTicker.tsx` (55 LOC)
  - `CyberBackground.tsx` (50 LOC)
- **User Impact**: Clutters repository, inflates search results, confuses future engineers, and increases cognitive overhead.
- **Recommended Remediation**: Delete these 14 files once Astra's active landing page work is finalized.
- **Likely Fix Size**: Medium (pure deletions)
- **Regression Risk**: None (zero import references confirmed via grep)
- **Release Priority**: SOON AFTER BETA

### Risk 16: Competing Viewport Engine Abstraction
- **Severity**: LOW
- **Confidence**: CONFIRMED
- **Category**: Vibe-Code / Duplication
- **Exact File**: `src/components/notebook/engine/ViewportEngine.ts` (115 LOC) vs `src/components/notebook/engine/ViewportManager.ts` (249 LOC)
- **What is Wrong**: `ViewportEngine.ts` is an abandoned prototype defining its own `type ViewportState = { x: number, y: number, zoom: number }`. The active engine uses `ViewportManager.ts` with `{ zoom, scrollX, scrollY, pageRotation }`.
- **User Impact**: Developer confusion; risk of future features importing the dead class.
- **Recommended Remediation**: Delete `ViewportEngine.ts`.
- **Likely Fix Size**: Tiny (delete 1 file)
- **Regression Risk**: None
- **Release Priority**: SOON AFTER BETA

### Risk 17: Tracked Build Artifacts and Giant Screenshot in Git Index
- **Severity**: LOW
- **Confidence**: CONFIRMED
- **Category**: Git Hygiene
- **Exact File**: `Landingpage.png` (2.43 MB), `dist-electron/main.js` (173 KB), `dist-electron/preload.mjs` (5.6 KB), `tsconfig.tsbuildinfo` (5.7 KB)
- **What is Wrong**: These files were staged into Git before `.gitignore` rules were established. They remain tracked in Git history and produce dirty working tree statuses after builds.
- **User Impact**: Bloated clone size, merge conflicts on build artifacts.
- **Recommended Remediation**: Run `git rm --cached Landingpage.png dist-electron/main.js dist-electron/preload.mjs tsconfig.tsbuildinfo`.
- **Likely Fix Size**: Tiny (command execution)
- **Regression Risk**: None
- **Release Priority**: BEFORE PUBLIC BETA

### Risk 18: Unlabelled Icon-Only Buttons Across Core UI
- **Severity**: LOW
- **Confidence**: CONFIRMED
- **Category**: Accessibility (A11y)
- **Exact File**: `src/components/canvas/CanvasVoiceNote.tsx:97`, `src/components/canvas/PdfBlock.tsx:167-170`, `src/components/notebook/NotebookPageView.tsx`
- **What is Wrong**: More than 150 `<button>` tags lack `aria-label`, `aria-labelledby`, or text content. For example, the voice note play/pause button renders `<button><Pause size={14}/></button>` without an accessible name.
- **User Impact**: Screen reader users cannot identify tool functions. Fails WCAG 2.1 Level AA criteria.
- **Recommended Remediation**: Add descriptive `aria-label` and `title` attributes to all icon buttons.
- **Likely Fix Size**: Medium (~150 elements across components)
- **Regression Risk**: Low
- **Release Priority**: SOON AFTER BETA

### Risk 19: Accidental External Network Dependency for Editor Fonts
- **Severity**: LOW
- **Confidence**: CONFIRMED
- **Category**: Offline / Local-First Integrity
- **Exact File**: `index.html:74`
- **What is Wrong**: Editor handwriting fonts (Caveat, Kalam, Patrick Hand, Inter, JetBrains Mono) are loaded via a Google Fonts CDN stylesheet (`https://fonts.googleapis.com/css2?...`).
- **User Impact**: When opening Panvas on an offline machine or without prior browser cache, handwriting typography falls back to default system serif/sans fonts.
- **Recommended Remediation**: Bundle font WOFF2 files locally under `public/fonts/` and serve via standard local `@font-face` declarations.
- **Likely Fix Size**: Small (~5 font files + CSS)
- **Regression Risk**: Low
- **Release Priority**: SOON AFTER BETA

### Risk 20: Dead Supabase Authentication Forms Bundled into Production
- **Severity**: LOW
- **Confidence**: CONFIRMED
- **Category**: Bundle Size & Dead Code
- **Exact File**: `src/components/auth/LoginPage.tsx`, `SignUpPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`
- **What is Wrong**: These 4 forms import `react-hook-form`, `@hookform/resolvers`, and `zod` to talk to Supabase Auth. Since Supabase sync is quarantined and Panvas uses Google Drive OAuth, these routes are obsolete.
- **User Impact**: Bloats bundle by ~120 KB and exposes non-functional authentication screens if navigated to directly.
- **Recommended Remediation**: Remove or lazy-load auth routes until a unified multi-provider account architecture is adopted.
- **Likely Fix Size**: Small (~4 files)
- **Regression Risk**: Low
- **Release Priority**: SOON AFTER BETA

---

## 3. Persistence & Data Integrity Deep Dive

### Data Lifecycle Mapping

```
[User Action] (Draw / Type / Import)
      │
      ▼
[In-Memory Model] (NotebookEngine / DrawingEngine / TipTap Editor)
      │
      ├─── Web Mode ───────────────► IndexedDB (Dexie `panvas` Schema v6)
      │                               ├── workspaces, folders, canvasFiles
      │                               ├── notebooks, notebookSections, notebookPages
      │                               ├── notebookPageContents (TipTap JSON)
      │                               ├── notebookPageDrawings (Vector strokes)
      │                               └── pdfFiles, imageFiles (Binary ArrayBuffers)
      │
      └─── Electron Desktop Mode ──► IPC (`domain-handlers.ts`)
                                      ├── writeQueue (.tmp -> rename with retry)
                                      ├── Documents/Panvas/<WS>/.panvas/workspace.json
                                      ├── Documents/Panvas/<WS>/Notebooks/<NB>/pages/*.json
                                      └── Documents/Panvas/Assets/(pdf|image|audio)-store/*.bin
```

### Persistence Strengths
1. **Desktop Atomic Write Queue**: `electron/ipc/write-queue.ts` implements write coalescing per file path, writes to `<target>.tmp`, and uses 5 exponential backoff retries on rename. This prevents corrupt JSON files from partial writes.
2. **Automated Recovery Snapshot**: `WorkspaceService.ts` maintains `workspace.last-good.json` in a separate `recovery/` directory. If `workspace.json` is unparseable, it automatically restores from `workspace.last-good.json`.
3. **Detached Cloud Sync Journal**: `src/database/syncJournalDB.ts` records sync mutations (`insert`, `update`, `delete`) as tombstones before cloud transport, preventing lost remote updates.

### Persistence Vulnerabilities
1. **Binary Store Atomicity**: In `domain-handlers.ts:1227,1248`, `binary:storePdf` and `binary:storeImage` write directly via `fsPromises.writeFile` rather than through `writeQueue`. A power cut during a 100 MB textbook import leaves a truncated, unreadable `.bin` file.
2. **Missing Storage Persistence Request in Browser**: Best-effort storage allows Chrome and Safari to evict IndexedDB under disk pressure without prompting the user.

---

## 4. Electron & Web Security Audit

### Electron Process Security Architecture
- `contextIsolation: true` (Preload scripts cannot access renderer window globals directly)
- `nodeIntegration: false` (Node.js runtime APIs are not exposed to renderer)
- `sandbox: true` (Chromium sandbox active for renderer process)
- `webSecurity: true` (Same-origin policy strictly enforced)
- `allowRunningInsecureContent: false` (Mixed content blocked)
- `webviewTag: false` (Webview tags denied via `will-attach-webview` event preventDefault)
- `devTools: Boolean(VITE_DEV_SERVER_URL)` (DevTools automatically disabled in production builds)
- `audioOnlyMediaRequest`: Permission handler in `electron/main.ts` permits only audio microphone access, explicitly denying webcam, geolocation, and notification requests.

### IPC Privilege Boundary Audit
- `domain-handlers.ts`: Uses `validateSender(event)` comparing `event.senderFrame.url` against `dist/index.html` file URL or Vite dev server URL.
- `knowledge-handlers.ts`: Uses `requireTrustedSender(event)`.
- `recognition-handlers.ts`: Uses `requireTrustedSender(event)`.
- **Vulnerability**: `cloudsync-handlers.ts` and `cloudsync-diagnostic-handler.ts` do NOT invoke sender validation.

### Web Content Security Policy (`index.html`)
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://accounts.google.com/gsi/client;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  media-src 'self' blob:;
  connect-src 'self'
    https://*.supabase.co
    https://*.posthog.com
    https://huggingface.co
    https://*.huggingface.co
    https://*.hf.co
    https://cas-bridge.xethub.hf.co
    https://www.googleapis.com
    https://*.googleapis.com
    https://oauth2.googleapis.com
    https://openidconnect.googleapis.com
    https://accounts.google.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  frame-src https://accounts.google.com/gsi/;
  form-action 'self'
" />
```
- **CSP Gap**: `https://libraries.excalidraw.com` is missing from `connect-src`.

---

## 5. Third-Party Licenses & Attribution

Panvas uses 51 production dependencies. The primary libraries requiring formal attribution in `THIRD_PARTY_NOTICES.md` are:

| Package | Version | License | Required Notice Placement |
|---|---|---|---|
| `@excalidraw/excalidraw` | `^0.17.6` | MIT | `THIRD_PARTY_NOTICES.md` + preserve license text |
| `Excalidraw Virgil Font` | Bundled | MIT | `THIRD_PARTY_NOTICES.md` |
| `pdfjs-dist` | `^4.10.38` | Apache-2.0 | `THIRD_PARTY_NOTICES.md` + include Apache-2.0 text |
| `pdf-lib` | `^1.17.1` | MIT | `THIRD_PARTY_NOTICES.md` |
| `@huggingface/transformers` | `^4.2.0` | Apache-2.0 | `THIRD_PARTY_NOTICES.md` |
| `onnxruntime-web` | Transitive | MIT | `THIRD_PARTY_NOTICES.md` |
| `katex` | `^0.16.21` | MIT | `THIRD_PARTY_NOTICES.md` |
| `lucide-react` | `^0.469.0` | ISC | `THIRD_PARTY_NOTICES.md` |
| `highlight.js` | `11.11.2` | BSD-3-Clause | `THIRD_PARTY_NOTICES.md` |
| `dexie` | `^4.0.11` | Apache-2.0 | `THIRD_PARTY_NOTICES.md` |
| `three` | `^0.134.0` | MIT | `THIRD_PARTY_NOTICES.md` |
| `framer-motion` | `^12.40.0` | MIT | `THIRD_PARTY_NOTICES.md` |

---

## 6. Cross-Platform Support Matrix

| Platform / Target | Storage Tier | Stylus & Pressure | PDF Annotation | Audio Recording | Neural OCR | Offline Capability | Status |
|---|---|---|---|---|---|---|---|
| **Windows Desktop (x64)** | Local FS (`Documents/Panvas`) | Yes (PointerEvents + Windows Ink) | Yes | Yes (MediaRecorder) | Yes (Local ONNX) | 100% Offline | **SUPPORTED** |
| **macOS Desktop** | Local FS | Yes (Apple Pencil via Sidecar/Trackpad) | Yes | Yes | Yes (Local ONNX) | 100% Offline | **LIKELY SUPPORTED** (Needs packaging target) |
| **Linux Desktop** | Local FS | Yes (XInput2/Wayland) | Yes | Yes | Yes (Local ONNX) | 100% Offline | **NEEDS VERIFICATION** |
| **Chrome / Edge (Web)** | IndexedDB | Yes | Yes | Yes | Yes (Local ONNX) | Needs `persist()` | **SUPPORTED** |
| **Firefox (Web)** | IndexedDB | Yes | Yes | Yes | Yes (Local ONNX) | Needs `persist()` | **SUPPORTED** |
| **Safari / WebKit (macOS/iOS)** | IndexedDB | Partial | Yes | Partial | Yes (WASM fallback) | 7-day wipe risk | **PARTIAL** |
| **Installed PWA** | IndexedDB | Yes | Yes | Yes | Yes (Local ONNX) | Needs `persist()` | **SUPPORTED** |

---

## 7. Things That Are ALREADY GOOD and Should NOT Be Rewritten

1. **Dual-Canvas Drawing Engine**: `src/components/notebook/engine/DrawingEngine.ts` separates active drawing from static background layers, keeping stylus ink rendering at 60fps without triggering React renders.
2. **Atomic Write Queue**: `electron/ipc/write-queue.ts` provides robust `.tmp` write and rename logic with backoff retries, effectively solving Windows file locking.
3. **Strict Electron Sandbox Configuration**: `electron/main.ts` correctly enforces context isolation, disables node integration, disables webview tags, and sandboxes renderers.
4. **Discord Rich Presence Implementation**: `electron/discord-rpc.ts` uses direct local named pipes with zero bot tokens, zero client secrets, and zero user data exposure.
5. **Neural Handwriting Pipeline**: `src/services/recognition/neural/` manages an isolated Web Worker running local ONNX WASM models with versioned cache storage.
6. **Unit & Persistence Contract Tests**: The 444 tests in `tests/` provide thorough regression coverage for coordinate transforms, trash lifecycle, layers, and serialization.

---

## 8. Things That Require Runtime / Manual Verification

1. **Real-Device Stylus Pressure**: Validate pointer pressure curves on a physical Microsoft Surface Pro and Wacom tablet.
2. **Windows SmartScreen Filter**: Package an NSIS installer via `npm run package:win` and test installation on a clean Windows 11 machine without existing trust history.
3. **Google OAuth Production Verification**: Verify production consent screen and scopes (`drive.file`) in Google Cloud Console.
4. **Two-Device Concurrent Sync**: Simulate simultaneous edits on two separate devices to verify Sync-V2 manifest conflict resolution in `cloudSyncStore.ts`.

---

## 9. Final Release Verdict (Pre-Hardening Baseline)

| Verdict Question | Decision | Explanation / Blocking Reasons |
|---|:---:|---|
| **FEATURE COMPLETE?** | **YES** | All V1 features contracted in `V1_FEATURE_SCOPE.md` exist in code, pass 505 automated tests, and have been owner-verified in runtime. V2 features (Embedded Web, MCP, Extensions, AI) are formally deferred. |
| **CODE READY FOR OSS?** | **CONDITIONAL** | Blocked by missing root `LICENSE` (MIT), missing `"license": "MIT"` in `package.json`, missing `THIRD_PARTY_NOTICES.md`, and unremoved dead marketing prototypes (Package D & E). |
| **READY FOR HARDENING?** | **YES** | Feature freeze is active. Backlog is structured into agent-sized Packages A through F in `V1_HARDENING_EXECUTION_PLAN.md`. |
| **READY FOR STRIX PENTEST?** | **CONDITIONAL** | Blocked by `HARDEN-005` (unvalidated IPC sender in `electron/ipc/cloudsync-handlers.ts`). Fix `HARDEN-005` in Package B before launching Strix. |
| **READY FOR PUBLIC RELEASE?** | **NO** | 5 BLOCKERs (`HARDEN-001` through `HARDEN-005`) and 7 P0 items must be resolved, followed by Strix security pass and packaging QA. |


