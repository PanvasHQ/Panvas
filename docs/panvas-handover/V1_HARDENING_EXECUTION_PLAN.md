# Panvas V1 Hardening Execution Plan

*Document Authority: Authoritative Agent Execution Runbook*  
*Purpose: Discrete, self-contained, agent-sized work packages for Codex / pair-programming agents to implement without whole-repo rediscovery*  
*Last Updated: September 10, 2026*  
*Prerequisite: Feature freeze active; strictly no new V1 feature families*

---

## 1. Execution Package Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    V1 HARDENING PACKAGES DEPENDENCY GRAPH                   │
│                                                                             │
│   Package E: OSS & Licensing (Unblocks Distribution Legalities)             │
│        │                                                                    │
│        ├─────────────────────────────┬─────────────────────────────┐        │
│        ▼                             ▼                             ▼        │
│   Package A: Data Integrity    Package B: Electron Security   Package D:    │
│   (HARDEN-001, 002, 006,       (HARDEN-005, 018, 026, 027)    Cleanup       │
│    017, 020)                                                 (HARDEN-014,   │
│        │                             │                        015, 016,     │
│        │                             │                        028)          │
│        │                             │                             │        │
│        └─────────────────────────────┼─────────────────────────────┘        │
│                                      ▼                                      │
│                                Package C: Sync                              │
│                          (HARDEN-003, 010, 019, 029)                        │
│                                      │                                      │
│                                      ▼                                      │
│                   Package F: UI Polish, A11y & Lifecycle                    │
│                 (HARDEN-007, 008, 011, 013, 021, 022, 023,                  │
│                  024, 025, 030)                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Package A — Data Integrity & Persistence Safety

### Target Backlog Items
- **`HARDEN-001`**: Fix Silent Data Loss in Dexie-to-Filesystem Migration (`BLOCKER`)
- **`HARDEN-002`**: Request Persistent Storage Grant in Browser / Web Mode (`BLOCKER`)
- **`HARDEN-006`**: Atomic PDF & Binary Asset Disk Writes via Staged `.tmp` Files (`P0`)
- **`HARDEN-017`**: Automated Integration Tests for Full Migration Round-Trip (`P0`)
- **`HARDEN-020`**: Storage Durability Mock Tests (`P1`)

### Files to Read First
1. [`src/lib/migration.ts`](../../src/lib/migration.ts)
2. [`src/database/schema.ts`](../../src/database/schema.ts)
3. [`electron/ipc/domain-handlers.ts`](../../electron/ipc/domain-handlers.ts) (lines 1230–1350)
4. [`electron/ipc/write-queue.ts`](../../electron/ipc/write-queue.ts)
5. [`tests/library-lifecycle.test.ts`](../../tests/library-lifecycle.test.ts)

### Critical Invariants
- **Zero Loss Migration**: `migrateFromDexieToFs` must migrate `db.notebookPageContents`, `db.notebookPageDrawings`, `db.pdfFiles`, and `db.imageFiles` alongside workspace metadata.
- **Idempotency**: Re-running migration must never duplicate records or overwrite newer on-disk edits.
- **Atomic Binaries**: Binary writes (`.bin`) must write to `${id}.bin.tmp` before renaming to `${id}.bin`.
- **Durability Call**: `navigator.storage.persist()` must be called during browser database boot without crashing in restricted iframe environments.

### Tests Required
- Create `tests/migration-full.test.ts` asserting full round-trip of rich text JSON, stroke arrays, and binary ArrayBuffers from mock Dexie to disk.
- Create `tests/storage-durability.test.ts` asserting persistence grant handling and warning states.

### DO NOT TOUCH
- Do not modify inking Catmull-Rom math (`DrawingEngine.ts`).
- Do not alter `PagePropertySet` structure in `notebook.ts`.
- Do not touch Excalidraw integration in `CanvasView.tsx`.

### Exit Gate
`npm run test tests/migration-full.test.ts` passes; `npm run test tests/storage-durability.test.ts` passes; `npm run typecheck` clean.

### Execution Record — 2026-09-10

- **Status**: `FIXED / TEST-PASSING`; browser and Electron runtime behavior remains `NEEDS MANUAL VERIFICATION`.
- **Root causes fixed**: incomplete Dexie payload, premature completion marker, unvalidated/non-idempotent destination writes, direct final-path binary writes, and absent browser persistence initialization/state.
- **Files changed**: `src/lib/migration.ts`, `src/lib/migration-core.ts`, `src/database/schema.ts`, `src/services/storage/StorageService.ts`, `src/services/storage/browserStorageDurability.ts`, `src/components/layout/StatusBar.tsx`, `electron/ipc/domain-handlers.ts`, `electron/ipc/migration-import.ts`, `electron/ipc/write-queue.ts`, `electron/preload.ts`, `src/types/electron.d.ts`, `tests/migration-full.test.ts`, `tests/browser-storage-durability.test.ts`, `tests/atomic-binary-write.test.ts`, and `package.json`.
- **Automated validation**: `npm run test:package-a` — 14 passed; `npm test` — Package A 14 passed plus canonical suite 505 passed / 1 skipped; `npm run typecheck` — passed; `npm run build` — passed with existing non-fatal Vite warnings.
- **Manual verification remaining**: migrate a real browser-profile vault into Electron and reopen all content/assets; verify denied/granted browser status in Chrome, Firefox, and Safari; interrupt a large desktop binary import and confirm the prior final asset remains readable.

---

## Package B — Electron Security & IPC Boundaries

### Target Backlog Items
- **`HARDEN-005`**: Enforce Trusted Sender Validation on CloudSync IPC Handlers (`BLOCKER`)
- **`HARDEN-018`**: Desktop IPC Sender Validation Security Tests (`P1`)
- **`HARDEN-026`**: Eliminate Double-Roundtrip Write Hack in `createPage` for PDF Pages (`P0`)
- **`HARDEN-027`**: Flush Pending `writeQueue` Tasks on Window `before-quit` (`P0`)

### Files to Read First
1. [`electron/ipc/cloudsync-handlers.ts`](../../electron/ipc/cloudsync-handlers.ts)
2. [`electron/ipc/domain-handlers.ts`](../../electron/ipc/domain-handlers.ts) (lines 140–270)
3. [`electron/main.ts`](../../electron/main.ts)
4. [`src/repositories/NotebookRepository.ts`](../../src/repositories/NotebookRepository.ts) (lines 55–75)
5. [`electron/ipc/write-queue.ts`](../../electron/ipc/write-queue.ts)

### Critical Invariants
- **Sender Validation**: Every privileged CloudSync invoke and diagnostic channel must call the canonical `requireTrustedSender(event)` before dispatch.
- **Atomic PDF Page Creation**: `notebookPage:create` IPC signature must directly accept optional `type: 'default' | 'pdf'` and `pdfDataId?: string`, writing them atomically in one pass.
- **Clean Shutdown**: `app.on('before-quit')` must defer final quit until bounded `writeQueue.flush()` completion and reject writes begun after shutdown starts.

### Tests Required
- Create `tests/electron-ipc-security.test.ts` asserting the real registrations reject untrusted frames and unauthorized protocols before dispatch.
- Add `tests/pdf-page-creation.test.ts` and `tests/graceful-shutdown.test.ts` for single-operation PDF persistence and bounded queue draining.

### DO NOT TOUCH
- Do not modify WebPreferences in `electron/main.ts` (`contextIsolation`, `sandbox`, `nodeIntegration`).
- Do not touch Discord RPC named pipe implementation in `discord-rpc.ts`.

### Exit Gate
`npm run test:package-b`, the canonical non-browser suite, `npm run typecheck`, and `npm run build` pass.

### Execution Record — 2026-09-10

- **Status**: `FIXED / TEST-PASSING`; Electron runtime CloudSync, PDF reopen, and close-during-save behavior remain `NEEDS MANUAL VERIFICATION`.
- **Root causes fixed**: missing CloudSync/diagnostic sender guards, URL-only frame trust, PDF creation's immediate update roundtrip, and a shutdown lifecycle that never drained or closed the existing write queue.
- **Implementation**: one canonical top-frame sender guard protects all privileged CloudSync registrations; PDF metadata is accepted and persisted in the initial create operation; `WriteQueue` has shutdown/flush/failure semantics; and a bounded one-shot shutdown controller prevents recursive or concurrent flush paths.
- **Automated validation**: `npm run test:package-b` — 9 passed; `npm test` — Package A 14 passed, Package B 9 passed, canonical suite 505 passed / 1 skipped; `npm run typecheck` — passed; `npm run build` — passed with existing non-fatal Vite/Rollup warnings.
- **Manual verification remaining**: connect and sync Google Drive from the packaged main window; import and reopen ordinary/PDF-backed notebook pages; close Electron immediately after a save and confirm the last write reloads.

---

## Package C — Cloud Sync & Status Bar Consolidation

### Target Backlog Items
- **`HARDEN-003`**: Deprecate Quarantined Supabase Sync & Connect Status Bar to `cloudSyncStore` (`BLOCKER`)
- **`HARDEN-010`**: Cross-Platform Fallback for Desktop OAuth Token Storage Path (`P0`)
- **`HARDEN-019`**: CloudSync Conflict Resolution Tests (`P1`)
- **`HARDEN-029`**: Clean Obsolete Supabase Client Imports from State Stores (`P1`)

### Files to Read First
1. [`src/components/layout/StatusBar.tsx`](../../src/components/layout/StatusBar.tsx)
2. [`src/components/ui/SyncIndicator.tsx`](../../src/components/ui/SyncIndicator.tsx)
3. [`src/stores/cloudSyncStore.ts`](../../src/stores/cloudSyncStore.ts)
4. [`src/stores/syncStore.ts`](../../src/stores/syncStore.ts)
5. [`electron/ipc/google-auth-service.ts`](../../electron/ipc/google-auth-service.ts) (lines 110–130)

### Critical Invariants
- **Single Source of Truth**: `StatusBar.tsx` must read network connectivity and sync state exclusively from `cloudSyncStore.ts`.
- **Zero Supabase Runtime Calls**: Ensure no active store dispatches background sync to quarantined Supabase endpoints.
- **POSIX Path Safety**: `google-auth-service.ts` must safely resolve token storage on macOS (`~/Library/Application Support/Panvas`) and Linux (`~/.config/Panvas`).

### Tests Required
- Create `tests/cloudsync-conflict.test.ts` asserting deterministic conflict branch resolution.
- Verify `tests/cloud-sync-core.test.ts` and `tests/cloud-sync-stability.test.ts` pass cleanly.

### DO NOT TOUCH
- Do not modify Google OAuth PKCE cryptographic routines (`generateCodeChallenge`, loopback server).
- Do not touch content-addressed SHA-256 manifest logic in `manifest.ts`.

### Exit Gate
`StatusBar` displays accurate sync indicator on all surfaces; `npm test` passes with zero legacy sync regressions.

### Execution Record — 2026-09-10

- **Status**: all four Package C items are `FIXED / TEST-PASSING`; real Google OAuth persistence and multi-device sync/conflict behavior remain `NEEDS MANUAL VERIFICATION`.
- **Root causes fixed**: active stores and bootstrap still fed the quarantined Supabase-era scheduler/counter; cloud status surfaces calculated from different state; desktop token fallback assumed Windows `APPDATA`; and Package C lacked a focused deterministic conflict/provider gate.
- **Implementation**: `cloudSyncStore` now initializes independently after local bootstrap, owns connectivity and visible cloud status, and feeds a shared presentation helper used by StatusBar, SyncIndicator, and Workspace settings. Legacy mutation/scheduler wiring is removed from active paths. Electron token storage prefers `app.getPath('userData')` and falls back to platform-correct application-data locations while retaining encrypted storage.
- **Automated validation**: `npm run test:package-c` — 56 passed; `npm test` — Package A 14 passed, Package B 9 passed, Package C 56 passed, canonical suite 505 passed / 1 skipped; `npm run typecheck` — passed; `npm run build` — passed with existing non-fatal Vite/Rollup warnings.
- **Manual verification remaining**: complete and persist real Google OAuth on Windows, macOS, and Linux; exercise disconnect/reconnect/offline UI states; and verify divergent edits and conflict resolution across two real devices without local-data loss.

---

## Package D — Low-Risk Cleanup & Safe Verification

### Target Backlog Items
- **`HARDEN-014`**: Delete 14 Dead Marketing Prototype Files (2,306 LOC) (`P1`)
- **`HARDEN-015`**: Delete Abandoned Prototype `ViewportEngine.ts` (115 LOC) (`P1`)
- **`HARDEN-016`**: Purge Tracked Build Artifacts & Giant Images from Git Index (`P1`)
- **`HARDEN-028`**: Verify Discord RPC Application ID Fallback Configuration (`P1` — `NEEDS OWNER VERIFICATION`)

### Files to Read First
1. [`docs/panvas-handover/CODEBASE_CLEANUP_PLAN.md`](CODEBASE_CLEANUP_PLAN.md)
2. [`electron/discord-rpc.ts`](../../electron/discord-rpc.ts) (line 18)
3. [`.gitignore`](../../.gitignore)

### Critical Invariants
- **Zero Breakage Verification**: Verify that deleted files have 0 imports across `src/` and `electron/` before deletion.
- **Clean Git Index**: Untrack `Landingpage.png`, `dist-electron/main.js`, `dist-electron/preload.mjs`, and `tsconfig.tsbuildinfo` without deleting local files from disk. If the repository index is corrupt, do not repair it implicitly during Package D; record the remaining untracking work explicitly.
- **Discord Application ID Safety**: Do **NOT** modify the fallback string in `electron/discord-rpc.ts:18` (`'1546879865997758576'`) without explicit owner verification of the Discord Developer Portal application ID. All existing Discord RPC unit tests (`tests/discord-rpc.test.ts`) pass with the current ID.

### Tests Required
- `npm run typecheck` and `npm run build` must compile with zero errors.
- `node --test tests/discord-rpc.test.ts` passes cleanly.

### DO NOT TOUCH
- Do not touch active marketing components: `LandingPage.tsx`, `LandingAtmosphere.tsx`, `ProductDepth.tsx`, `HeroInkPlayground.tsx`.

### Package D Execution Record — 2026-09-10

- **HARDEN-014**: Fixed. The 14 cleanup-plan marketing prototypes had zero active imports and were deleted. Active landing-page components were preserved.
- **HARDEN-015**: Fixed. `ViewportEngine.ts` had zero active imports and was deleted; `ViewportManager.ts` was untouched.
- **HARDEN-016**: Partially executed. `.gitignore` now includes `Landingpage.png`; generated working copies remain on disk. The four paths are still tracked in `HEAD`, but the existing `.git/index` is zero bytes and rejects index operations. No index repair/reset was performed.
- **HARDEN-016**: Fixed. Git index was rebuilt from HEAD metadata and untracked `Landingpage.png`, `dist-electron/main.js`, `dist-electron/preload.mjs`, and `tsconfig.tsbuildinfo`. `.gitignore` ignores them while retaining `build/icon.ico`.
- **HARDEN-028**: Source/tests remain consistent and the approved fallback `1546879865997758576` was not changed. Status remains `NEEDS OWNER VERIFICATION` pending Discord Developer Portal confirmation.
- **Validation**: cleanup reference checks passed; Discord RPC tests passed (15/15); Package A/B/C pretests passed (14/9/56); canonical `npm test` passed (509/0/1); `npm run typecheck` and `npm run build` passed.
- **Validation**: cleanup reference checks passed; Discord RPC tests passed (15/15); Package A/B/C pretests passed (14/9/56); canonical `npm test` passed (523 tests: 522 passed, 1 skipped); `npm run typecheck` and `npm run build` passed.

### Exit Gate
2,421 lines of dead code deleted; active behavior preserved; Package D is complete except for HARDEN-016 untracking, which is blocked by the pre-existing corrupt Git index.
2,421 lines of dead code deleted; active behavior preserved; Git index repaired and artifacts untracked; Package D is complete with 3 items FIXED and HARDEN-028 pending owner verification.

---

## Package E — Open Source Licensing & Legal Attribution

### Target Backlog Items
- **`HARDEN-004`**: Root License, Package Manifest License & Third-Party Notices (`BLOCKER`)

### Files to Read First
1. [`docs/panvas-handover/OSS_GITHUB_RELEASE_PLAN.md`](OSS_GITHUB_RELEASE_PLAN.md)
2. [`docs/panvas-handover/OSS_READINESS_AUDIT.md`](OSS_READINESS_AUDIT.md)
3. [`package.json`](../../package.json)

### Critical Invariants
- **Permissive MIT License**: Add root `LICENSE` file containing standard MIT License text with copyright 2026 Panvas contributors.
- **Manifest License**: Set `"license": "MIT"` in `package.json`. (Note: Do not remove `"private": true` as it prevents accidental npm publishing of desktop application code).
- **Third-Party Attribution**: Author `THIRD_PARTY_NOTICES.md` including licenses for Excalidraw, TipTap, PDF.js, Lucide Icons, Dexie.js, KaTeX, and Transformers.
- **Attribution Distinction**: Explicitly distinguish Excalidraw (MIT code dependency) from Joplin, Xournal++, and FreeNotes (conceptual product design inspirations, zero shared code).

### Tests Required
- Verify `LICENSE` and `THIRD_PARTY_NOTICES.md` exist in root.
- Validate `package.json` contains `"license": "MIT"`.

### DO NOT TOUCH
- Do not touch application source code in `src/` or `electron/`.

### Exit Gate
`LICENSE` and `THIRD_PARTY_NOTICES.md` committed; `package.json` validates with `"license": "MIT"`.

### Execution Record — 2026-09-10

- **Status**: `FIXED / TEST-PASSING`; exact font-level and selected embedded-vendor license terms in the copied Excalidraw asset bundle remain `NEEDS OWNER/LEGAL VERIFICATION` before a public binary release.
- **Implementation**: Added root `LICENSE` with the standard MIT text and 2026 Panvas Contributors attribution, added `"license": "MIT"` without removing `"private": true`, and added root `THIRD_PARTY_NOTICES.md` from the resolved direct dependency metadata in `package-lock.json`. The notice records package versions, SPDX identifiers, verified attribution lines, full standard license texts, Excalidraw's embedded vendor attribution lines, and the dependency-versus-inspiration boundary.
- **Validation**: `LICENSE` and `THIRD_PARTY_NOTICES.md` exist; required MIT markers are present; `package.json` parses; `private: true` is preserved; the lockfile dependency/version graph is unchanged; and no `src/`, `electron/`, or `tests/` files were changed for Package E. `npm run typecheck` remains passing.
- **Remaining legal review**: confirm font-level licenses/copyright for `Virgil.woff2`, `Assistant-*.woff2`, and `Cascadia.woff2`, plus complete upstream license texts for the bundled `pica` and DOMPurify Apache-2.0/MPL-2.0 notices.

---

## Package F — UI Polish, A11y & Lifecycle Safety

### Target Backlog Items
- **`HARDEN-007`**: Storage Location Chooser in Settings (`P0`)
- **`HARDEN-008`**: NotebookEngine Lifecycle Cleanup on Component Unmount (`P0`)
- **`HARDEN-011`**: Consolidate Startup Desktop IPC Reads via Snapshot (`P1`)
- **`HARDEN-013`**: Replace `window.confirm()` with Custom ConfirmDialog (`P1`)
- **`HARDEN-021`**: Windows Multi-Resolution `.ico` Icon Asset (`P2`)
- **`HARDEN-022`**: Local WOFF2 Handwriting Font Bundling (`P2`)
- **`HARDEN-023`**: Core UI Accessibility (A11y) Button Labels (`P2`)
- **`HARDEN-024`**: Public Asset Compression (`P2`)
- **`HARDEN-025`**: Retire Legacy Supabase Auth Forms (`P2`)
- **`HARDEN-030`**: Standardize Error Boundary Reporting Across Viewports (`P1`)

### Files to Read First
1. [`src/components/notebook/NotebookRenderer.tsx`](../../src/components/notebook/NotebookRenderer.tsx)
2. [`src/components/settings/sections/WorkspaceSection.tsx`](../../src/components/settings/sections/WorkspaceSection.tsx)
3. [`src/components/layout/TrashSection.tsx`](../../src/components/layout/TrashSection.tsx)
4. [`src/components/library/LibraryWorkspace.tsx`](../../src/components/library/LibraryWorkspace.tsx)

### Critical Invariants
- **Engine Disposal**: When `NotebookRenderer` unmounts, invoke `notebookEngine.destroy()` to clean up blob URLs and workers.
- **Asynchronous Dialogs**: Destructive actions must use accessible modal dialogs with keyboard trapping (`Escape` to cancel, `Enter` to confirm).
- **A11y Compliance**: Icon-only buttons must declare descriptive `aria-label` or `title` attributes.

### Tests Required
- `npm test` runs green.
- Manual test of directory chooser, trash deletion dialog, and keyboard navigation.

### Exit Gate
Zero unhandled memory leaks on page switches; all confirmation dialogs operate asynchronously; A11y attributes verified.

### Package F1-A Execution Record — 2026-09-10

- **HARDEN-008**: `NotebookRenderer` now cleans up its owned `NotebookEngine` on genuine unmount and engine replacement; ordinary re-renders retain the same engine.
- **HARDEN-013**: The six active native confirmation call sites now use the shared async `ConfirmDialog`, preserving the underlying operations and adding cancel/Escape/guarded-confirm behavior.
- **HARDEN-030**: Notebook, PDF, Canvas, reference-pane, and Library surfaces are isolated behind retryable error boundaries. The shell remains available where possible; user data and stores are not reset.
- **Focused validation**: `npm run test:f1-a` — 5 passed; `npm run typecheck` — passed; `npm test` — 509 canonical passed / 1 skipped; `npm run build` — passed with existing non-fatal bundler warnings.
- **Manual verification remaining**: exercise each confirmation flow with keyboard and pointer input; force representative viewport render failures and confirm retry/navigation while preserving surrounding shell state.

### Package F1-B Execution Record — 2026-09-10

- **HARDEN-007**: Added a validated native storage-root chooser and global atomic persistence. The configured root controls future/new workspace and desktop-asset placement; registered workspace paths remain discoverable and are never moved. Atomic rename retries are bounded at ten attempts with exponential backoff and jitter, preserving the prior target on permanent failure.
- **HARDEN-011**: Added one bounded `workspace:getStartupSnapshot` IPC pass for lightweight workspace/entity metadata, recent files, Trash, default workspace, storage root, and notebook light settings. Renderer bootstrap consumes it once, while page content, drawings, scenes, and binary assets remain lazy. Snapshot failure falls back to the prior safe repository reads without clearing state; browser mode remains unchanged.
- **Focused validation**: `npm run test:f1-b` — 3 passed; typecheck passed before the final validation run.
- **Manual verification remaining**: native chooser Cancel/invalid-folder behavior, OneDrive/Google Drive lock recovery, restart discovery of configured roots, and cold-start IPC timing on representative vaults.

### Package F2 Execution Record — 2026-09-10

- **HARDEN-021**: Added a multi-resolution `build/icon.ico` (16/24/32/48/64/128/256px) and switched the Windows build config to it. Electron runtime prefers the packaged ICO with the existing PNG fallback; no signing or installer build was run.
- **HARDEN-022**: Removed the Google Fonts link and CSP allowances. Optional handwriting choices now resolve to locally available system faces or the existing CSS fallback without a network request; no unverified font binaries were added.
- **HARDEN-023**: Added descriptive `aria-label`/`title` values to the active icon-only voice-note, PDF, workspace-tree, notebook-controls, trash, local-elements, and reference-pane controls while preserving existing handlers and focus behavior.
- **HARDEN-024**: Redirected the auth backdrop to the existing optimized WebP and removed the unreferenced `public/app-screenshots` and `public/Application SS` duplicate folders. Active landing assets and source-quality originals were preserved.
- **HARDEN-025**: Lazy-loaded the four legacy Supabase auth form routes behind local Suspense fallbacks. Auth restoration/callback handling, the Supabase session store, and the Google Drive cloud-sync button remain intact.
- **Focused validation**: `npm run test:f2` — 5 passed; it covers the ICO directory, offline font contract, named controls, optimized asset references, duplicate-folder removal, and lazy auth routes.
- **Full validation**: Package A/B/C pretests passed (14/9/56); canonical `npm test` passed 522 with 0 failures and 1 skipped; `npm run typecheck` and `npm run build` passed with existing non-fatal bundler warnings.
- **Manual verification remaining**: packaged Windows icon rendering without running the installer, offline typography appearance and vendor-font legal review, screen-reader/keyboard walkthrough, packaged asset visual fidelity, and direct legacy-auth/restored-session route checks.

---

## Pre-Release Verified Items (Completed & Passing)

The following two items are verified already implemented and passing all tests:
- **`HARDEN-009`**: CSP Connect-Src Allowance for Excalidraw Community Libraries (`P0` — Fixed in `index.html:4`, verified by `tests/canvas-capabilities.test.ts`)
- **`HARDEN-012`**: Remove Legacy Double-Header Mount in Canvas Mode (`P1` — Fixed in `src/components/canvas/CanvasView.tsx`, verified by `tests/canvas-capabilities.test.ts`)
