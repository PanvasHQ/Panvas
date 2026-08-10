# 16 — Senior Engineering Handover Briefing (16_HANDOVER.md)

## 1. Executive Summary

This briefing document answers the critical question:
> **"What do I need to know before touching this codebase tomorrow?"**

Panvas is a mature **Electron + React + TypeScript + Vite** local-first digital workspace. The project has completed development through **Phase 9 (PDF Workspace)** of [`roadmap.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/roadmap.md). The application features a robust 5-tier document hierarchy, pressure-sensitive 2D vector ink drawing engine, TipTap rich text, infinite freeform canvas, PDF annotation workspace, and native local disk persistence.

---

## 2. Core Architecture Ground Rules

```
                      HYBRID PERSISTENCE MODEL
                      
                 User Edits / Actions in Renderer
                               │
                               ▼
                        Repository Layer
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
   Electron IPC Bridge                    IndexedDB (Dexie)
(WorkspaceService & DomainHandlers)          (schema.ts)
            │                                     │
            ▼                                     ▼
Local Disk Filesystem                     Binary Asset Tables
 Documents/Panvas/<ws>/.panvas/            pdfFiles & imageFiles
 ├── workspace.json (Serialized Structure)  (ArrayBuffer Blob Storage)
 └── notebooks/<nbId>/pages/<pageId>.json
```

1. **Local Disk Source of Truth**: Structural data (`Workspace`, `Folder`, `Notebook`, `Section`, `Page`, `CanvasFile`) is stored on disk at `%USERPROFILE%/Documents/Panvas/<WorkspaceName>/.panvas/workspace.json`.
2. **Binary Asset Storage**: PDF binaries (`pdfFiles`) and canvas images (`imageFiles`) are stored in IndexedDB (`schema.ts`).
3. **IPC Process Boundary**: The React Renderer process never accesses Node `fs` directly; it calls `window.panvas` exposed by `electron/preload.ts`.
4. **Isolated Viewport Architecture**: Document scrolling is strictly owned by `.notebook-viewport`. Fixed UI elements (`TopBar`, `Sidebar`, `NotebookFloatingToolbar`, `NotebookToolPropertiesPanel`) sit outside this viewport and must remain stationary.

---

## 3. Top 10 Critical Files

| Path | Significance |
|---|---|
| [`electron/main.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/electron/main.ts) | Electron main entry point, window framing, titlebar overlay configuration. |
| [`electron/ipc/domain-handlers.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/electron/ipc/domain-handlers.ts) | All IPC invocation handlers for workspace, notebook, section, and page disk operations. |
| [`src/stores/workspaceStore.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/stores/workspaceStore.ts) | Central Zustand store for active workspace, notebook, section, and page state. |
| [`src/components/notebook/NotebookRenderer.tsx`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/components/notebook/NotebookRenderer.tsx) | Core notebook editor layout, page rendering container, and native scroll container `.notebook-viewport`. |
| [`src/components/notebook/engine/NotebookEngine.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/components/notebook/engine/NotebookEngine.ts) | Facade for 2D vector drawing, input handling, selection, eraser, and stroke history. |
| [`src/hooks/usePdfDocument.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/hooks/usePdfDocument.ts) | Fetches PDF ArrayBuffers, generates Blob Object URLs, and manages PDF.js instance lifecycles. |
| [`src/components/pdf/PdfWorkspace.tsx`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/components/pdf/PdfWorkspace.tsx) | Interactive PDF document workspace and annotation suite. |
| [`src/components/canvas/CanvasView.tsx`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/components/canvas/CanvasView.tsx) | Freeform infinite canvas view embedding Excalidraw and custom LaTeX/Markdown blocks. |
| [`src/repositories/NotebookRepository.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/repositories/NotebookRepository.ts) | Repository layer abstraction delegating notebook CRUD between Electron IPC and Dexie. |
| [`src/database/schema.ts`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/database/schema.ts) | Dexie IndexedDB schema for fallback and binary PDF/image storage. |

---

## 4. ⚠️ Dangerous Areas: What NOT to Change Casually

> [!CAUTION]
> **DO NOT TOUCH THE FOLLOWING WITHOUT EXPLICIT RATIONALE**:
> 1. **Do NOT alter `.notebook-viewport` CSS scroll rules** in `NotebookRenderer.tsx`. Restoring body/window scrolling will break stationary toolbars.
> 2. **Do NOT change the PDF worker import in `InactivePagePreview.tsx` or `PdfBlock.tsx`**. Do not re-introduce external CDN URLs (`cdnjs.cloudflare.com`); this violates Electron's CSP and breaks offline rendering.
> 3. **Do NOT bypass `writeQueue` in `WorkspaceService.ts`**. Asynchronous parallel writes to `workspace.json` without queue serialization will corrupt disk JSON files.
> 4. **Do NOT bypass the Repository Layer in Zustand stores**. Component state updates must route through `NotebookRepository`, `WorkspaceRepository`, etc.
> 5. **Do NOT update roadmap completion checkboxes in `roadmap.md`** simply because a UI element or button exists. UI presence does NOT equal functional completion.

---

## 5. Summary of Recent Incident Fixes

1. **Electron Zombie Process Lock**: `taskkill /F /IM electron.exe /T` resolves `Failed to import PDF: UnknownError: Internal error` caused by orphaned background processes holding an OS lock on Chromium's Quota database.
2. **PDF.js Worker CSP Violation**: Replaced Cloudflare CDN URLs with local Vite asset imports (`pdfjs-dist/build/pdf.worker.min.mjs?url`).
3. **Blob Object URL Pipeline**: Standardized PDF loading across `usePdfDocument.ts`, `InactivePagePreview.tsx`, and `PdfBlock.tsx` to construct fresh `Blob` objects and manage `URL.createObjectURL(blob)` lifecycles.

---

## 6. What Should Be Implemented Next vs NOT Yet

### 🟢 What SHOULD be implemented next (in exact sequence):
1. **Phase 10 — Note Search**: Implement full-text indexing for TipTap page rich-text body content (`page.content`).
2. **Phase 11 — Handwriting Intelligence**: OCR handwriting conversion.
3. **Phase 12 — Workspace Explorer Functionality**: Deep file manager actions (cut, copy, multi-folder drag).

### 🔴 What should NOT be implemented yet:
* **Cloud Synchronization / OneDrive**: Phase 20 (Cloud Sync is an optional secondary tier after local data models are completely frozen).
* **Mobile Companion App**: Phase 33.
* **Photoshop-Level Brush Engines**: Phase 34 (Advanced illustration tools are long-term post-MVP).
