# Persistence Flow

Panvas employs a robust persistence pipeline to ensure data drawn on the canvas is saved immediately to the local disk without dropping frames.

## 1. Action Trigger
Any interaction on the canvas that modifies state triggers a save.
- Hand-drawing a stroke (`InputManager.ts` on `pointerup`).
- Erasing a line.
- Changing properties via `NotebookFloatingToolbar.tsx` or `NotebookToolPropertiesPanel.tsx`.
- Importing an image via Drag & Drop (`NotebookRenderer.tsx`).

## 2. Extraction from Engine
When a change is detected (often via a debounced autosave callback in `NotebookRenderer.tsx` or explicitly on action), the UI layer calls:
```typescript
const data = engine.getDrawingData();
```
This forces the `NotebookEngine` to serialize the current `Stroke`s, `Shape`s, `Image`s, and `Text` objects into a plain JSON `DrawingData` object.

## 3. Repository Layer
The UI calls:
```typescript
notebookRepository.saveDrawingData(workspaceId, notebookId, pageId, data);
```
The `NotebookRepository` is the abstraction layer. It checks the environment:
- **If in Electron**: It calls `window.electron.ipcRenderer.invoke('workspace:save-page', { ... })`.
- **If in Browser**: It falls back to saving to Dexie (IndexedDB).

## 4. Electron IPC (Native)
In the native environment, the IPC call routes to `domain-handlers.ts`, which proxies the request to `WorkspaceService.ts`.

## 5. Atomic File System Write
To prevent corruption (especially from Cloud Sync folders like OneDrive), `WorkspaceService.ts` passes the JSON string to `writeQueue.enqueue(targetPath, jsonData)`.

`writeQueue` handles the file write sequentially and atomically:
1. It writes the JSON to `page-xyz.drawing.json.tmp`.
2. It calls `fsPromises.rename()` to overwrite the active `.json` file.
3. If OneDrive locks the file and throws `EPERM`/`EBUSY`, it retries every 100ms up to 5 times.

## 6. Background Sync (Optional)
If the user has linked a cloud account, a background `SyncScheduler.ts` detects that the local `updatedAt` timestamp is newer than the remote. It wakes up the `SyncEngine.ts` to push the delta to Supabase, completely decoupled from the local save loop.
