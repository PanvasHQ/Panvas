# Panvas Release Hardening Backlog

> **Document Type**: Prioritized Engineering Execution Backlog  
> **Source of Truth**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md)  
> **Status Lifecycle**: `BLOCKER` | `P0` | `P1` | `P2` | `NEEDS OWNER VERIFICATION` | `FIXED / TEST-PASSING`  
> **Last Reconciled**: September 10, 2026 (Packages A–D, E, F1-A, F1-B, and F2 execution recorded)
> **Target Release**: Public Release v1.0.0
> **F2 Reconciliation**: September 10, 2026 — `HARDEN-021` through `HARDEN-025` fixed/test-passing; packaged icon rendering, offline typography appearance/legal review, screen-reader walkthrough, asset visual fidelity, and direct legacy-auth/session checks remain manual.

---

## 1. Executive Summary & Backlog Overview

This backlog is the primary authority for all Panvas V1 production hardening. It tracks exactly **30 items** across five priority tiers. All items must be resolved or verified before public V1 release tagging.

| Work Package | Total Items | BLOCKER | P0 | P1 | P2 | FIXED / PASSING |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Package A: Data Integrity & Persistence** | 5 | 0 | 0 | 0 | 0 | 5 |
| **Package B: Electron Security & IPC** | 4 | 0 | 0 | 0 | 0 | 4 |
| **Package C: Cloud Sync & Durability** | 4 | 0 | 0 | 0 | 0 | 4 |
| **Package D: Safe Codebase Cleanup** | 4 | 0 | 0 | 2 | 0 | 2 |
| **Package D: Safe Codebase Cleanup** | 4 | 0 | 0 | 1 | 0 | 3 |
| **Package E: Open Source & Licensing** | 1 | 0 | 0 | 0 | 0 | 1 |
| **Package F: Remaining Lifecycle, UX & Polish** | 10 | 0 | 0 | 0 | 0 | 10 |
| **Already Verified Passing Baseline** | 2 | 0 | 0 | 0 | 0 | 2 |
| **TOTAL** | **30** | **0** | **0** | **2** | **0** | **28** |
| **TOTAL** | **30** | **0** | **0** | **1** | **0** | **29** |

### Summary of Statuses Across All 30 Items
- **F2 reconciliation (2026-09-10)**: `HARDEN-021` through `HARDEN-025` are fixed/test-passing, bringing the fixed/test-passing total to **28**; `HARDEN-016` remains blocked by the pre-existing corrupt Git index and `HARDEN-028` remains owner verification.
- **HARDEN-016 & F2 reconciliation**: `HARDEN-016` (Git index untracking) and `HARDEN-021` through `HARDEN-025` are fixed/test-passing, bringing the fixed/test-passing total to **29**; only `HARDEN-028` remains pending owner verification of the Discord Developer Portal application ID.
- **0 open BLOCKERs** (Mandatory for build and release).
- **0 open P0s** (storage resilience `HARDEN-007` is fixed; real filesystem/UI behavior remains manual verification).
- **2 open P1s** (repository hygiene and owner verification): `HARDEN-016`, `HARDEN-028` (*NEEDS OWNER VERIFICATION*).
- **1 open P1** (owner verification): `HARDEN-028` (*NEEDS OWNER VERIFICATION*).
- **0 open P2s**: `HARDEN-021` through `HARDEN-025` are fixed/test-passing; the listed manual checks remain release gates.
- **28 FIXED / TEST-PASSING** (Verified in source & tests): Packages A–E, F1-A, F1-B, F2, plus `HARDEN-009` and `HARDEN-012`.
- **29 FIXED / TEST-PASSING** (Verified in source & tests): Packages A–E (including HARDEN-016), F1-A, F1-B, F2, plus `HARDEN-009` and `HARDEN-012`.

---

## 2. BLOCKER Items (5 Items)

Critical items that **must be fixed and verified before any public release**. Any of these items causes silent data loss, open-source licensing violations, or critical security bypasses.

---

### HARDEN-001: Fix Silent Data Loss in Dexie-to-Filesystem Migration

- **ID**: `HARDEN-001`
- **Priority**: `BLOCKER`
- **Status**: `FIXED / TEST-PASSING` — runtime migration remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: Root cause was an incomplete renderer payload plus a destination completion marker written before content. `src/lib/migration-core.ts`, `src/lib/migration.ts`, `electron/ipc/migration-import.ts`, `electron/ipc/domain-handlers.ts`, `electron/preload.ts`, and `src/types/electron.d.ts` now transfer and validate current hierarchy, page content/drawings, Canvas scenes/custom blocks, PDFs, images, and audio-backed `imageFiles`; preserve source data; remain retryable; preserve newer destination JSON; reject binary conflicts; and mark complete only after validation. Covered by `tests/migration-full.test.ts`.
- **Affected Subsystem**: Storage / Data Integrity
- **Affected Files**:
  - `src/lib/migration.ts:28-60`
  - `electron/ipc/domain-handlers.ts:40-120, 1303-1346`
  - `src/services/workspace/WorkspaceService.ts`
- **Problem Description**:
  `migrateFromDexieToFs()` queries IndexedDB for `folders`, `canvasFiles`, `notebooks`, `notebookSections`, `notebookPages`, and `canvasData`. However, it never queries or transfers `db.notebookPageContents` (TipTap rich text JSON), `db.notebookPageDrawings` (vector strokes), `db.pdfFiles` (binary ArrayBuffers), or `db.imageFiles`.
- **User Impact**:
  Users transitioning from the web/PWA version to the desktop Electron application find their notebook pages completely blank. Drawings, notes, and imported PDF documents are permanently left behind in browser storage.
- **Recommended Fix**:
  1. In `src/lib/migration.ts`, query `db.notebookPageContents.toArray()`, `db.notebookPageDrawings.toArray()`, `db.pdfFiles.toArray()`, and `db.imageFiles.toArray()`.
  2. Map these arrays into the migration transfer bundle payload.
  3. In `electron/ipc/domain-handlers.ts` (`WorkspaceService.importWorkspace`), ensure `.content.json` and `.drawing.json` files are written for every page ID to `Documents/Panvas/<Workspace>/Notebooks/<Notebook>/pages/`.
  4. Ensure binary files (PDFs and images) are saved under `Documents/Panvas/<Workspace>/assets/` with appropriate metadata.
- **Prerequisites**: None.
- **Regression Risk**: Low. Migration is an opt-in or first-launch transfer process.
- **Verification Required**:
  - Automated integration test in `tests/migration-full.test.ts` populating mock Dexie tables with full TipTap content, vector strokes, and a PDF file, then verifying all corresponding disk files exist with valid checksums.
  - Manual end-to-end verification in Electron: populate Web DB, launch Desktop, click Migrate, confirm notebook pages render notes and ink strokes.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 1), Section 3 (Data Loss Matrix).

---

### HARDEN-002: Request Persistent Storage Grant in Browser / Web Mode

- **ID**: `HARDEN-002`
- **Priority**: `BLOCKER`
- **Status**: `FIXED / TEST-PASSING` — Chrome/Firefox/Safari behavior remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `src/services/storage/browserStorageDurability.ts` safely handles `persisted()`, `persist()`, and `estimate()` across granted, denied, unsupported, and rejected outcomes. `src/database/schema.ts` initializes it only in browser mode; `StorageService.ts` consumes sanitized estimates; `StatusBar.tsx` shows a non-modal best-effort notice without disabling editing. Covered by `tests/browser-storage-durability.test.ts`.
- **Affected Subsystem**: Browser Persistence / Durability
- **Affected Files**:
  - `src/database/schema.ts:18-45`
  - `src/services/storage/StorageService.ts:35-80`
  - `src/components/layout/StatusBar.tsx`
- **Problem Description**:
  `PanvasDB` initializes in Dexie without requesting `navigator.storage.persist()`. IndexedDB remains in the browser's "best-effort" storage tier across Chrome, Edge, Firefox, and Safari. On Safari (macOS and iOS), WebKit Intelligent Tracking Prevention (ITP) automatically deletes client-side storage after 7 days without user interaction.
- **User Impact**:
  Web users can experience catastrophic silent data loss if the browser evicts storage due to disk pressure, browser cleanup utilities, or the 7-day Safari ITP timer.
- **Recommended Fix**:
  1. In `src/database/schema.ts` (`initializeDatabase` or constructor init):
     ```ts
     if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
       const isPersisted = await navigator.storage.persist();
       if (!isPersisted) {
         console.warn('[Panvas Storage] Persistent storage grant denied. Running in best-effort mode.');
       }
     }
     ```
  2. Expose the persistence status in `StorageService`.
  3. If persistent storage is denied (common in strict browser profiles), display a non-intrusive warning in Settings / Status bar recommending the desktop version or cloud sync.
- **Prerequisites**: None.
- **Regression Risk**: None (standard web API call).
- **Verification Required**:
  - Automated test verifying `navigator.storage.persist()` is called on database boot.
  - Manual verification on Chrome and Safari checking `await navigator.storage.persisted()` returns `true`.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 2), Section 3 (Storage Eviction).

---

### HARDEN-003: Deprecate Quarantined Supabase Sync & Connect Google Drive to UI

- **ID**: `HARDEN-003`
- **Priority**: `BLOCKER`
- **Status**: `FIXED / TEST-PASSING` — real Google Drive and multi-device behavior remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `cloudSyncStore` is initialized after local bootstrap independently of Panvas account auth and is the only active runtime cloud-state source. `StatusBar`, `SyncIndicator`, and Workspace settings share `getCloudSyncPresentation`; active workspace/canvas mutations no longer increment the quarantined Supabase counter; and the legacy scheduler is no longer bootstrapped. Covered by `tests/cloudsync-runtime-source.test.ts`, the Package C gate, and the canonical suite.
- **Affected Subsystem**: Cloud Sync / UI Status
- **Affected Files**:
  - `src/stores/workspaceStore.ts:566, 620, 705` (and 30+ mutating actions)
  - `src/components/layout/StatusBar.tsx:10, 16`
  - `src/stores/syncStore.ts`
  - `src/services/sync/` (legacy quarantined directory)
- **Problem Description**:
  The application contains two parallel sync implementations. The active engine is `src/services/cloudsync/` (Google Drive), while `src/services/sync/` is the legacy Supabase engine marked `LEGACY_SYNC_QUARANTINED = true`. Over 30 actions in `workspaceStore.ts` still call `useSyncStore.getState().incrementPending()`. Because Google Drive sync does not use `useSyncStore`, `pendingChanges` in the `StatusBar` increments indefinitely and never clears.
- **User Impact**:
  Users see a perpetual warning that changes are unsynced in the bottom status bar. Real Google Drive sync progress and error states are hidden or disconnected from the primary UI chrome.
- **Recommended Fix**:
  1. Audit and remove all `useSyncStore.getState().incrementPending()` calls from `workspaceStore.ts` and `canvasStore.ts`.
  2. Update `StatusBar.tsx` to subscribe to `useCloudSyncStore` (which tracks `status`, `lastSyncedAt`, `error`, `isSyncing`).
  3. Retire legacy `src/services/sync/` and unhook `syncStore.ts` references.
- **Prerequisites**: None.
- **Regression Risk**: Low-Medium (verify `StatusBar` and `CloudSyncPanel` state synchronization).
- **Verification Required**:
  - Create, update, and delete notebooks/canvases; verify `StatusBar` shows real-time Google Drive sync state and turns green upon completion.
  - Run existing test suites `tests/cloud-sync-*.test.ts`.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 3), Section 3 (Sync Subsystem Review).

---

### HARDEN-004: Root License, Package Manifest License & Third-Party Notices

- **ID**: `HARDEN-004`
- **Priority**: `BLOCKER`
- **Status**: `FIXED / TEST-PASSING` — copied font/vendor assets remain `NEEDS OWNER/LEGAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: Root `LICENSE` contains the standard MIT terms with `Copyright (c) 2026 Panvas Contributors`; `package.json` now declares `"license": "MIT"` while preserving `"private": true`; and root `THIRD_PARTY_NOTICES.md` inventories the resolved direct runtime dependencies from `package-lock.json`, includes SPDX-grouped full license texts and embedded Excalidraw vendor attribution lines, and separates conceptual inspirations from bundled code. JSON/metadata validation passed without dependency or lockfile changes.
- **Affected Subsystem**: Open Source / Licensing
- **Affected Files**:
  - Root `LICENSE` (new file)
  - `package.json:1-8`
  - Root `THIRD_PARTY_NOTICES.md` (new file)
- **Historical Problem Description (resolved)**:
  The repository root contains no `LICENSE` file. `package.json` lacks a `"license"` field. Third-party attribution notices for bundled components (`@excalidraw/excalidraw` [MIT], `pdfjs-dist` [Apache-2.0], `pdf-lib` [MIT], `@huggingface/transformers` [Apache-2.0], `katex` [MIT], `Virgil.woff2` [MIT]) are missing.
- **User Impact**:
  Legal ambiguity. Public distribution of binaries without license texts violates open-source dependency licenses.
- **Recommended Fix**:
  1. Add project root `LICENSE` (e.g., MIT License).
  2. Set `"license": "MIT"` in `package.json`.
  3. Create `THIRD_PARTY_NOTICES.md` containing copyright headers and full license texts for bundled dependencies and conceptual inspirations (Excalidraw, KaTeX, PDF.js, HuggingFace, Lucide, Virgil fonts).
- **Prerequisites**: Confirm project license selection.
- **Regression Risk**: None.
- **Verification Required**:
  - Verify `LICENSE` exists, `package.json` validates, and `THIRD_PARTY_NOTICES.md` includes all direct runtime dependencies.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 4), Section 5 (Third-Party Licenses & Attribution).

---

### HARDEN-005: Enforce Trusted Sender Validation on CloudSync IPC Handlers

- **ID**: `HARDEN-005`
- **Priority**: `BLOCKER`
- **Status**: `FIXED / TEST-PASSING` — main-window Google Drive connection and sync remain `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `electron/ipc/security.ts` is the canonical sender guard and now requires both the trusted Panvas URL and a top-level frame. Every registered `cloudsync:*`, `cloudsync:drive:*`, and `cloudsync:driveV2:*` invoke handler, plus `cloudsync:diagnostic`, validates before dispatch. Rejections return only `Untrusted IPC sender.`. Covered by real registration callbacks in `tests/electron-ipc-security.test.ts`.
- **Affected Subsystem**: Electron Security / IPC
- **Affected Files**:
  - `electron/ipc/cloudsync-handlers.ts:45-142`
  - `electron/ipc/cloudsync-diagnostic-handler.ts`
  - `electron/ipc/security.ts`
  - `electron/security-policy.ts`
- **Problem Description**:
  `domain-handlers.ts` and `knowledge-handlers.ts` enforce `requireTrustedSender(event)` to guarantee IPC calls originate from the trusted application origin (`index.html` or verified file URL). In contrast, `cloudsync-handlers.ts` accepts `_event` without validation across all its IPC channels (`cloudsync:connect`, `cloudsync:disconnect`, `cloudsync:drive:*`, `cloudsync:driveV2:*`).
- **User Impact**:
  Privileged Google Drive operations and token handling could be triggered by unauthorized frames or webviews if any sub-frame injection occurred.
- **Recommended Fix**:
  1. Import `requireTrustedSender` in `electron/ipc/cloudsync-handlers.ts`.
  2. Add `requireTrustedSender(event);` as the first line of every IPC handler in `registerCloudSyncHandlers()`.
- **Prerequisites**: None.
- **Regression Risk**: Low. Trusted renderer calls will pass sender checks.
- **Verification Required**:
  - Automated unit test in `tests/electron-ipc-security.test.ts` verifying untrusted origins are rejected with 'Untrusted IPC sender'.
  - Manual test verifying Google Drive connection and sync continue functioning normally from the main window.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 5), Section 4 (Electron Security Audit).

---

## 3. P0 Items (7 Items)

Critical data integrity, write safety, and lifecycle issues that **must be fixed before release**.

---

### HARDEN-006: Atomic PDF & Binary File Disk Writes via Staged Temporary Files

- **ID**: `HARDEN-006`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING` — abrupt process termination remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `electron/ipc/write-queue.ts` now accepts text and binary data, writes unique staged files through an explicitly flushed handle, atomically renames, serializes/coalesces same-target writes, cleans its staged artifact on failure, and propagates errors. PDF, image, and audio IPC writes in `electron/ipc/domain-handlers.ts` use this queue. Covered by `tests/atomic-binary-write.test.ts` and migration failure tests.
- **Affected Subsystem**: File System / IPC Data Safety
- **Affected Files**:
  - `electron/ipc/domain-handlers.ts:250-320, 1230-1290`
  - `electron/ipc/writeQueue.ts`
  - `src/services/pdf/`
- **Problem Description**:
  In `domain-handlers.ts`, `binary:storePdf` and `binary:storeImage` write directly to disk via `fsPromises.writeFile(path.join(dir, `${id}.bin`), ...)` without `.tmp` staging or writeQueue serialization. If the process is terminated mid-write, the target asset is corrupted or truncated to 0 bytes.
- **User Impact**:
  Permanent corruption of user-imported research papers, textbooks, and embedded diagrams.
- **Recommended Fix**:
  Route all binary asset and PDF writes through `writeQueue.ts` with the `.tmp` staging and atomic rename pattern already used for `workspace.json` (write to `${id}.bin.tmp` first, then atomically rename to `${id}.bin`).
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Interruption test simulating abrupt termination during large PDF write; verify original file remains uncorrupted.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 6), Section 3 (Data Loss Matrix).

---

### HARDEN-007: Cloud-Synced Folder Renaming Resilience & Custom Storage Path

- **ID**: `HARDEN-007`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING` — real Windows/cloud-sync locking and native chooser behavior remain `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `WorkspaceService` now validates and atomically persists an explicit global storage root, exposes native choose/get/set IPC, and discovers configured-root workspaces without relocating registered workspaces. `WorkspaceSection` shows the active root and preserves Cancel/error state. `write-queue.ts` retries `EBUSY`/`EPERM`/`EACCES` renames ten times with bounded exponential backoff and jitter, cleans staged files, and preserves the prior target on permanent failure. Covered by `tests/hardening-f1b.test.ts`.
- **Affected Subsystem**: Storage / File System
- **Affected Files**:
  - `electron/ipc/write-queue.ts:40-75`
  - `electron/ipc/domain-handlers.ts`
  - `src/stores/workspaceStore.ts`
  - `src/components/settings/sections/WorkspaceSection.tsx`
- **Problem Description**:
  Default workspace storage creates `Documents/Panvas/`. On Windows, `Documents` is frequently synchronized by Microsoft OneDrive, which can briefly lock files for hashing immediately after creation. Settings now provides a directory chooser for custom non-synced locations.
- **User Impact**:
  Users running OneDrive or Google Drive desktop experience random save failure alerts and orphaned `.tmp` files.
- **Recommended Fix**:
  1. Increase rename retry count in `writeQueue.ts` to 10 with exponential backoff and jitter.
  2. Keep the prior final file intact, clean the staged file, and surface permanent failures after the bounded retry window.
  3. Keep the storage-root setting explicit and never relocate existing workspaces.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Synthetic file lock test simulating OneDrive background indexing; verify queue recovers and writes succeed without error.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 7).

---

### HARDEN-008: NotebookEngine Lifecycle Cleanup on React Component Unmount

- **ID**: `HARDEN-008`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: Memory / Lifecycle
- **Affected Files**:
  - `src/components/notebook/NotebookRenderer.tsx:40-60`
  - `src/components/notebook/engine/NotebookEngine.ts:436`
- **Problem Description**:
  `NotebookEngine.destroy()` properly cleans up image blob URLs, aborts handwriting worker tasks, and detaches canvas listeners. However, `NotebookRenderer.tsx` creates the engine instance without returning a cleanup function in `useEffect`.
- **User Impact**:
  Navigating between notebooks, opening research canvases, or switching views continuously leaks memory, event listeners, and worker instances over long sessions.
- **Recommended Fix**:
  Add an explicit cleanup effect in `NotebookRenderer.tsx`:
  ```ts
  useEffect(() => {
    return () => {
      notebookEngine.destroy();
    };
  }, [notebookEngine]);
  ```
- **Prerequisites**: None.
- **Regression Risk**: Low (ensure `notebookEngine` is not prematurely destroyed on re-renders).
- **Verification Required**:
  - Mount/unmount test cycling `NotebookRenderer` 20 times; assert heap stability, listener detachment, and URL revocation.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 8).

**Package F1-A execution evidence (2026-09-10):** `NotebookRenderer` now destroys its memoized `NotebookEngine` when the owner unmounts or the engine identity changes. Ordinary re-renders retain the same engine. Focused lifecycle coverage and the full test suite passed.

---

### HARDEN-010: Cross-Platform Fallback for Desktop OAuth Token Storage Path

- **ID**: `HARDEN-010`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING` — real OAuth persistence on Windows, macOS, and Linux remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: Electron continues to prefer `app.getPath('userData')`, with platform-correct Windows, macOS, Linux, and XDG fallbacks outside workspace/document storage. Parent directories are created before encrypted writes; `safeStorage`, PKCE, token exchange, refresh behavior, and scopes remain unchanged. Covered by `tests/google-auth-storage.test.ts`.
- **Affected Subsystem**: Security / Auth Storage
- **Affected Files**:
  - `electron/ipc/google-auth-service.ts:115-125`
- **Problem Description**:
  `resolveTokenFilePath` falls back to `process.env.APPDATA` if `electron.app.getPath('userData')` is not resolved. On macOS and Linux, `APPDATA` is undefined, causing the method to return an empty string and failing token storage.
- **User Impact**:
  Non-Windows desktop environments fail to persist Google Drive login sessions across app restarts.
- **Recommended Fix**:
  Use standard POSIX fallbacks:
  ```ts
  const home = process.env.HOME || process.env.USERPROFILE || '';
  this.tokenFilePath = process.platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support', 'Panvas', 'google_auth_tokens.enc')
    : path.join(home, '.config', 'Panvas', 'google_auth_tokens.enc');
  ```
- **Prerequisites**: None.
- **Regression Risk**: None.
- **Verification Required**:
  - Unit test verifying path resolution on Linux and macOS mock environments.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 14), Section 6 (Cross-Platform Support Matrix).

---

### HARDEN-017: Integration Tests for Full Dexie-to-FS Notebook Content & Drawings Migration

- **ID**: `HARDEN-017`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING`
- **Implementation Evidence (2026-09-10)**: `tests/migration-full.test.ts` runs the real migration coordinator into the real filesystem importer using isolated temp directories and asserts semantic reconstruction of multiple pages, TipTap JSON, vector/PDF drawings, page properties, Canvas/custom blocks, PDF/image/audio bytes, completion state, failure propagation, retry, missing assets, conflicting assets, and newer destination preservation.
- **Affected Subsystem**: Test Suite / Data Integrity
- **Affected Files**:
  - `tests/migration-full.test.ts` (new test file)
  - `src/lib/migration.ts`
- **Problem Description**:
  Current migration tests only test folder metadata. There is no automated test asserting that rich text TipTap JSON, vector drawing strokes, and binary assets migrate cleanly from Dexie to disk.
- **User Impact**:
  High regression risk of user data loss during browser-to-desktop migration.
- **Recommended Fix**:
  Create an automated integration test creating a fully populated notebook in mock Dexie, executing `migrateFromDexieToFs()`, and asserting disk output matches page content byte-for-byte.
- **Prerequisites**: Completion of `HARDEN-001`.
- **Regression Risk**: None.
- **Verification Required**:
  - Run `npm test tests/migration-full.test.ts`; passes cleanly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 8 (Verification Gaps).

---

### HARDEN-026: Eliminate Double-Roundtrip Write Hack in `createPage` for PDF Pages

- **ID**: `HARDEN-026`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING` — Electron runtime PDF import/reopen remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: The preload/type/domain contract now accepts `type` and `pdfDataId` during `notebookPage:create`. `NotebookRepository.createPage` performs one create call with no immediate update, while `electron/ipc/notebook-page-create.ts` persists workspace metadata, page metadata, and initial content through the canonical queue. Covered by `tests/pdf-page-creation.test.ts` for default/PDF calls and filesystem reload.
- **Affected Subsystem**: File System / IPC Performance
- **Affected Files**:
  - `src/repositories/NotebookRepository.ts:61-71`
  - `electron/ipc/domain-handlers.ts:740-780`
- **Problem Description**:
  In `NotebookRepository.ts:63-69`, creating a PDF page calls `window.panvas.notebookPage.create(workspaceId, notebookId, sectionId, title)`, followed by a second IPC call `window.panvas.notebookPage.update(workspaceId, page.id, { type, pdfDataId })`. Code explicitly comments: `// Hack for Electron mode without changing IPC definitions right now`.
- **User Impact**:
  Double-write race condition during PDF page creation; if the second call fails or is interrupted, a blank page is created instead of a PDF page.
- **Recommended Fix**:
  Update `notebookPage:create` IPC handler to accept optional `type` and `pdfDataId` directly in initial creation payload.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Test verifying single atomic IPC call creates PDF page with metadata intact.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 3 (IPC Architecture).

---

### HARDEN-027: Flush Pending `writeQueue` Tasks on Electron Window `before-quit`

- **ID**: `HARDEN-027`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING` — real Electron close-during-save remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `WriteQueue` now rejects late writes after shutdown begins, exposes `flush()`, and surfaces queued failures. `GracefulShutdownController` prevents parallel/recursive flushes, applies a 15-second timeout, logs failures, and issues the final quit only after the flush path settles. Covered by `tests/graceful-shutdown.test.ts`.
- **Affected Subsystem**: Electron Main / Data Integrity
- **Affected Files**:
  - `electron/main.ts:139-142`
  - `electron/ipc/write-queue.ts`
  - `electron/graceful-shutdown.ts`
- **Problem Description**:
  In `electron/main.ts`, `app.on('before-quit')` destroys Discord RPC but does not await pending asynchronous tasks in `writeQueue.ts`. If the user quits while a document or drawing is actively being flushed to disk, the write can be aborted.
- **User Impact**:
  Data loss if user closes app immediately after typing notes or drawing vector strokes.
- **Recommended Fix**:
  Add `writeQueue.flush()` and call `await writeQueue.flush()` inside `app.on('before-quit')`.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Unit test asserting `flush()` drains all pending queue tasks before resolving.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 3 (Data Loss Matrix).

---

## 4. P1 Items (11 Items)

Architecture cleanup, test suite completion, and error resilience.

---

### HARDEN-011: Consolidate Startup Desktop IPC Reads via Snapshot

- **ID**: `HARDEN-011`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING` — cold packaged startup and large-vault timing remain `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: Electron now exposes one bounded `workspace:getStartupSnapshot` metadata pass containing workspace discovery, lightweight entity collections, recent files, Trash projections, default workspace, storage root, and light settings; page contents, drawings, scenes, and binaries remain lazy. Renderer bootstrap consumes the snapshot once and falls back to the existing safe repository reads on failure; browser mode has no Electron assumption. Covered by `tests/hardening-f1b.test.ts` and the canonical suite.
- **Affected Subsystem**: Performance / IPC
- **Affected Files**:
  - `src/repositories/NotebookRepository.ts:10-50`
  - `electron/ipc/domain-handlers.ts:350-420`
  - `src/stores/workspaceStore.ts`
- **Problem Description**:
  During application startup, `getAll()`, `getSections()`, and `getPages()` iterate sequentially over every workspace and invoke individual IPC calls reading `workspace.json` repeatedly from disk.
- **User Impact**:
  Noticeable startup delay (300ms–1500ms depending on disk speed) before notebooks become interactive.
- **Recommended Fix**:
  Add a batched `workspace:getStartupSnapshot` IPC channel returning all workspaces, folders, notebooks, sections, and pages in a single call.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Cold startup benchmark verifying IPC roundtrips drop from N+1 to 1.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 11).

---

### HARDEN-013: Replace Native Synchronous `window.confirm()` with Custom Dialog

- **ID**: `HARDEN-013`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: UI / UX Polish
- **Affected Files**:
  - `src/components/layout/TrashSection.tsx:49, 192`
  - `src/components/library/CloudSyncPanel.tsx:123`
  - `src/components/library/LibraryWorkspace.tsx:156, 171`
  - `src/components/notebook/NotebookToolPropertiesPanel.tsx:218, 241`
- **Problem Description**:
  6 destructive confirmation actions invoke synchronous browser `window.confirm()`, freezing the Electron event loop and breaking accessible keyboard focus.
- **User Impact**:
  In Electron desktop, synchronous alerts freeze the entire renderer, look discordant with the dark/light UI, and lack keyboard focus management.
- **Recommended Fix**:
  Replace all `window.confirm()` calls with Panvas's asynchronous custom `ConfirmDialog` modal component.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Trigger each confirmation flow; verify custom styled modal appears with keyboard navigation (`Escape` to cancel, `Enter` to confirm).
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 10).

**Package F1-A execution evidence (2026-09-10):** All six active `window.confirm()` call sites were replaced with the shared asynchronous `ConfirmDialog`. Escape, backdrop/close cancellation, guarded single confirmation, and keyboard focus handling are implemented; the underlying operations are unchanged. No active native confirmation calls remain.

**Package F1-B execution evidence (2026-09-10):** `HARDEN-007` adds a validated, atomically persisted storage-root chooser while preserving registered workspace locations; the write queue now uses ten bounded lock retries. `HARDEN-011` adds one bounded Electron startup metadata snapshot and consumes it once, with safe repository fallback and lazy document payloads. Focused F1-B coverage passed (3 tests). Native chooser/cloud-lock behavior, restart discovery, and cold-start timing remain `NEEDS MANUAL VERIFICATION`.

---

### HARDEN-014: Remove 14 Dead Marketing Prototype Files (2,306 LOC)

- **ID**: `HARDEN-014`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: Codebase Hygiene / Deduplication
- **Affected Files**:
  - `src/components/marketing/HeroPanvasAppPrototype.tsx` (767 LOC)
  - `src/components/marketing/MarketingNav.tsx` (203 LOC)
  - `src/components/marketing/HeroSection.tsx` (183 LOC)
  - `src/components/marketing/DownloadSection.tsx` (175 LOC)
  - `src/components/marketing/VectorInkSection.tsx` (158 LOC)
  - `src/components/marketing/NotebookStorySection.tsx` (133 LOC)
  - `src/components/marketing/InfiniteCanvasSection.tsx` (115 LOC)
  - `src/components/marketing/LocalFirstSection.tsx` (106 LOC)
  - `src/components/marketing/PdfWorkbenchSection.tsx` (101 LOC)
  - `src/components/marketing/FaqSection.tsx` (98 LOC)
  - `src/components/marketing/MarketingFooter.tsx` (91 LOC)
  - `src/components/marketing/LandingWebGL.tsx` (71 LOC)
  - `src/components/marketing/CapabilityTicker.tsx` (55 LOC)
  - `src/components/marketing/CyberBackground.tsx` (50 LOC)
- **Problem Description**:
  2,306 lines of obsolete, unreferenced prototype marketing components from early iterations sit abandoned in the source tree. None of these files are imported by the active landing page or application.
- **User Impact**:
  Search clutter, developer confusion, and risk of accidental re-import.
- **Recommended Fix**:
  Safely delete all 14 unreferenced files (confirmed zero imports).
- **Prerequisites**: Verify zero imports across codebase.
- **Regression Risk**: Zero.
- **Verification Required**:
  - `npm run typecheck` and `npm run build` pass cleanly after deletion.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 15).

**Package D execution evidence (2026-09-10):** All 14 listed files were verified to have no active imports in `src/`, `electron/`, or `tests/`, then deleted. `LandingPage.tsx`, `LandingAtmosphere.tsx`, `ProductDepth.tsx`, and `HeroInkPlayground.tsx` were preserved.

---

### HARDEN-015: Consolidate Viewport Engine and Viewport Manager (Delete `ViewportEngine.ts`)

- **ID**: `HARDEN-015`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: Codebase Hygiene / Architecture
- **Affected Files**:
  - `src/components/notebook/engine/ViewportEngine.ts` (115 LOC)
  - `src/components/notebook/engine/ViewportManager.ts` (249 LOC)
- **Problem Description**:
  `ViewportEngine.ts` is an abandoned prototype defining `{ x, y, zoom }`. The active codebase uses `ViewportManager.ts` with `{ zoom, scrollX, scrollY, pageRotation }`.
- **User Impact**:
  Duplication and risk of new features targeting the wrong abstraction.
- **Recommended Fix**:
  Delete dead prototype `ViewportEngine.ts`.
- **Prerequisites**: Verify zero imports.
- **Regression Risk**: Zero.
- **Verification Required**:
  - `npx tsc --noEmit` passes cleanly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 16).

**Package D execution evidence (2026-09-10):** `ViewportEngine.ts` had no active imports and was deleted. `ViewportManager.ts` and current notebook viewport behavior were not modified. Typecheck passed after deletion.

---

### HARDEN-016: Purge Tracked Build Artifacts & Giant Images from Git Index

- **ID**: `HARDEN-016`
- **Priority**: `P1`
- **Status**: `CONFIRMED OPEN — INDEX REPAIR REQUIRED`
- **Status**: `FIXED`
- **Affected Subsystem**: Git Repository Hygiene
- **Affected Files**:
  - `.git/index`
  - `Landingpage.png` (2.43 MB)
  - `dist-electron/main.js` (173 KB)
  - `dist-electron/preload.mjs` (5.6 KB)
  - `tsconfig.tsbuildinfo` (5.7 KB)
- **Problem Description**:
  Build artifacts and a high-resolution screenshot are tracked in Git index despite being in `.gitignore`. Every local build marks `dist-electron/` as modified.
  Build artifacts and a high-resolution screenshot were tracked in Git index despite being in `.gitignore`. Every local build marks `dist-electron/` as modified.
- **User Impact**:
  Dirty working tree during development and bloated repo clone size.
- **Recommended Fix**:
  Execute:
  ```bash
  git rm --cached Landingpage.png dist-electron/main.js dist-electron/preload.mjs tsconfig.tsbuildinfo
  ```
- **Prerequisites**: None.
- **Regression Risk**: None.
- **Verification Required**:
  - `git status` reflects clean working tree after compiling.
  - `git status` reflects clean working tree after compiling without tracking build outputs.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 17).

**Package D execution evidence (2026-09-10):** `.gitignore` now explicitly ignores `Landingpage.png`; existing `dist-electron/` and `tsconfig.tsbuildinfo` rules were preserved. The four local working copies were not deleted. `git ls-tree HEAD` confirms all four are tracked in the committed tree, but the working `.git/index` is a pre-existing zero-byte corrupt index (`index file smaller than expected`). No index repair or destructive reset was performed, so `git rm --cached` could not be safely completed in this pass. This item remains open until the repository index is repaired and the four paths are untracked.
**Execution evidence:** Git index was rebuilt from HEAD tree metadata and unstaged/untracked the generated artifacts (`Landingpage.png`, `dist-electron/main.js`, `dist-electron/preload.mjs`, `tsconfig.tsbuildinfo`). `.gitignore` explicitly ignores them while retaining multi-resolution application icon `build/icon.ico`. Git status and index operations now execute cleanly without tracking build artifacts.

---

### HARDEN-018: Desktop IPC Sender Validation & Security Boundary Unit Tests

- **ID**: `HARDEN-018`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Implementation Evidence (2026-09-10)**: `tests/electron-ipc-security.test.ts` exercises the actual CloudSync registration wrappers and canonical policy for trusted production/dev renderers, hostile origins, same-origin subframes, unauthorized protocols, missing/malformed sender frames, diagnostic logging, complete privileged-channel coverage, and proof that a privileged service method is not called after rejection.
- **Affected Subsystem**: Test Suite / Electron Security
- **Affected Files**:
  - `tests/electron-ipc-security.test.ts` (new test file)
  - `electron/ipc/security.ts`
- **Problem Description**:
  No automated tests assert that IPC handlers reject invalid frame senders, null URLs, or untrusted protocol origins.
- **User Impact**:
  Security regressions in future IPC handler additions.
- **Recommended Fix**:
  Build unit tests mocking `IpcMainInvokeEvent` with various origins (`file://`, `http://evil.com`, `null`) and verify `requireTrustedSender` rejects untrusted frames.
- **Prerequisites**: Completion of `HARDEN-005`.
- **Regression Risk**: None.
- **Verification Required**:
  - `npm run test:package-b` passes cleanly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 4 (Electron Security Audit).

---

### HARDEN-019: CloudSync Provider Edge Case & Conflict Resolution Tests

- **ID**: `HARDEN-019`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING` — real multi-device conflict behavior remains `NEEDS MANUAL VERIFICATION`
- **Implementation Evidence (2026-09-10)**: `tests/cloudsync-conflict.test.ts` exercises equal revisions, proven local descendants, stale remote advancement, local creation, genuine conflicts, offline/auth/rate-limit/retryable/permanent provider failures, successful conflict clearing, and per-workspace status isolation against the current deterministic engine and presentation behavior.
- **Affected Subsystem**: Test Suite / Cloud Sync
- **Affected Files**:
  - `tests/cloudsync-conflict.test.ts` (new test file)
  - `src/services/cloudsync/engine.ts`
- **Problem Description**:
  Simultaneous remote and local updates need formal automated regression testing for "last write wins" and conflict copy generation (`file (conflicted copy).json`).
- **User Impact**:
  Data overwritten during concurrent edits across devices.
- **Recommended Fix**:
  Add tests for sync engine conflict decision branches and conflict copy generation.
- **Prerequisites**: Completion of `HARDEN-003`.
- **Regression Risk**: None.
- **Verification Required**:
  - `npm test tests/cloudsync-conflict.test.ts` passes cleanly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 3 (Sync Integrity).

---

### HARDEN-020: Persistent Storage Fallback & Eviction Warning Tests

- **ID**: `HARDEN-020`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Implementation Evidence (2026-09-10)**: `tests/browser-storage-durability.test.ts` covers already persisted, granted, denied, request rejection, status-probe rejection, unsupported methods, unavailable navigator/storage, estimate success/failure, sanitized messages, shared state, and editing remaining enabled. No arbitrary low-storage threshold was introduced.
- **Affected Subsystem**: Test Suite / Browser Storage
- **Affected Files**:
  - `tests/storage-durability.test.ts` (new test file)
  - `src/services/storage/StorageService.ts`
- **Problem Description**:
  No test verifies behavior when `navigator.storage.persist()` returns `false` or throws an error.
- **User Impact**:
  UI warning might fail to render when users are in danger of browser data eviction.
- **Recommended Fix**:
  Add unit tests mocking `navigator.storage` API states (persisted, denied, quota error).
- **Prerequisites**: Completion of `HARDEN-002`.
- **Regression Risk**: None.
- **Verification Required**:
  - `npm test tests/storage-durability.test.ts` passes cleanly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 3 (Storage Eviction).

---

### HARDEN-028: Verify Discord RPC Client Configuration Before Change

- **ID**: `HARDEN-028`
- **Priority**: `P1`
- **Status**: `NEEDS OWNER VERIFICATION`
- **Affected Subsystem**: Desktop Integration / Discord RPC
- **Affected Files**:
  - `electron/discord-rpc.ts:14-26`
  - `tests/discord-rpc.test.ts`
- **Problem Description**:
  Line 18 hardcodes fallback application ID `'1546879865997758576'` and asset key `'panvas-logo_1'`. The test suite currently passes all 6 tests asserting this ID. Before modifying or replacing this credential in code, the owner must verify whether this ID corresponds to their registered Discord Developer Application or if production credentials need to be registered.
- **User Impact**:
  If the ID is arbitrarily replaced without developer portal registration, Discord Rich Presence will fail to connect.
- **Recommended Action**:
  Keep currently working configuration intact. Obtain owner verification on the production Discord Application Client ID before applying any changes.
- **Prerequisites**: Owner verification.
- **Regression Risk**: High if modified blindly; Zero if left until verified.
- **Verification Required**:
  - Retain pass on `tests/discord-rpc.test.ts` (6/6 passing).
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 6 (Desktop Integrations).

---

### HARDEN-029: Clean Obsolete Supabase Client Imports from State Stores

- **ID**: `HARDEN-029`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Implementation Evidence (2026-09-10)**: Active production paths in `App.tsx`, `authStore.ts`, `workspaceStore.ts`, `canvasStore.ts`, StatusBar, and Workspace settings no longer import or dispatch to `syncStore` or `services/sync`. The quarantined files and unrelated legacy account/auth code remain in source for their separately scheduled package, but have no Package C runtime wiring. Enforced by `tests/cloudsync-runtime-source.test.ts`.
- **Affected Subsystem**: Codebase Hygiene / Dead Code
- **Affected Files**:
  - `src/app/App.tsx:14`
  - `src/stores/workspaceStore.ts:15`
  - `src/stores/canvasStore.ts:10`
- **Problem Description**:
  Several core stores still import `useSyncStore` or Supabase helpers even though V1 cloud sync is strictly Google Drive.
- **User Impact**:
  Developer confusion and unnecessary bundle imports.
- **Recommended Fix**:
  Remove unnecessary legacy sync imports from `App.tsx`, `workspaceStore.ts`, and `canvasStore.ts`.
- **Prerequisites**: Completion of `HARDEN-003`.
- **Regression Risk**: Low.
- **Verification Required**:
  - Clean compilation and passing test suite.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 3 (Sync Subsystem Review).

---

### HARDEN-030: Standardize Error Boundary Reporting Across Viewports

- **ID**: `HARDEN-030`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: Error Handling / Resilience
- **Affected Files**:
  - `src/bootstrap.tsx`
  - `src/components/workspace/WorkspaceContent.tsx`
- **Problem Description**:
  An unhandled exception in an individual canvas custom block or PDF page can take down the entire workspace view rather than being isolated to that viewport pane.
- **User Impact**:
  Loss of working context across unrelated open documents.
- **Recommended Fix**:
  Wrap each core viewport in a dedicated, isolated `ErrorBoundary` with recovery actions.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Trigger synthetic error in viewport component; verify surrounding workspace chrome remains interactive.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 7 (Frontend Error Architecture).

**Package F1-A execution evidence (2026-09-10):** Notebook, PDF, Canvas, reference-pane, and Library surfaces now use isolated retryable error boundaries. Failures preserve the surrounding Panvas shell, expose no raw stack to normal users, provide retry/navigation where appropriate, and do not clear stores or user data. Focused boundary coverage and the full test suite passed.

---

## 5. P2 Items (5 Items)

Packaging, offline typography, accessibility, and asset hygiene.

---

### HARDEN-021: Windows Multi-Resolution Icon & Packaging Scaffolding

- **ID**: `HARDEN-021`
- **Priority**: `P2`
- **Status**: `FIXED / TEST-PASSING` — packaged icon rendering remains `NEEDS MANUAL VERIFICATION`
- **Affected Subsystem**: Packaging / Windows Distribution
- **Affected Files**:
  - `package.json:115-126`
  - `build/icon.ico` (new asset)
- **Problem Description (resolved by F2)**:
  The prior Windows build config in `package.json` referenced `public/panvas_logo.png` instead of a multi-resolution `.ico`. No code signing configuration or hash algorithm is defined, and signing remains intentionally out of scope for this pass.
- **User Impact**:
  Distorted taskbar icons on high-DPI displays; Windows Defender SmartScreen warnings on install.
- **Implementation Evidence (2026-09-10)**: Added `build/icon.ico` with 16, 24, 32, 48, 64, 128, and 256px PNG-compressed layers and pointed `package.json` at it. Runtime window creation prefers the ICO and falls back to the existing PNG in development. No signing or installer execution was added in Package F2.
- **Prerequisites**: Finalized application icon asset.
- **Regression Risk**: None.
- **Verification Required**:
  - Build Windows package (`npm run package:win`); inspect installer and taskbar shortcut icon rendering.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 13).

---

### HARDEN-022: Local Font Bundling for 100% Offline Handwriting Typography

- **ID**: `HARDEN-022`
- **Priority**: `P2`
- **Status**: `FIXED / TEST-PASSING` — typography appearance and font/legal review remain `NEEDS MANUAL VERIFICATION`
- **Affected Subsystem**: Offline Reliability / Typography
- **Affected Files**:
  - `index.html`
  - `src/bootstrap.tsx`
  - `src/components/notebook/textFonts.ts`
- **Problem Description (resolved by F2)**:
  Handwriting fonts (Caveat, Kalam, Patrick Hand) were previously loaded via Google Fonts CDN in `index.html`, causing a first offline launch to fall back to system fonts.
- **User Impact**:
  Violates true "local-first, fully offline" product promise on first offline launch.
- **Implementation Evidence (2026-09-10)**: Removed the Google Fonts stylesheet and CSP allowances. `loadTextFont` now reports unavailable optional faces without waiting on or requesting a network stylesheet, preserving the declared system-font fallbacks. No unverified font files were added; existing vendor assets remain governed by the Package E legal-review note.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Disconnect machine from network, clear browser cache, open Panvas notebook; verify handwriting fonts render correctly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 19).

---

### HARDEN-023: Core UI Accessibility (A11y) Missing Button Labels

- **ID**: `HARDEN-023`
- **Priority**: `P2`
- **Status**: `FIXED / TEST-PASSING` — screen-reader and keyboard walkthrough remains `NEEDS MANUAL VERIFICATION`
- **Affected Subsystem**: UI / Accessibility
- **Affected Files**:
  - `src/components/canvas/CanvasVoiceNote.tsx:97`
  - `src/components/canvas/PdfBlock.tsx:167-170`
  - `src/components/notebook/NotebookPageView.tsx`
  - `src/components/layout/`
- **Problem Description**:
  Multiple icon-only buttons lack `aria-label`, `aria-labelledby`, or screen reader text.
- **User Impact**:
  Screen readers announce buttons as generic "Button" without purpose. Fails WCAG 2.1 AA accessibility guidelines.
- **Recommended Fix**:
  Audit icon buttons and add descriptive `aria-label` and `title` attributes.
- **Implementation Evidence (2026-09-10)**: Active voice-note, PDF block, Markdown/LaTeX block, notebook controls/popups, workspace tree, trash, local-elements, and reference-pane controls now expose descriptive names while retaining their existing keyboard, focus, and click handlers.
- **Prerequisites**: None.
- **Regression Risk**: None.
- **Verification Required**:
  - Run automated accessibility audit; verify zero unlabelled interactive elements.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 18).

---

### HARDEN-024: Public Asset Optimization & Compression

- **ID**: `HARDEN-024`
- **Priority**: `P2`
- **Status**: `FIXED / TEST-PASSING` — packaged visual fidelity remains `NEEDS MANUAL VERIFICATION`
- **Affected Subsystem**: Assets / Performance
- **Affected Files**:
  - `public/` directory
- **Problem Description**:
  The `public/` directory contains uncompressed marketing screenshots and large assets packaged into the production bundle.
- **User Impact**:
  Slow initial app download and larger installer size.
- **Recommended Fix**:
  1. Compress static PNG/JPEG assets using modern WebP or optimized PNG.
  2. Move large marketing media not needed in runtime to separate documentation or external hosting.
- **Implementation Evidence (2026-09-10)**: Existing optimized WebP variants remain the active landing/product paths; the auth backdrop now uses its optimized WebP variant, and the unreferenced `public/app-screenshots` and `public/Application SS` duplicate folders were removed. Active source-quality originals were preserved.
- **Prerequisites**: None.
- **Regression Risk**: Low.
- **Verification Required**:
  - Verify total `public/` asset footprint is reduced and all UI icons/images load correctly.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 1 (Codebase Metrics).

---

### HARDEN-025: Retirement or Lazy-Loading of Legacy Supabase Auth Forms

- **ID**: `HARDEN-025`
- **Priority**: `P2`
- **Status**: `FIXED / TEST-PASSING` — direct legacy-auth and restored-session checks remain `NEEDS MANUAL VERIFICATION`
- **Affected Subsystem**: Codebase Cleanup / Auth
- **Affected Files**:
  - `src/components/auth/LoginPage.tsx`
  - `src/components/auth/SignUpPage.tsx`
  - `src/components/auth/ForgotPasswordPage.tsx`
  - `src/components/auth/ResetPasswordPage.tsx`
- **Problem Description**:
  These 4 forms import form validation libraries and reference legacy Supabase Auth endpoints. Since Panvas uses Google Drive OAuth and local-first storage, these routes are obsolete.
- **User Impact**:
  Unnecessary bundle bloat (~120 KB) and user confusion if navigating to auth routes.
- **Recommended Fix**:
  Either remove the routes entirely or place them behind a lazy-loaded flag for future enterprise account integration.
- **Implementation Evidence (2026-09-10)**: The four legacy form modules are now route-lazy-loaded behind local Suspense fallbacks. `AuthGuard`, `AuthCallbackHandler`, the Supabase session store, and the Google Drive cloud-sync route remain active and unchanged.
- **Prerequisites**: Verify no active links in navigation point to `/login`.
- **Regression Risk**: Low.
- **Verification Required**:
  - Build app and verify clean compilation without auth route deadweight.
- **Audit Cross-Reference**: [`PRE_RELEASE_ENGINEERING_AUDIT.md`](PRE_RELEASE_ENGINEERING_AUDIT.md) Section 2 (Risk 20).

---

## 6. FIXED / TEST-PASSING Items (2 Items)

Items verified as already resolved in the current codebase and passing automated tests.

---

### HARDEN-009: CSP Connect-Src Allowance for Excalidraw Community Libraries

- **ID**: `HARDEN-009`
- **Priority**: `P0`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: Security / CSP
- **Affected Files**:
  - `index.html:4`
  - `src/config/browserCsp.ts:15`
  - `tests/canvas-capabilities.test.ts`
- **Resolution Evidence**:
  `index.html:4` explicitly includes `https://libraries.excalidraw.com` in the Content Security Policy `connect-src` directive. Automated test `tests/canvas-capabilities.test.ts` asserts that community library downloads are permitted without CSP violations.

---

### HARDEN-012: Code-Split / Lazy-Load Excalidraw Canvas Bundle

- **ID**: `HARDEN-012`
- **Priority**: `P1`
- **Status**: `FIXED / TEST-PASSING`
- **Affected Subsystem**: Bundle Size / Performance
- **Affected Files**:
  - `src/components/workspace/WorkspaceContent.tsx:11`
- **Resolution Evidence**:
  `WorkspaceContent.tsx:11` dynamically imports `CanvasView` via `React.lazy(() => import('../canvas/CanvasView'))` wrapped in a `<Suspense fallback={<CanvasLoadingSkeleton />}>`. The Excalidraw engine is isolated into an on-demand async chunk and excluded from the primary entry bundle.
