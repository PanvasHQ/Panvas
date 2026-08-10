# Database Storage

Panvas uses a Local-First storage architecture. The application is completely functional offline and treats the local file system (or local IndexedDB) as the source of truth, syncing to the cloud only as a background task.

## Storage Strategies

Because Panvas runs both as an Electron Desktop App and a standard web app (in browsers), it abstracts storage through the `src/repositories/` layer.

### 1. Electron Native FS (Desktop)
When `window.electron` is available, all storage requests are routed through IPC (Inter-Process Communication).
- Workspaces and Notebook data are saved natively as `.json` and `.drawing.json` files on the user's hard drive.
- This provides users with total control over their data, native backup capabilities, and atomic writes to prevent corruption from OneDrive/Dropbox.

### 2. IndexedDB (Web / Fallback)
When running in a browser, Panvas falls back to IndexedDB via the Dexie.js wrapper.
- **`src/database/schema.ts`**: Defines the `PanvasDB` class, which holds tables for `workspaces`, `notebooks`, `notebookPages`, and the raw `canvasData`.
- Includes database migration logic (`this.version(X).upgrade()`) to handle schema changes gracefully.
- Allows the app to function as an offline PWA.

## Database Schema (Dexie)
Key tables defined in IndexedDB:
- `workspaces`: The root collections.
- `notebooks`: Groups of pages.
- `notebookPages`: Individual documents.
- `canvasData`: The massive JSON blobs representing the drawing content. (Stored separately from `notebookPages` so the workspace tree can load instantly without parsing megabytes of stroke data).
- `imageFiles` / `pdfFiles`: Binary blobs (ArrayBuffers) stored locally to prevent memory leaks in the browser.

## Repositories (`src/repositories/`)
- `WorkspaceRepository`: Handles CRUD for Workspaces, Notebooks, and Sections.
- `NotebookRepository`: Handles CRUD for Pages and their `DrawingData`.
- These classes check `if (window.electron)` and fork the logic either to `ipcRenderer.invoke` or `dexie`.
