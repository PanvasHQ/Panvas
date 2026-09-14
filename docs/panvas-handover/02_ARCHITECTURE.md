# 02 — Architecture (02_ARCHITECTURE.md)

## 1. System Architecture Overview

Panvas is built as an **Electron + React + Vite + TypeScript** desktop application. It uses a **Hybrid Storage Architecture** combining native local file system storage (via Electron IPC) and browser-based IndexedDB storage (via Dexie.js) for binary blobs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ELECTRON MAIN PROCESS                             │
│  [electron/main.ts]                                                         │
│   ├── Window Lifecycle & BrowserWindow Management                           │
│   ├── Native Titlebar Framing & Process Handlers                            │
│   └── IPC Handlers [electron/ipc/domain-handlers.ts]                       │
│       ├── WorkspaceService.ts (Disk IO: Documents/Panvas/<ws>/.panvas/)      │
│       └── WriteQueue (Serialized JSON File Writer)                          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ ContextBridge (IPC Invocation Bridge)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         PRELOAD SCRIPT [electron/preload.ts]                │
│  Exposes window.panvas namespace safely to Renderer process                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ window.panvas
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         REACT RENDERER PROCESS                              │
│  [src/main.tsx -> src/app/App.tsx]                                          │
│   ├── Component Layer (AppShell, Sidebar, TopBar, NotebookRenderer)        │
│   ├── Repository Layer (WorkspaceRepository, NotebookRepository, etc.)      │
│   ├── State Layer (Zustand Stores: workspaceStore, canvasStore, etc.)        │
│   ├── 2D Ink Engine (NotebookEngine.ts, DrawingEngine.ts, SelectionEngine)   │
│   └── IndexedDB Layer (Dexie.js schema.ts, canvasDB.ts for PDF/Images)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Process Separation & IPC Contract

### 2.1 Main Process (`electron/main.ts`)
* Configures `BrowserWindow` with transparent titlebar overlay (`titleBarOverlay`), auto-hidden native menu bar, and `preload.mjs` entry.
* Invokes `registerDomainHandlers()` from [`electron/ipc/domain-handlers.ts`](../../electron/ipc/domain-handlers.ts).

### 2.2 Preload Script (`electron/preload.ts`)
Exposes `window.panvas` into the Renderer main world using `contextBridge.exposeInMainWorld`.
It also locks zoom levels (`webFrame.setZoomLevel(0)`) to prevent accidental full-window UI scaling when zooming on page surfaces.

Key exposed API groups on `window.panvas`:
* `workspace`: `create`, `open`, `openDialog`, `getAll`, `update`, `reorder`
* `folder`: `create`, `update`, `delete`, `getAll`
* `canvasFile`: `create`, `update`, `delete`, `getAll`
* `canvas`: `save`, `load`
* `notebook`: `create`, `update`, `delete`, `getAll`, `savePage`, `loadPage`, `saveDrawing`, `loadDrawing`
* `notebookSection`: `create`, `update`, `delete`, `getAll`
* `notebookPage`: `create`, `update`, `delete`, `getAll`
* `settings`: `get`, `set`, `setTheme`
* `migration`: `importWorkspace`

---

## 3. Storage Architecture

### 3.1 Filesystem Persistence (Primary in Electron Mode)
Location: `%USERPROFILE%/Documents/Panvas/<WorkspaceName>/`

Inside each workspace directory:
```
<WorkspaceName>/
└── .panvas/
    ├── workspace.json          # Complete JSON registry for folders, notebooks, sections, pages
    ├── canvases/               # Canvas JSON files (<canvasId>.json)
    └── notebooks/
        └── <notebookId>/
            └── pages/
                ├── <pageId>.json        # Page metadata & rich text content
                └── <pageId>.drawing.json# Serialized vector stroke drawing data
```

#### Serialized Write Queue (`electron/ipc/write-queue.ts`)
To prevent corrupting `workspace.json` or page JSON files when multiple user interactions happen in quick succession, all disk writes pass through an async task queue (`WriteQueue`) ensuring sequential, atomic file writing.

### 3.2 IndexedDB / Dexie Storage (Secondary / Binary Layer)
Defined in [`src/database/schema.ts`](../../src/database/schema.ts).
Dexie database name: `panvas`

Tables:
* `workspaces`, `folders`, `canvasFiles`, `canvasData`, `customBlocks`
* `notebooks`, `notebookSections`, `notebookPages`
* `pdfFiles`: `id, canvasFileId, fileName, data (ArrayBuffer), createdAt, userId`
* `imageFiles`: `id, canvasFileId, fileName, data (ArrayBuffer), mimeType, createdAt, userId`
* `syncQueue`: Sync metadata items

> [!NOTE]
> PDF binaries (`pdfFiles`) and large embedded canvas images (`imageFiles`) are stored inside IndexedDB tables (`db.pdfFiles`), while workspace structural schemas are synchronized to filesystem `workspace.json` in Electron mode.

### 3.3 Dexie to Filesystem Migration (`src/lib/migration.ts`)
On initial launch in Electron mode, `migrateFromDexieToFs()` checks if IndexedDB data exists. If found, it reads all Dexie records and invokes `window.panvas.migration.importWorkspace(...)` to write them to native `.panvas/` disk structures idempotently.

---

## 4. Repository Layer Design Pattern

All data access from React components and Zustand stores goes through the Repository abstraction:

```
UI Component / Zustand Store
            │
            ▼
   Repository Layer (e.g. NotebookRepository.ts)
            │
      ┌─────┴────────────────────────┐
      │ Window.panvas exists?        │
      ├──────────────┬───────────────┤
      │ YES (Electron│ NO (Web / Dev)│
      ▼              ▼               ▼
 IPC Handlers    Dexie IndexedDB Database
(DomainHandlers)  (notebookDB.ts, workspaceDB.ts)
```

File locations:
* [`src/repositories/WorkspaceRepository.ts`](../../src/repositories/WorkspaceRepository.ts)
* [`src/repositories/NotebookRepository.ts`](../../src/repositories/NotebookRepository.ts)
* [`src/repositories/CanvasRepository.ts`](../../src/repositories/CanvasRepository.ts)
* [`src/repositories/FolderRepository.ts`](../../src/repositories/FolderRepository.ts)
* [`src/repositories/SettingsRepository.ts`](../../src/repositories/SettingsRepository.ts)

---

## 5. Main Component Subsystem Hierarchy

1. **`AppShell.tsx`**: Top-level wrapper managing theme attributes (`data-theme`), sidebar state, and main content routing.
2. **`WorkspaceContent.tsx`**: Active workspace view switcher. Routes between:
   * `PdfWorkspace` (if active page is `type === 'pdf'`)
   * `NotebookRenderer` (if active page is standard notebook page)
   * `CanvasWorkspace` / `CanvasView` (if active canvas item is selected)
   * `WorkspaceExplorerPreview` (if workspace root is active)
3. **`NotebookRenderer.tsx`**: Core notebook page engine layout with fixed floating toolbars, pinned right page properties inspector, and native scroll container `.notebook-viewport`.
