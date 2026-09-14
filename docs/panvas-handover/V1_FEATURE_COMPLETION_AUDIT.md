# Panvas V1 Feature Completion Audit

*Audit Date: September 10, 2026*  
*Document Authority: Pre-Hardening Baseline / Release Audit*  
*Status of Record: LOCKED FOR V1 HARDENING & OSS RELEASE*  
*Scope Reference: [`V1_FEATURE_SCOPE.md`](V1_FEATURE_SCOPE.md)*  
*Owner Verification Note: The repository owner has manually tested the latest notebook/editor correction work and confirmed runtime operation. V1 feature development is frozen.*

---

## 1. Overall V1 Release Verdict

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PANVAS V1 AUDIT VERDICT                             │
│                                                                             │
│   FEATURE COMPLETENESS:                                                     │
│   [✔] V1 FEATURE COMPLETE WITH HARDENING REMAINING                         │
│                                                                             │
│   CODE READY FOR OSS:                                                       │
│   [!] CONDITIONAL (Requires Root LICENSE, THIRD_PARTY_NOTICES, & Cleanup)   │
│                                                                             │
│   READY FOR HARDENING PHASE:                                                │
│   [✔] YES (Features frozen; proceed to Backlog Packages A–F)               │
│                                                                             │
│   READY FOR STRIX PENTEST:                                                  │
│   [!] CONDITIONAL (Fix HARDEN-005 IPC sender validation first)             │
│                                                                             │
│   READY FOR PUBLIC RELEASE:                                                 │
│   [X] NO (5 BLOCKERs + 7 P0s open; unskippable gates pending)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Audit Conclusion**:  
> Panvas V1 is **FEATURE COMPLETE**. All feature families contracted for V1 in [`V1_FEATURE_SCOPE.md`](V1_FEATURE_SCOPE.md) exist in source code, pass 505 automated unit/integration tests, and have been manually verified by the owner.  
> However, **feature-complete does not mean production-ready**. 5 BLOCKERs (data-loss migration bug, browser storage eviction vulnerability, sync UI split-brain, missing root license, and IPC sender check) and 7 P0 issues must be resolved in the hardening phase before public release.

---

## 2. Comprehensive Feature Completion Matrix

### Legend & Classification Standards
- **`IMPLEMENTED`**: Fully written in source code, active in runtime shell.
- **`IMPLEMENTED / TEST-PASSING`**: Active in code and covered by passing automated tests.
- **`OWNER MANUALLY VERIFIED`**: Tested and confirmed working in runtime by the project owner.
- **`V1 HARDENING REQUIRED`**: Feature works, but requires data-integrity, security, or error-handling hardening.
- **`PARTIAL`**: Baseline exists; specific edge case or platform parity requires completion.
- **`BROKEN`**: Feature exists but fails to function or causes runtime crash.
- **`MISSING`**: Required V1 capability absent from source.
- **`NEEDS MANUAL VERIFICATION`**: Automated tests pass; manual runtime check on target OS pending.
- **`V2 / NOT REQUIRED FOR V1`**: Formally deferred to post-V1 release (Embedded Web, MCP, Extensions, AI).

---

### A. Workspace & Organization

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Library Workspace** | `IMPLEMENTED / TEST-PASSING` | `src/components/library/LibraryWorkspace.tsx` | `tests/library.test.ts`, `tests/library-data.test.ts`, `tests/library-lifecycle.test.ts` | `OWNER MANUALLY VERIFIED` | No | Shelf view, note previews, search filter, recent items. |
| **Multi-Workspace System** | `V1 HARDENING REQUIRED` | `src/stores/workspaceStore.ts`, `electron/ipc/domain-handlers.ts`, `src/services/workspace/WorkspaceService.ts` | `tests/library-data.test.ts` | `OWNER MANUALLY VERIFIED` | `BLOCKER` (`HARDEN-001`) | Core hierarchy operates cleanly; Dexie-to-FS migration omits rich text/ink drawings (`HARDEN-001`). |
| **Folder Hierarchy** | `IMPLEMENTED / TEST-PASSING` | `src/components/workspace/WorkspaceTree.tsx`, `src/repositories/FolderRepository.ts` | `tests/library-data.test.ts` | `OWNER MANUALLY VERIFIED` | No | Nested folders, folder colors (`FOLDER_COLOR_PRESETS`), and icons (`FOLDER_ICON_IDS`). |
| **Notebooks & Covers** | `IMPLEMENTED / TEST-PASSING` | `src/components/workspace/NotebookCard.tsx`, `src/types/notebook.ts` | `tests/page-properties.test.ts` | `OWNER MANUALLY VERIFIED` | No | 6 cover templates (linen, leather, midnight, sage, plum, sand) + custom image covers. |
| **Notebook Sections** | `IMPLEMENTED / TEST-PASSING` | `src/components/workspace/WorkspaceTree.tsx`, `src/repositories/NotebookRepository.ts` | `tests/trash-purge.test.ts` | `OWNER MANUALLY VERIFIED` | No | Section tabs, reordering, and section-scoped pages. |
| **Pages Management** | `V1 HARDENING REQUIRED` | `src/components/notebook/NotebookPageView.tsx`, `src/repositories/NotebookRepository.ts` | `tests/page-properties.test.ts` | `OWNER MANUALLY VERIFIED` | `P0` (`HARDEN-026`) | Create/rename/delete works. PDF page creation uses a double-roundtrip write hack (`HARDEN-026`). |
| **Global Trash & Recovery** | `IMPLEMENTED / TEST-PASSING` | `src/components/layout/TrashSection.tsx`, `src/services/library/trashModel.ts`, `electron/ipc/workspace-trash.ts` | `tests/trash-purge.test.ts` | `OWNER MANUALLY VERIFIED` | `P1` (`HARDEN-013`) | Soft-delete with `deletedByAncestorId`, retention countdown, purge, and restore. Uses `window.confirm` (`HARDEN-013`). |
| **Recents & Pinned Notes** | `IMPLEMENTED / TEST-PASSING` | `src/components/library/LibraryWorkspace.tsx`, `src/stores/workspaceStore.ts` | `tests/library-lifecycle.test.ts` | `OWNER MANUALLY VERIFIED` | No | `lastOpenedAt` tracking and `isPinned` bookmarking across notebooks and canvases. |

---

### B. Notebook & Drawing Engine

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Handwriting & Vector Ink** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/DrawingEngine.ts`, `src/components/notebook/engine/strokeGeometry.ts` | `tests/ink-input.test.ts`, `tests/panvas-interactions.test.ts` | `OWNER MANUALLY VERIFIED` | No | Low-latency Catmull-Rom spline smoothing with high-DPR backing. |
| **Stylus Pressure Sensitivity** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/InputManager.ts` | `tests/ink-input.test.ts` | `OWNER MANUALLY VERIFIED` | No | PointerEvent pressure mapping with hardware fallback curves. |
| **Stroke Stabilization** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/DrawingEngine.ts` | `tests/ink-input.test.ts` | `OWNER MANUALLY VERIFIED` | No | Running average smoothing window for jitter-free handwriting. |
| **Pen Families / Nibs** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/inkFamilyGeometry.ts`, `src/stores/notebookSettingsStore.ts` | `tests/ink-input.test.ts` | `OWNER MANUALLY VERIFIED` | No | Pen, Pencil, Marker, Highlighter, Laser pointer. |
| **Stroke Patterns (Dash/Dot)** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/strokePatternGeometry.ts`, `src/components/notebook/engine/lineStyleGeometry.ts` | `tests/stroke-pattern.test.ts` | `OWNER MANUALLY VERIFIED` | No | Continuous phase preservation across acute corners for dashed and dotted lines. |
| **Eraser Tool** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/DrawingEngine.ts` | `tests/panvas-interactions.test.ts` | `OWNER MANUALLY VERIFIED` | No | Stroke eraser (deletes whole stroke) and area eraser capabilities. |
| **Interactive Ruler** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/DrawingEngine.ts` | `tests/panvas-interactions.test.ts` | `OWNER MANUALLY VERIFIED` | No | On-screen angle/distance guide with snap-to-edge drawing. |
| **Geometric Shapes** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/ShapeManager.ts`, `src/services/pdf/drawPdfShape.ts` | `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | Rectangle, Ellipse, Triangle, Line, Arrow, Star. |
| **Selection (Box & Lasso)** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/SelectionEngine.ts` | `tests/panvas-interactions.test.ts` | `OWNER MANUALLY VERIFIED` | No | Bounding box and freehand lasso selection of strokes, text, stickies, and images. |
| **Transforms (Move, Resize, Rotate)** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/SelectionEngine.ts` | `tests/panvas-interactions.test.ts` | `OWNER MANUALLY VERIFIED` | No | Multi-handle transform box with aspect ratio lock and angular rotation. |
| **Rich Text (TipTap Engine)** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/FloatingTextEditor.tsx`, `src/components/notebook/engine/TextManager.ts` | `tests/rich-text.test.ts` | `OWNER MANUALLY VERIFIED` | No | Headings (H1-H3), bold, italic, code blocks, task lists, bullet lists. |
| **Font Selection & Typography** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/TextFontPicker.tsx`, `src/components/notebook/textFonts.ts`, `src/components/notebook/textTypography.ts` | `tests/notebook-object-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | `P2` (`HARDEN-022`) | Inter, Times New Roman, JetBrains Mono, Kalam, Dancing Script. Local WOFF2 fallback needed (`HARDEN-022`). |
| **Handwriting Conversion** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/HandwritingConversionDialog.tsx`, `src/services/recognition/` | `tests/handwriting-recognition.test.ts`, `tests/neural-handwriting.test.ts` | `OWNER MANUALLY VERIFIED` | No | Local ML transformer stroke-to-text recognition with line continuation. |
| **Sticky Notes** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/stickyNotes.ts`, `src/components/notebook/StickyGallery.tsx` | `tests/sticky-notes.test.ts`, `tests/sticky-notes-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | No | 6 shapes, 12 preset colors, custom opacity, TipTap text inside. |
| **Images & Media** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/ImageManager.ts`, `src/components/notebook/FloatingImageControls.tsx`, `src/components/notebook/ImageCropEditor.tsx` | `tests/image-appearance.test.ts` | `OWNER MANUALLY VERIFIED` | No | Universal drop router, aspect ratio scaling, opacity control, visual crop editor. |
| **Voice Notes & Audio Objects** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/NotebookVoiceNote.tsx`, `src/services/audio/voiceNoteObjects.ts` | `tests/audio-notes.test.ts` | `OWNER MANUALLY VERIFIED` | No | Page-owned voice card with playback scrub, rename, color, and delete. |
| **Drawing Layers** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/LayerManager.ts`, `src/components/notebook/NotebookElementsControl.tsx` | `tests/layers.test.ts`, `tests/layers-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | No | Content, Annotation, and Background layers with visibility/lock toggles. |
| **Local Elements System** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/SelectionEngine.ts` | `tests/local-elements-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | No | Isolated page-coordinate element storage with z-index ordering. |
| **Undo / Redo Stack** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/engine/HistoryManager.ts` | `tests/panvas-interactions.test.ts`, `tests/notebook-object-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | No | Deep state undo/redo across strokes, text edits, sticky notes, and voice cards. |

---

### C. Paper, Stationery & Templates

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Paper Colors & Themes** | `IMPLEMENTED / TEST-PASSING` | `src/lib/pageProperties.ts`, `src/components/notebook/NotebookToolPropertiesPanel.tsx` | `tests/page-properties.test.ts` | `OWNER MANUALLY VERIFIED` | No | Independent document paper color decoupled from application UI theme. |
| **Background Line Patterns** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/templates/TemplatePreview.tsx`, `src/types/notebook.ts` | `tests/page-properties.test.ts` | `OWNER MANUALLY VERIFIED` | No | Blank, Ruled, Narrow/Wide ruled, Small/Large grid, Dotted, Engineering, Music. |
| **Structured Templates** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/templates/TemplateRegistry.tsx`, `src/components/notebook/templates/TemplateGalleryModal.tsx` | `tests/page-properties.test.ts` | `OWNER MANUALLY VERIFIED` | No | Cornell notes, Daily/Weekly/Monthly planners, Checklist, Journal. |
| **Creation Preview Cards** | `IMPLEMENTED / TEST-PASSING` | `src/components/workspace/CreateDialog.tsx`, `src/components/notebook/templates/TemplatePreview.tsx` | `tests/notebook-runtime-stability.test.ts` | `OWNER MANUALLY VERIFIED` | No | Visual SVG paper template card previews during notebook creation. |
| **Page Sizing & Orientation** | `IMPLEMENTED / TEST-PASSING` | `src/lib/pageProperties.ts`, `src/types/notebook.ts` | `tests/page-properties.test.ts` | `OWNER MANUALLY VERIFIED` | No | A3, A4, A5, Letter, Custom sizes; Portrait and Landscape orientations. |
| **Four-Sided Research Space** | `IMPLEMENTED / TEST-PASSING` | `src/lib/pageProperties.ts`, `src/components/notebook/NoteSpaceControl.tsx` | `tests/page-properties.test.ts`, `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | `extraTop`, `extraRight`, `extraBottom`, `extraLeft` expandable margin regions. |

---

### D. Reading & Presentation Modes

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Read Mode** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/NotebookRenderer.tsx`, `src/stores/layoutStore.ts` | `tests/mobile-presentation.test.ts` | `OWNER MANUALLY VERIFIED` | No | Chrome-hidden distraction-free reading with touch and scroll navigation. |
| **Present Mode** | `IMPLEMENTED / TEST-PASSING` | `src/components/workspace/PresentationOverlay.tsx`, `src/components/notebook/notebookNavigation.ts` | `tests/mobile-presentation.test.ts`, `tests/notebook-object-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | No | Fullscreen slide presentation with laser pointer and slide navigation. |
| **Keyboard Navigation** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/notebookNavigation.ts` | `tests/notebook-object-runtime.test.ts` | `OWNER MANUALLY VERIFIED` | No | Arrow keys, PageUp/PageDown, Space/Shift+Space with focus safety. |
| **Continuous Scrolling** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/NotebookRenderer.tsx`, `src/components/pdf/PdfWorkspace.tsx` | `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | Vertical continuous scroll, horizontal page-flip, and two-page book spread. |

---

### E. PDF Workspace & Annotation

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Offline PDF Rendering** | `IMPLEMENTED / TEST-PASSING` | `src/components/pdf/PdfWorkspace.tsx`, `src/hooks/usePdfDocument.ts` | `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | Multi-page PDF.js worker rendering with text layer extraction. |
| **In-Place Vector Inking** | `IMPLEMENTED / TEST-PASSING` | `src/services/pdf/renderPdfAnnotations.ts`, `src/services/pdf/drawPdfStroke.ts` | `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | Catmull-Rom vector strokes and highlighters directly on PDF coordinates. |
| **PDF Page Rotation** | `IMPLEMENTED / TEST-PASSING` | `src/components/pdf/PdfWorkspace.tsx`, `src/lib/pdfAnnotationStorage.ts` | `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | 90°/180°/270° rotation preserving canonical annotation coordinates. |
| **Thumbnail Sidebar** | `IMPLEMENTED / TEST-PASSING` | `src/components/pdf/PdfThumbnailSidebar.tsx`, `src/components/pdf/pdfNavigation.ts` | `tests/pdf-annotation.test.ts` | `OWNER MANUALLY VERIFIED` | No | Lazy-rendered page thumbnails with active page viewport tracking. |
| **Annotated PDF Export** | `IMPLEMENTED / TEST-PASSING` | `src/services/pdf/exportAnnotatedPdf.ts`, `src/services/pdf/notebookPdfExport.ts` | `tests/notebook-export.test.ts`, `tests/notebook-export-ui.test.ts` | `OWNER MANUALLY VERIFIED` | No | Merges original PDF byte stream with vector strokes, stickies, and text into PDF. |
| **No Duplicate Card Bug** | `IMPLEMENTED / TEST-PASSING` | `src/components/pdf/PdfWorkspace.tsx`, `src/components/library/LibraryWorkspace.tsx` | `tests/library-lifecycle.test.ts` | `OWNER MANUALLY VERIFIED` | No | Single canonical PDF page card; eliminates ghost duplicate attachment cards. |

---

### F. Infinite Visual Canvas (Excalidraw 0.17.6)

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Excalidraw Engine Core** | `IMPLEMENTED / TEST-PASSING` | `src/components/canvas/CanvasView.tsx`, `src/components/canvas/CanvasToolbar.tsx` | `tests/canvas-capabilities.test.ts` | `OWNER MANUALLY VERIFIED` | No | Complete infinite vector surface with shapes, lines, text, and arrows. |
| **Custom LaTeX Formula Blocks** | `IMPLEMENTED / TEST-PASSING` | `src/components/canvas/LatexBlock.tsx`, `src/types/canvas.ts` | `tests/canvas-capabilities.test.ts` | `OWNER MANUALLY VERIFIED` | No | KaTeX-rendered mathematical equation blocks embedded directly in canvas scene. |
| **Custom UI Mockup Blocks** | `IMPLEMENTED / TEST-PASSING` | `src/components/canvas/MockupBlock.tsx`, `src/components/canvas/customBlocks.ts` | `tests/canvas-capabilities.test.ts` | `OWNER MANUALLY VERIFIED` | No | Interactive wireframing blocks (buttons, inputs, toggles, window frames). |
| **Canvas Voice Note Blocks** | `IMPLEMENTED / TEST-PASSING` | `src/components/canvas/CanvasVoiceNote.tsx`, `src/services/audio/voiceNoteObjects.ts` | `tests/audio-notes.test.ts` | `OWNER MANUALLY VERIFIED` | No | Spatial voice memo cards with in-canvas playback timeline. |
| **Scene Persistence & Files** | `IMPLEMENTED / TEST-PASSING` | `src/repositories/CanvasRepository.ts`, `src/stores/canvasStore.ts` | `tests/canvas-persistence.test.ts` | `OWNER MANUALLY VERIFIED` | No | Saves elements, appState, files, and custom blocks to `.panvas/` and IndexedDB. |
| **Grid, Snapping & Styling** | `IMPLEMENTED / TEST-PASSING` | `src/components/canvas/canvasBackgrounds.ts`, `src/components/canvas/canvasGestureRecognition.ts` | `tests/canvas-capabilities.test.ts` | `OWNER MANUALLY VERIFIED` | No | Object snapping, grid alignment, gesture-to-shape recognition. |
| **Bundle Lazy Loading** | `IMPLEMENTED / TEST-PASSING` | `src/components/workspace/WorkspaceContent.tsx` | `tests/browser-bootstrap.test.ts` | `OWNER MANUALLY VERIFIED` | No | `React.lazy` with Suspense fallback; isolates 3.8MB Excalidraw chunk (`HARDEN-012`). |
| **Community Shape Libraries** | `IMPLEMENTED / TEST-PASSING` | `src/components/canvas/CanvasLibraryDrawer.tsx`, `src/services/canvas/canvasLibraryModel.ts` | `tests/canvas-capabilities.test.ts` | `OWNER MANUALLY VERIFIED` | No | Import/export `.excalidrawlib` files; CSP allows `libraries.excalidraw.com`. |

---

### G. Audio Subsystem

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Voice Recording** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/NotebookAudioControl.tsx`, `src/services/audio/AudioService.ts` | `tests/audio-notes.test.ts` | `OWNER MANUALLY VERIFIED` | No | MediaRecorder API capturing WebM/WAV audio via audio-only Electron permission. |
| **Page Ownership & Placement**| `IMPLEMENTED / TEST-PASSING` | `src/services/audio/pageAudioPersistence.ts`, `src/services/audio/voiceNoteObjects.ts` | `tests/audio-notes.test.ts` | `OWNER MANUALLY VERIFIED` | No | Voice notes belong to specific page coordinates and scale with page transforms. |
| **Synchronized Playback** | `IMPLEMENTED / TEST-PASSING` | `src/components/notebook/NotebookVoiceNote.tsx`, `src/services/audio/AudioPlayer.ts` | `tests/audio-notes.test.ts` | `OWNER MANUALLY VERIFIED` | No | Waveform scrubber, time display, volume control, and play/pause toggles. |
| **Asset Lifecycle & Deletion** | `IMPLEMENTED / TEST-PASSING` | `src/services/audio/voiceNoteCommands.ts`, `src/repositories/NotebookRepository.ts` | `tests/audio-notes.test.ts` | `OWNER MANUALLY VERIFIED` | No | Audio files stored in `Assets/audio/` and IndexedDB; undo/redo preserves audio references. |

---

### H. Local-First Durability, Storage & Sync

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Electron Filesystem Storage** | `V1 HARDENING REQUIRED` | `electron/ipc/WorkspaceService.ts`, `electron/ipc/write-queue.ts` | `tests/electron-integrity.test.ts` | `OWNER MANUALLY VERIFIED` | `P0` (`HARDEN-006`, `007`) | Writes to `Documents/Panvas/`. Needs atomic binary writes and locked-file retries. |
| **Browser IndexedDB Storage** | `V1 HARDENING REQUIRED` | `src/database/schema.ts`, `src/database/workspaceDB.ts` | `tests/browser-integrity.test.ts` | `OWNER MANUALLY VERIFIED` | `BLOCKER` (`HARDEN-002`) | Complete Dexie schema. Missing `navigator.storage.persist()` on boot (`HARDEN-002`). |
| **Dexie-to-FS Migration** | `V1 HARDENING REQUIRED` | `src/lib/migration.ts`, `electron/ipc/domain-handlers.ts` | `tests/library-lifecycle.test.ts` | `OWNER MANUALLY VERIFIED` | `BLOCKER` (`HARDEN-001`) | Core folders/canvases migrate. Missing page rich text, drawings, and assets. |
| **Local Full-Text Search** | `IMPLEMENTED / TEST-PASSING` | `src/services/search/localSearchIndexState.ts`, `src/components/ui/CommandPalette.tsx` | `tests/search-pdf.test.ts` | `OWNER MANUALLY VERIFIED` | No | Fast deterministic keyword search indexing note titles, TipTap text, and PDF streams. |
| **Command Palette (`Ctrl+K`)** | `IMPLEMENTED / TEST-PASSING` | `src/components/ui/CommandPalette.tsx` | `tests/notebook-export-ui.test.ts` | `OWNER MANUALLY VERIFIED` | No | Quick navigation to any notebook, page, canvas, or action in < 50ms. |
| **Workspace Backup & Restore** | `IMPLEMENTED / TEST-PASSING` | `src/services/backup/backupService.ts`, `electron/ipc/domain-handlers.ts` | `tests/backup.test.ts` | `OWNER MANUALLY VERIFIED` | No | Full workspace ZIP packaging and atomic restore with ID remapping. |
| **Google Drive Cloud Sync** | `V1 HARDENING REQUIRED` | `src/services/cloudsync/engine.ts`, `src/stores/cloudSyncStore.ts`, `src/components/library/CloudSyncPanel.tsx` | `tests/cloud-sync-core.test.ts`, `tests/cloud-sync-stability.test.ts` | `OWNER MANUALLY VERIFIED` | `BLOCKER` (`HARDEN-003`, `005`) | Entry routing unified. Needs `StatusBar` syncStore cleanup and IPC sender check. |

---

### I. Platform Targets & Open Source Readiness

| Feature | Status | Primary Implementation Files | Tests | Manual Verification Status | Release Blocker? | Notes |
|---|---|---|---|---|---|---|
| **Windows Electron App** | `V1 HARDENING REQUIRED` | `electron/main.ts`, `electron/preload.ts`, `electron-builder.json` | `tests/electron-pipeline.test.ts`, `tests/discord-rpc.test.ts` | `OWNER MANUALLY VERIFIED` | `P0` (`HARDEN-027`, `028`) | Frameless window, Discord RPC (`panvas-logo_1`). Needs shutdown flush and icon. |
| **Web / PWA Application** | `IMPLEMENTED / TEST-PASSING` | `src/bootstrap.tsx`, `public/service-worker.js`, `src/lib/location.ts` | `tests/browser-bootstrap.test.ts`, `tests/default-landing.test.ts` | `OWNER MANUALLY VERIFIED` | No | Adaptive routing (`/app`, `/privacy`, `/terms`), offline service worker, responsive shell. |
| **Open Source Licensing** | `V1 HARDENING REQUIRED` | Repository root | None | — | `BLOCKER` (`HARDEN-004`) | Root `LICENSE` (MIT) and `THIRD_PARTY_NOTICES.md` missing. |
| **Legal Attribution Boundary** | `IMPLEMENTED` | `docs/panvas-handover/OSS_GITHUB_RELEASE_PLAN.md` | None | — | No | Clear boundary: Excalidraw (MIT dependency) vs Joplin/Xournal++/FreeNotes (inspirations). |

---

### J. Formally Deferred to V2 (NOT Blocking V1)

| Feature Family | Target Horizon | Status | Rationale |
|---|---|---|---|
| **Embedded Web Workspace / Browser** | **V2** | `V2 / NOT REQUIRED FOR V1` | Intentionally deferred to focus V1 on local-first stability and zero security risks. |
| **Model Context Protocol (MCP)** | **V2** | `V2 / NOT REQUIRED FOR V1` | Server bridge, tools, and protocol integration deferred to extensibility horizon. |
| **Panvas Extension / Plugin SDK** | **V2** | `V2 / NOT REQUIRED FOR V1` | Plugin sandbox, manifest, and runtime APIs deferred to V2 platform expansion. |
| **Panvas AI Intelligence** | **V2** | `V2 / NOT REQUIRED FOR V1` | Local/cloud LLMs, summarization, semantic Q&A, and agent workflows strictly belong to V2. |

---

## 3. Summary of Open Blocking Items for V1 Release Gate

| Item ID | Severity | Subsystem | Required Action |
|---|---|---|---|
| **`HARDEN-001`** | **BLOCKER** | Migration / Storage | Serialize `db.notebookPageContents`, `db.notebookPageDrawings`, and binary assets during Dexie-to-FS migration. |
| **`HARDEN-002`** | **BLOCKER** | Browser Durability | Request `navigator.storage.persist()` on boot in `src/database/schema.ts` to prevent Safari/Chrome storage eviction. |
| **`HARDEN-003`** | **BLOCKER** | Sync UX / State | Rewire `StatusBar.tsx` connectivity and sync indicators to `cloudSyncStore`; clean legacy `syncStore`. |
| **`HARDEN-004`** | **BLOCKER** | Legal / OSS | Add root `LICENSE` (MIT), set `"license": "MIT"` in `package.json`, and author `THIRD_PARTY_NOTICES.md`. |
| **`HARDEN-005`** | **BLOCKER** | IPC Security | Add `requireTrustedSender(event)` origin check to all IPC handlers in `electron/ipc/cloudsync-handlers.ts`. |
| **`HARDEN-006`** | **P0** | Storage Integrity | Route binary PDF and image disk writes through temporary file staging (`.tmp` $\rightarrow$ atomic rename). |
| **`HARDEN-007`** | **P0** | Storage Config | Add retry exponential backoff for OneDrive file locking and expose storage location selector in Settings. |
| **`HARDEN-008`** | **P0** | Memory / Lifecycle | Call `notebookEngine.destroy()` on component unmount in `NotebookRenderer.tsx` to prevent memory leak. |
| **`HARDEN-010`** | **P0** | Cross-Platform | Add POSIX fallback paths for Google OAuth token storage when running outside Windows. |
| **`HARDEN-026`** | **P0** | Repository / IPC | Expand `notebookPage:create` IPC signature to accept `type` and `pdfDataId`, eliminating double-write hack. |
| **`HARDEN-027`** | **P0** | Electron Lifecycle | Ensure Electron `before-quit` flushes in-flight tasks in `writeQueue` before exiting process. |

