# Panvas V1 Codebase Cleanup Plan (Vibe-Code Deduplication)

*Document Authority: Authoritative Codebase Cleanup & Deduplication Plan*  
*Purpose: Systematic plan for removing AI-generated code sprawl, dead prototypes, redundant helpers, and comment clutter*  
*Last Updated: September 10, 2026*  
*Rule: Do NOT equate different implementations with duplicate code; preserve legitimate platform divergences*

---

## 1. Executive Summary & Cleanup Categories

Panvas has undergone rapid AI-assisted development. This audit categorizes all discovered redundancies, dead files, and readability bottlenecks into 6 discrete action tiers:

1. **SAFE DELETE**: Abandoned files and unreferenced prototype code with 0 imports. Can be deleted immediately with zero regression risk.
2. **SAFE DEDUPLICATION**: Identical helper functions duplicated across files that can be consolidated into shared utility modules.
3. **SMALL EXTRACTION**: Oversized components (1,000+ LOC) with tightly coupled sub-panels that can be cleanly extracted into child components.
4. **NAMING & COMMENTS**: Removal of redundant AI prose narrating obvious syntax while preserving algorithmic and coordinate invariants.
5. **POST-V1 REFACTOR**: Significant architectural cleanup tasks (such as decomposing the 1,046-line `workspaceStore.ts`) that should be deferred to V2 to preserve release stability.
6. **DANGEROUS — DO NOT TOUCH BEFORE RELEASE**: Fragile, mathematically sensitive areas (Catmull-Rom inking, PDF coordinate transforms, Excalidraw scene state) that must remain untouched to avoid regressions.

---

## 2. Category 1: SAFE DELETE (Zero Risk)

| Target Item | Evidence & Files | Lines of Code | Why Redundant / Confusing | Expected Benefit | Tests Protecting It | Confidence |
|---|---|---|---|---|---|---|
| **14 Dead Marketing Prototype Files** | `src/components/marketing/HeroPanvasAppPrototype.tsx`, `MarketingNav.tsx`, `HeroSection.tsx`, `DownloadSection.tsx`, `VectorInkSection.tsx`, `NotebookStorySection.tsx`, `InfiniteCanvasSection.tsx`, `LocalFirstSection.tsx`, `PdfWorkbenchSection.tsx`, `FaqSection.tsx`, `MarketingFooter.tsx`, `LandingWebGL.tsx`, `CapabilityTicker.tsx`, `CyberBackground.tsx` | **2,306 LOC** | **DELETED 2026-09-10** after zero active imports were verified. Active landing page components were preserved. | Removes 2,300+ lines of clutter; cleans global search results; prevents accidental re-imports. | `npm run build`, `npm run typecheck` | **FIXED / TEST-PASSING** |
| **Dead `ViewportEngine.ts`** | `src/components/notebook/engine/ViewportEngine.ts` | **115 LOC** | **DELETED 2026-09-10** after zero active imports were verified. The active production notebook engine continues to use `ViewportManager.ts`. | Eliminates architectural ambiguity between two files named `Viewport*`. | `npm run typecheck` | **FIXED / TEST-PASSING** |
| **Tracked Build Artifacts in Git Index** | `dist-electron/main.js`, `dist-electron/preload.mjs`, `tsconfig.tsbuildinfo`, `Landingpage.png` | N/A (Binary/Build) | `.gitignore` now covers all four paths, including `Landingpage.png`. The four committed-tree entries remain tracked because the pre-existing `.git/index` is zero bytes and cannot accept `git rm --cached` until separately repaired. Local copies were preserved. | Clean git working tree; smaller clone size; no spurious git diffs on build. | `git ls-tree HEAD`, `.gitignore` inspection | **PARTIALLY EXECUTED — INDEX REPAIR REQUIRED** |
| **Orphaned Scratch Scripts** | `.tempmediaStorage/`, temporary benchmark files in artifacts | Scratch | One-off exploratory audit scripts. | Repository hygiene. | N/A | **100% (High)** |

---

## 3. Category 2: SAFE DEDUPLICATION (Low Risk)

| Target Item | Files Involved | Why Redundant | Proposed Consolidation | Regression Risk | Tests Protecting It | Confidence |
|---|---|---|---|---|---|---|
| **Folder Icon & Appearance Normalization** | `src/types/workspace.ts:12-18` vs `src/components/workspace/FolderModal.tsx` | Folder color validation regex and icon normalizers are implemented in both `workspace.ts` and UI dialogs. | Import and use `normalizeFolderAppearance` from `src/types/workspace.ts` everywhere. | Very Low | `tests/library-data.test.ts` | **95% (High)** |
| **Hex-to-RGBA Color Formatting** | `src/components/notebook/stickyNotes.ts:70` vs `src/components/notebook/engine/imageAppearance.ts:15` | Both modules implement independent `hexToRgba(hex, opacity)` string converters. | Extract into shared utility in `src/lib/utils/color.ts`. | Very Low | `tests/sticky-notes.test.ts`, `tests/image-appearance.test.ts` | **95% (High)** |
| **Sync Indicator Duplication** | `src/components/layout/StatusBar.tsx` vs `src/components/layout/TopBar.tsx` vs `src/components/ui/SyncIndicator.tsx` | `TopBar` uses `<SyncIndicator />` directly, while `StatusBar` manually checks `activeCanvasId` and renders duplicate connectivity strings reading from `useSyncStore`. | Use `<SyncIndicator />` in both locations reading from `useCloudSyncStore`. | Low | `tests/notebook-export-ui.test.ts` | **90% (High)** |
| **PDF Coordinate Inversion Helpers** | `src/components/notebook/engine/pdfCoordinates.ts` vs `src/lib/pdfAnnotationStorage.ts` | Similar bounding-box translation math between logical points and canvas points. | Keep separate for now (see Category 6); verify unit tests before any unification. | Medium | `tests/pdf-annotation.test.ts` | **70% (Medium)** |

---

## 4. Category 3: SMALL EXTRACTION (Controlled Modularization)

| Component | Current Size | Proposed Extraction | Rationale & Safety Boundary |
|---|---|---|---|
| **`NotebookFloatingToolbar.tsx`** | **2,094 LOC** | Extract into 3 child sub-components: `PenPropertiesSubmenu.tsx`, `TextFormattingSubmenu.tsx`, and `ShapesSubmenu.tsx`. | Currently one giant component managing 9 different tool popovers in a single 2,000-line JSX tree. Extracting sub-menus retains all props and callbacks without altering state flow. |
| **`NotebookRenderer.tsx`** | **2,341 LOC** | Extract `NotebookPageViewContainer.tsx` and `NotebookNavigationKeyboardHandler.ts`. | The main renderer mixes keyboard shortcut event listeners, layout reflow, touch gestures, and page view mounting in one file. |
| **`domain-handlers.ts`** | **1,354 LOC** | Extract `domain-validation.ts` (the 250 lines of argument checking at the top of the file). | `domain-handlers.ts` combines validation schemas, trash deletion helpers, and IPC registration. Isolating validation schemas improves auditability. |

---

## 5. Category 4: NAMING & COMMENTS CLEANUP

### Comments to Remove (AI Narration & Obvious Syntax)
- Comments merely reciting syntax:
  ```ts
  // Increment count by one
  count++;
  ```
- Redundant block intros:
  ```ts
  // ============================================
  // Helper function to return a string
  // ============================================
  ```
- Completed or stale TODO comments (verified 0 `TODO` markers remain in current source).

### Comments to PRESERVE (Critical Invariants)
- **Coordinate Transformations**:
  - `src/components/notebook/engine/pdfCoordinates.ts`: Comments explaining the 72 DPI PDF point mapping and margin offsets.
  - `src/lib/pageProperties.ts`: Comments documenting the four-sided Research Space expansion math (`extraTop`, `extraRight`).
  - `src/components/notebook/engine/strokePatternGeometry.ts`: Comments explaining continuous arc-length phase calculation around acute corners.
- **Persistence Guarantees**:
  - `electron/ipc/write-queue.ts`: Comments documenting the Windows `.tmp` atomic rename and file-lock retry invariants.
  - `src/database/schema.ts`: Comments explaining Dexie table version transitions and browser storage eviction risks.
- **Security Assertions**:
  - `electron/main.ts`: Comments explaining why `zoom-changed` sets zoom factor to 1 (preventing layout coordinate corruption) and audio-only media permissions.

---

## 6. Category 5: POST-V1 REFACTOR (Architectural Debt — Defer to V2)

> [!WARNING]
> Do NOT execute these large-scale refactors before V1 release. They carry high regression risk and are unnecessary for a stable V1 launch.

1. **Decomposing `workspaceStore.ts` (1,046 LOC)**:
   - `workspaceStore.ts` currently manages workspaces, folders, notebooks, sections, pages, active items, and drag-and-drop tree reordering.
   - *Why Defer*: 50+ components import `useWorkspaceStore`. Refactoring into `useFolderStore`, `usePageStore`, etc., touches dozens of files and risks breaking active document selection during V1 release.
2. **Full Elimination of `@supabase/supabase-js` SDK Dependency**:
   - Supabase sync is quarantined, but auth types and client wrappers still exist in `src/services/supabase/`.
   - *Why Defer*: The client is dormant. Full package removal can occur in V2 alongside the clean extension architecture.
3. **Unified Browser vs Desktop Storage Driver**:
   - The Repository layer currently branches on `window.panvas`.
   - *Why Defer*: The dual Dexie / Filesystem model is thoroughly tested and functions reliably.

---

## 7. Category 6: DANGEROUS — DO NOT TOUCH BEFORE RELEASE

> [!CAUTION]
> **STRICT EMBARGO**: Any edits to the following modules before V1 release are strictly forbidden:

1. **`src/components/notebook/engine/DrawingEngine.ts`**:
   - Contains the tuned Catmull-Rom spline tension parameters, velocity-based pressure smoothing, and stroke rasterization pipelines.
   - *Risk*: Any "simplification" will re-introduce stroke jitter, corner clipping, or latency regressions.
2. **`src/services/pdf/renderPdfAnnotations.ts` and `src/services/pdf/exportAnnotatedPdf.ts`**:
   - Contains the mathematically verified matrix transforms that align vector ink and sticky notes over scaled PDF pages during high-resolution PDF export.
   - *Risk*: Modifying coordinates will cause exported annotations to be displaced or misaligned.
3. **`src/components/canvas/CanvasView.tsx` (Excalidraw Integration)**:
   - Recently hardened and stabilized with CSP fixes and lazy-loading.
   - *Risk*: Excalidraw internals depend on specific scene initialization order; touching it risks breaking canvas mounting.
