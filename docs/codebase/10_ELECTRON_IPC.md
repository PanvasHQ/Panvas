# Electron IPC

When Panvas is packaged as a desktop application, it uses Electron's Inter-Process Communication (IPC) to bridge the secure Node.js backend (Main process) with the React frontend (Renderer process).

## Architecture

### 1. Preload Script (`electron/preload.ts`)
Electron security best practices dictate that `nodeIntegration` is disabled in the renderer. The `preload.ts` script uses `contextBridge` to expose a strictly typed `window.electron` object to the React frontend.
- Exposes `ipcRenderer.invoke(channel, ...args)` for request/response calls.
- Exposes `ipcRenderer.on(channel, callback)` for server-sent events.

### 2. Main Process Handlers (`electron/ipc/domain-handlers.ts`)
This file registers all the listener channels that the renderer can call. It acts as the routing controller for native actions.
Examples:
- `workspace:list`
- `workspace:read-page`
- `workspace:save-page`
- `workspace:save-image`

### 3. Native Services (`electron/ipc/WorkspaceService.ts`)
The actual implementation of the IPC handlers. Uses native Node.js `fs.promises` to read and write directly to the user's hard drive.
- Resolves file paths relative to the user's defined Workspace Directory (e.g., `Documents/Panvas/`).
- Handles creating `.panvas` notebooks (which are just directories containing `.drawing.json` files).

### 4. Atomic Write Queue (`electron/ipc/write-queue.ts`)
A critical component for data integrity.
- **Problem**: When Panvas saves a file (e.g., `page.drawing.json`), cloud sync engines (like OneDrive, Google Drive) often instantly lock the file to upload it. If Panvas tries to save again or rename over it, it throws an `EPERM` or `EBUSY` error, crashing the save and potentially corrupting the file.
- **Solution**: The `WriteQueue` class ensures only one write happens at a time. It uses an `atomicWrite` method that writes to a `.tmp` file first, then uses `fsPromises.rename()` with a retry loop and exponential backoff to safely swap the file into place once OneDrive releases the lock.
