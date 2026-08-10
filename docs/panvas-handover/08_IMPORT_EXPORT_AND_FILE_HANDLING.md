# 08 — Import & Export System (08_IMPORT_EXPORT_SYSTEM.md)

## 1. Subsystem Overview

The **Import & Export System** enables Panvas to ingest external content (PDF documents, raster images, workspace archives) and export notes and drawings to file formats.

---

## 2. Component & File Reference

| Module | Location | Primary Responsibility |
|---|---|---|
| **`UniversalDropRouter.ts`** | `src/services/drop/UniversalDropRouter.ts` | Listens for native OS file drag-and-drop events (from Windows Explorer, browser, desktop) and routes files to target section or canvas. |
| **`ImageManager.ts`** | `src/components/notebook/engine/ImageManager.ts` | Handles storing, scaling, selecting, and positioning raster image objects on notebook page drawing surfaces. |
| **`Sidebar.tsx` / `NotebookSidebar.tsx`** | `src/components/layout/Sidebar.tsx` | UI handlers for PDF import file pickers and drag-and-drop target drop zones. |
| **`migration.ts`** | `src/lib/migration.ts` | Handles importing legacy Dexie database records into native file system `.panvas/` structures. |

---

## 3. Implementation Status Matrix

| Feature | Status | Functional Details |
|---|---|---|
| **PDF Import (File Picker)** | **DONE** | Invoked from Sidebar / Notebook section menu. Reads PDF via `file.arrayBuffer()`, saves to IndexedDB `pdfFiles`, creates PDF page. |
| **PDF Import (Drag & Drop)** | **DONE** | Handled by `UniversalDropRouter.ts` and drop targets in `Sidebar.tsx`. Automatically imports dropped PDF files into active notebook section. |
| **Image Insertion (File Picker)** | **DONE** | Inserts PNG/JPEG/WEBP image onto notebook page or canvas surface. Stores binary in `imageFiles` table or inline base64/blob URL. |
| **Image Drag & Drop** | **DONE** | Dragging images into `NotebookRenderer.tsx` creates an `ImageObject` on the active page drawing surface at drop coordinates. |
| **Image Paste** | **DONE** | Handles `paste` clipboard events in `NotebookRenderer.tsx` and TipTap editor. |
| **Image Manipulation** | **DONE** | Images on notebook pages can be moved, resized via selection handles, and deleted. |
| **Workspace Export** | **PARTIAL** | Basic JSON export capability via IPC `workspace:export`; PDF/PNG export for full notebook pages is partially prototyped. |
| **Dexie to FS Migration** | **DONE** | `migrateFromDexieToFs()` migrates all workspaces, notebooks, pages, and canvas data from browser IndexedDB to disk `.panvas/` files. |

---

## 4. Universal Drag & Drop Router (`UniversalDropRouter.ts`)

`UniversalDropRouter.ts` captures native drop events and inspects `e.dataTransfer.files`:

```typescript
export class UniversalDropRouter {
  public routeDrop(e: DragEvent, context: { workspaceId: string; notebookId?: string; sectionId?: string; canvasId?: string }) {
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      if (file.type === 'application/pdf') {
        this.handlePdfDrop(file, context);
      } else if (file.type.startsWith('image/')) {
        this.handleImageDrop(file, context);
      }
    }
  }
}
```

* **PDF Routing**: If dropped onto Notebook Sidebar or Section item, creates a new page of `type: 'pdf'`. If dropped directly onto active notebook page surface, displays guidance toast (*"PDFs cannot be inserted into notebook pages directly; import via sidebar"*).
* **Image Routing**: Spawns an `ImageObject` on the page surface at drop coordinates `(clientX, clientY)`.
