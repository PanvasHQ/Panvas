# 13 — Partial & Missing Features (13_PARTIAL_AND_MISSING_FEATURES.md)

## 1. Overview & Classification System

To prevent new engineers or AI coding agents from assuming UI mockups represent finished code, all non-completed subsystems are classified into 4 statuses:

* **PARTIAL**: UI exists and basic functionality works, but key features, edge case handlers, or export operations are missing.
* **BROKEN**: Code exists but currently fails or is stubbed out.
* **MISSING**: Feature is specified on the roadmap or UI, but no underlying implementation exists.
* **UNKNOWN**: Implementation status cannot be verified safely from current repository files alone.

---

## 2. Comprehensive Status Matrix

| Subsystem / Feature | Classification | Description & Current Limitations |
|---|---|---|
| **Full Note Content Search** | **PARTIAL** | Search bar in `TopBar.tsx` searches Workspace, Notebook, Section, and Page titles. Full-text search inside page body text (`page.content`) and ink stroke OCR is not implemented. |
| **PDF Annotation Flattening & Export** | **PARTIAL** | Ink annotations can be drawn on PDF pages inside `PdfWorkspace.tsx`, but flattening annotations back into a downloadable, modified `.pdf` file via `pdf-lib` is incomplete. |
| **Canvas PNG/PDF Export** | **PARTIAL** | Canvas PNG export helper functions exist in Excalidraw, but multi-block document export to PDF is not finished. |
| **Workspace Explorer Full File Manager** | **PARTIAL** | `WorkspaceExplorerPreview.tsx` renders file grids, but advanced file manager actions (cut, copy, multi-folder drag move) are only partially hooked up. |
| **Cloud Sync & Supabase Integration** | **BROKEN** | `syncStore.ts` and `syncEngine.ts` contain queue stubs, but actual cloud synchronization with Supabase or external backends is disabled/stubbed out. |
| **Handwriting OCR / Text Conversion** | **MISSING** | Converting handwritten ink strokes to typed digital text is not implemented (Phase 11). |
| **Automatic Handwriting-to-Font** | **MISSING** | Real-time conversion of pen input into handwritten-style text fonts is not implemented (Phase 11). |
| **PDF-to-Notebook Page Conversion** | **MISSING** | Converting imported PDF pages into editable Panvas Notebook pages with vector ink overlays (Phase 10E). |
| **OneDrive Sync Provider** | **MISSING** | Microsoft Graph API authentication and OneDrive sync queue provider (Phase 20 / Phase 23). |
| **Mobile Companion Application** | **MISSING** | Native iOS / Android companion applications (Phase 33). |
| **Collaborative Editing / CRDT** | **MISSING** | Multi-user real-time co-editing engine (Phase 34). |
| **Advanced Photoshop-Level Brushes** | **UNKNOWN** | Raster layer drawing, custom brush textures, and Clip Studio Paint level illustration tools require future verification before planning. |

---

## 3. Detailed Component Technical Gaps

### 3.1 Note Content Search (`Phase 10`)
* **Current State**: `useWorkspaceStore` filters `notebooks`, `canvasFiles`, and `notebookPages` by title strings.
* **Missing**: Indexing engine to parse TipTap JSON/HTML DOM structures (`page.content`) and query text terms across hundreds of pages efficiently.

### 3.2 Cloud Sync Engine (`Phase 19 / 20`)
* **Current State**: `syncStore.ts` maintains an array of `SyncQueueItem` objects.
* **Broken / Incomplete**: Sync scheduler (`SyncScheduler.ts`) lacks active retry logic, conflict resolution handlers, and authenticated payload transport logic. `syncStatus` defaults to `'local'`.
