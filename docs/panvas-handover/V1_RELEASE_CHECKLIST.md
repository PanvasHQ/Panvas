# Panvas V1 Live Release Checklist

> **Document Type**: Live Operational Release Execution Tracker  
> **Source of Truth**: [`RELEASE_HARDENING_BACKLOG.md`](RELEASE_HARDENING_BACKLOG.md)  
> **Execution Hierarchy**: [`V1_HARDENING_EXECUTION_PLAN.md`](V1_HARDENING_EXECUTION_PLAN.md)  
> **Date**: September 10, 2026  
> **Status**: LIVE EXECUTION TRACKER  
> **Target Release**: Panvas v1.0.0 (Windows x64 Desktop + Web/PWA)  

---

## 1. Executive Release Overview

| Metric / Gate | Required | Current Status | Notes |
|---|:---:|:---:|---|
| **Hardening Items Total** | 30 | 30 Tracked | 0 BLOCKER, 0 P0, 2 P1 open; 28 FIXED / TEST-PASSING |
| **Hardening Items Total** | 30 | 30 Tracked | 0 BLOCKER, 0 P0, 1 P1 open; 29 FIXED / TEST-PASSING |
| **BLOCKER Items Resolved** | 5 | 5 / 5 Resolved | Legal assets still require owner/legal verification before public binary release |
| **P0 Items Resolved** | 7 | 7 / 7 Resolved | Runtime filesystem and close-during-save checks remain manual |
| **P1 Items Resolved** | 11 | 9 / 11 Resolved | `HARDEN-016` and `HARDEN-028` remain open |
| **P1 Items Resolved** | 11 | 10 / 11 Resolved | `HARDEN-028` remains open (NEEDS OWNER VERIFICATION) |
| **P2 Items Resolved** | 5 | 5 / 5 Resolved | F2 source/tests pass; packaged and visual checks remain manual |
| **Verified Fixed** | 30 | 28 / 30 Verified | Packages A–E, F1-A/B, F2, and `HARDEN-009`/`HARDEN-012` passing |
| **Verified Fixed** | 30 | 29 / 30 Verified | Packages A–E (including HARDEN-016), F1-A/B, F2, and `HARDEN-009`/`HARDEN-012` passing |
| **Strix Security Pass** | 0 Blocker | Pending | Executes after Packages A–D |
| **Test Suite Status** | Clean | 601 Pass / 1 Skip | 14 Package A + 9 Package B + 56 Package C + 522 canonical passing tests |

---

## 2. Hardening Backlog Execution (30 Canonical Items)

### 2.1 BLOCKER Items (5 Items — Mandatory Before Build)
- [x] `HARDEN-001`: Fix Silent Data Loss in Dexie-to-Filesystem Migration — `FIXED / TEST-PASSING`; runtime migration `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-002`: Request Persistent Storage Grant in Browser / Web Mode — `FIXED / TEST-PASSING`; browser matrix `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-003`: Deprecate Quarantined Supabase Sync & Connect Google Drive to UI — `FIXED / TEST-PASSING`; real OAuth and multi-device sync `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-004`: Root License, Package Manifest License & Third-Party Notices — `FIXED / TEST-PASSING`; copied Excalidraw font/vendor terms `NEEDS OWNER/LEGAL VERIFICATION`
- [x] `HARDEN-005`: Enforce Trusted Sender Validation on CloudSync IPC Handlers — `FIXED / TEST-PASSING`; main-window Google Drive flow `NEEDS MANUAL VERIFICATION`

### 2.2 P0 Items (7 Items — Mandatory Before Release)
- [x] `HARDEN-006`: Atomic PDF & Binary File Disk Writes via Staged Temporary Files — `FIXED / TEST-PASSING`; abrupt-termination check `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-007`: Cloud-Synced Folder Renaming Resilience & Custom Storage Path â€” `FIXED / TEST-PASSING`; Windows/cloud-sync and native chooser behavior `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-007`: Cloud-Synced Folder Renaming Resilience & Custom Storage Path — `FIXED / TEST-PASSING`; Windows/cloud-sync and native chooser behavior `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-008`: NotebookEngine Lifecycle Cleanup on React Component Unmount — `FIXED / TEST-PASSING`; owner cleanup and replacement cleanup covered by focused tests
- [x] `HARDEN-010`: Cross-Platform Fallback for Desktop OAuth Token Storage Path — `FIXED / TEST-PASSING`; real cross-platform OAuth persistence `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-017`: Integration Tests for Full Dexie-to-FS Notebook Content & Drawings Migration — `FIXED / TEST-PASSING`
- [x] `HARDEN-026`: Eliminate Double-Roundtrip Write Hack in `createPage` for PDF Pages — `FIXED / TEST-PASSING`; Electron import/reopen `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-027`: Flush Pending `writeQueue` Tasks on Electron Window `before-quit` — `FIXED / TEST-PASSING`; close-during-save `NEEDS MANUAL VERIFICATION`

### 2.3 P1 Items (11 Items — Stability, Cleanup & Tests)
- [x] `HARDEN-011`: Consolidate Startup Desktop IPC Reads via Snapshot â€” `FIXED / TEST-PASSING`; packaged cold-start timing `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-011`: Consolidate Startup Desktop IPC Reads via Snapshot — `FIXED / TEST-PASSING`; packaged cold-start timing `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-013`: Replace Native Synchronous `window.confirm()` with Custom Dialog — `FIXED / TEST-PASSING`; all six active call sites use the shared async dialog
- [x] `HARDEN-014`: Remove 14 Dead Marketing Prototype Files (2,306 LOC) — `FIXED / TEST-PASSING`; zero active imports verified before deletion
- [x] `HARDEN-015`: Consolidate Viewport Engine and Viewport Manager (Delete `ViewportEngine.ts`) — `FIXED / TEST-PASSING`; zero active imports verified before deletion
- [ ] `HARDEN-016`: Purge Tracked Build Artifacts & Giant Images from Git Index — `.gitignore` completed; actual untracking blocked by pre-existing zero-byte corrupt `.git/index`
- [x] `HARDEN-016`: Purge Tracked Build Artifacts & Giant Images from Git Index — `FIXED`; Git index rebuilt and artifacts untracked from Git while preserving `build/icon.ico`
- [x] `HARDEN-018`: Desktop IPC Sender Validation & Security Boundary Unit Tests — `FIXED / TEST-PASSING`
- [x] `HARDEN-019`: CloudSync Provider Edge Case & Conflict Resolution Tests — `FIXED / TEST-PASSING`; real multi-device conflicts `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-020`: Persistent Storage Fallback & Eviction Warning Tests — `FIXED / TEST-PASSING`
- [ ] `HARDEN-028`: Verify Discord RPC Client Configuration Before Change (*NEEDS OWNER VERIFICATION*)
- [x] `HARDEN-029`: Clean Obsolete Supabase Client Imports from State Stores — `FIXED / TEST-PASSING`
- [x] `HARDEN-030`: Standardize Error Boundary Reporting Across Viewports — `FIXED / TEST-PASSING`; major surfaces are isolated with retryable fallbacks

### Package D execution record (2026-09-10)

- [x] 14 dead marketing prototypes deleted after zero-import verification; active landing components preserved.
- [x] `ViewportEngine.ts` deleted after zero-import verification; `ViewportManager.ts` untouched.
- [x] Discord RPC source/tests verified; approved fallback `1546879865997758576` retained. `HARDEN-028` remains `NEEDS OWNER VERIFICATION`.
- [ ] Generated artifacts untracked: blocked because the existing `.git/index` is zero bytes. Local copies were preserved and `Landingpage.png` was added to `.gitignore`.
- [x] Package D validation: Discord RPC 15/15; Package A/B/C pretests 14/9/56; canonical `npm test` 509 passed, 0 failed, 1 skipped; typecheck and build passed.
- [x] Generated artifacts untracked: Git index rebuilt from HEAD metadata and untracked `Landingpage.png`, `dist-electron/main.js`, `dist-electron/preload.mjs`, and `tsconfig.tsbuildinfo`.
- [x] Package D validation: Discord RPC 15/15; Package A/B/C pretests 14/9/56; canonical `npm test` 522 passed, 0 failed, 1 skipped; typecheck and build passed.

### Package F1-A execution record (2026-09-10)

- [x] `HARDEN-008`: NotebookRenderer engine cleanup is owner-scoped and replacement-safe; ordinary re-renders retain the active engine.
- [x] `HARDEN-013`: All six active native confirmations were replaced with the shared async dialog; cancel, Escape, guarded confirm, and close behavior are covered.
- [x] `HARDEN-030`: Notebook, PDF, Canvas, reference-pane, and Library surfaces have isolated retryable boundaries; shell and local data remain intact on viewport failure.
- [x] Focused F1-A tests: 5 passed, 0 failed.
- [x] `npm run typecheck`: passed.
- [x] `npm test`: 509 canonical passed, 0 failed, 1 skipped (Package A/B/C pretests also passed: 14/9/56).
- [x] `npm run build`: passed with existing non-fatal Vite/Rollup warnings.

### Package F1-B execution record (2026-09-10)

- [x] `HARDEN-007`: Settings exposes the effective desktop storage root and a native chooser; selection is validated and atomically persisted, Cancel leaves it unchanged, existing registered workspaces are not relocated, and write-queue lock retries are bounded.
- [x] `HARDEN-011`: Electron startup uses one bounded metadata snapshot for workspace/entity discovery, recent files, Trash, default workspace, storage root, and light settings; document payloads remain lazy and failure falls back safely.
- [x] Focused F1-B tests: 3 passed, 0 failed.
- [ ] Manual verification remaining: native choose/cancel/invalid-folder flows, cloud-sync lock recovery, restart discovery, and cold-start IPC timing.

### Package F2 execution record (2026-09-10)

- [x] `HARDEN-021` through `HARDEN-025`: focused F2 contracts pass (5/5), covering the Windows ICO layers/configuration, no remote core-font dependency with fallback, named active controls, optimized asset references and duplicate removal, and lazy legacy-auth routes.
- [x] `npm run test:f2`: 5 passed, 0 failed.
- [x] `npm run typecheck`: passed before the full validation run.
- [x] Full validation: Package A/B/C pretests 14/9/56; canonical `npm test` 522 passed, 0 failed, 1 skipped; `npm run build` passed with existing non-fatal bundler warnings.
- [ ] Manual verification remaining: inspect packaged/taskbar icon layers without creating an installer, exercise offline typography and vendor-font legal review, perform a screen-reader/keyboard walkthrough, inspect packaged asset fidelity, and test direct legacy-auth/restored-session routes.

### 2.4 P2 Items (5 Items — Packaging & Polish)
- [x] `HARDEN-021`: Windows Multi-Resolution Icon & Packaging Scaffolding — `FIXED / TEST-PASSING`; packaged icon rendering `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-022`: Local Font Bundling for 100% Offline Handwriting Typography — `FIXED / TEST-PASSING`; offline appearance and vendor-font legal review `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-023`: Core UI Accessibility (A11y) Missing Button Labels — `FIXED / TEST-PASSING`; screen-reader/keyboard walkthrough `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-024`: Public Asset Optimization & Compression — `FIXED / TEST-PASSING`; packaged visual fidelity `NEEDS MANUAL VERIFICATION`
- [x] `HARDEN-025`: Retirement or Lazy-Loading of Legacy Supabase Auth Forms — `FIXED / TEST-PASSING`; direct auth/session route checks `NEEDS MANUAL VERIFICATION`

### 2.5 Verified Fixed / Test-Passing (2 Items)
- [x] `HARDEN-009`: CSP Connect-Src Allowance for Excalidraw Community Libraries *(Verified in `index.html:4` and `tests/canvas-capabilities.test.ts`)*
- [x] `HARDEN-012`: Code-Split / Lazy-Load Excalidraw Canvas Bundle *(Verified in `WorkspaceContent.tsx:11` with Suspense)*

---

## 3. Security & Penetration Testing Gates

- [ ] **Static Code Analysis**: Run Strix or ESLint security rules across all Electron IPC handlers.
- [ ] **IPC Boundary Check**: Confirm `requireTrustedSender` is enforced across 100% of IPC handlers.
- [ ] **OAuth Security**: Confirm PKCE flow, loopback redirect (`http://127.0.0.1`), and `safeStorage` token encryption.
- [ ] **External Protocol Rejection**: Confirm `shell.openExternal` strictly permits only `http:` and `https:`.
- [ ] **CSP Verification**: Verify `connect-src`, `script-src`, and `object-src 'none'` in production build.
- [ ] **Secret Scan**: Confirm zero API keys, private tokens, or test credentials committed to repository.

---

## 4. Manual QA Verification Gates

### Package A automated record (2026-09-10)

- [x] Focused Package A tests: 14 passed, 0 failed.
- [x] Canonical non-browser suite: 509 passed, 0 failed, 1 skipped (plus the 14 Package A pretests).
- [x] `npm run typecheck`: passed.
- [x] `npm run build`: passed with pre-existing non-fatal Vite warnings.
- [ ] Real-profile Dexie-to-filesystem migration and post-restart reconstruction.
- [ ] Chrome, Firefox, and Safari persistence-grant/status verification.
- [ ] Desktop large-binary interruption verification.

### Package B automated record (2026-09-10)

- [x] Focused Package B tests: 9 passed, 0 failed.
- [x] Canonical non-browser suite: 509 passed, 0 failed, 1 skipped (plus 14 Package A and 9 Package B pretests).
- [x] `npm run typecheck`: passed.
- [x] `npm run build`: passed with pre-existing non-fatal Vite/Rollup warnings.
- [ ] Packaged main-window Google Drive connect/sync.
- [ ] Electron ordinary/PDF page creation followed by restart/reopen.
- [ ] Close Electron immediately after editing and confirm the final queued save reloads.

- [ ] **Windows Desktop Shell**: Frameless window framing, custom titlebar controls, and minimize/maximize/restore.
- [ ] **Notebook Editor**: Smooth 2D vector inking, stylus pressure, eraser, ruler, and paper template switcher.
- [ ] **PDF Workspace**: PDF import, page rotation, freehand annotation, text markup, and export.
- [ ] **Infinite Canvas**: Excalidraw tools, shapes, custom LaTeX cards, and dirty-state auto-save.
- [ ] **Storage Resilience**: Create notebook, edit offline, restart application; zero data loss.
- [ ] **Theme Switching**: Dark, Light, System, Cyberpunk, Forest, and Sepia themes render consistently.
- [ ] **Accessibility Walkthrough**: Tab navigation, high-contrast readability, and screen reader labels.

---

## 5. Build, Packaging & Distribution Gates

- [ ] **TypeScript Baseline**: `npx tsc -b` passes with 0 errors.
- [ ] **Test Suite Pass**: `npm test` passes with 509+ passing tests and 0 failures.
- [ ] **Production Web Build**: `npm run build` outputs clean `dist/` with code-split bundles.
- [ ] **Windows Installer**: `npm run package` generates `Panvas-Setup-1.0.0.exe`.
- [ ] **Integrity Manifest**: Generate `SHA256SUMS.txt` for all release binaries.
- [ ] **Code Signing Decision**: Confirm Authenticode certificate or document unsigned open-source notice (`HARDEN-021`).

---

## 6. Open-Source Governance Gates

- [ ] **Root `LICENSE`**: MIT License file present in repository root.
- [ ] **Manifest License**: `package.json` specifies `"license": "MIT"`.
- [ ] **Third-Party Notices**: `THIRD_PARTY_NOTICES.md` complete with Excalidraw, KaTeX, PDF.js, and Virgil fonts.
- [ ] **Security Policy**: `SECURITY.md` configured with responsible disclosure reporting guidelines.
- [ ] **Contribution Guide**: `CONTRIBUTING.md` documents local setup, testing, and pull request conventions.

---

## 7. Definitive Sign-Off Gate

| Sign-Off Role | Sign-Off Criteria | Name / Identifier | Date | Status |
|---|---|---|---|:---:|
| **Hardening Lead** | All 5 BLOCKER + 7 P0 items verified | — | — | `[PENDING]` |
| **Security Lead** | Strix scan clean & CSP verified | — | — | `[PENDING]` |
| **QA Lead** | Windows desktop & browser suites pass | — | — | `[PENDING]` |
| **Release Lead** | Artifacts, hashes & OSS notices verified | — | — | `[PENDING]` |
