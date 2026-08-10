# Known Issues

This document lists explicitly observable limitations, deferred features, and potential bugs identifiable directly from the current codebase state.

## 1. Mocked PDF Viewer
- **Location**: `src/components/pdf/PdfWorkspace.tsx`
- **Issue**: The PDF workspace is purely presentational. The component `PdfPaperMock` explicitly states: *"Actual PDF rendering will be implemented in a future phase."* Real PDF parsing (e.g., Mozilla `pdf.js`) is not yet wired into the canvas.

## 2. Atomic Write Failures (EPERM / EBUSY)
- **Location**: `electron/ipc/write-queue.ts`
- **Issue**: The `atomicWrite` function performs a raw `fsPromises.rename(tempPath, targetPath)`. If the target directory is managed by a cloud sync engine like OneDrive, the engine often places an exclusive lock on the file for a few milliseconds to upload it. If the `rename` occurs during this lock, it throws an `EPERM: operation not permitted` error, which crashes the save queue.
- **Note**: A retry mechanism with exponential backoff is required but currently missing from the implementation.

## 3. Unhandled Empty Text Nodes
- **Location**: `src/components/notebook/FloatingTextEditor.tsx`
- **Issue**: There is logic to auto-remove empty text boxes on blur to prevent ghost placeholders. However, because this logic triggers React state changes from within a Tiptap blur event, it relies on a `setTimeout(() => {}, 0)` hack to avoid React render cycle conflicts. This could lead to race conditions if the engine destroys the object before the timeout executes.
