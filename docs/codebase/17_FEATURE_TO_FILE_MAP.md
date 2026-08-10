# Feature to File Map

Use this matrix to locate the primary entry points and supporting files for major application features.

| Feature | Primary Files | Supporting Files | Entry Point | Persistence |
|---|---|---|---|---|
| **Workspace Navigation** | `WorkspaceTree.tsx` | `WorkspaceContent.tsx`, `workspaceStore.ts` | `AppShell.tsx` | `WorkspaceRepository.ts` |
| **Canvas Rendering** | `NotebookRenderer.tsx` | `NotebookEngine.ts`, `DrawingEngine.ts` | `WorkspaceContent.tsx` | `NotebookRepository.ts` |
| **Handwritten Drawing** | `InputManager.ts` | `DrawingEngine.ts`, `drawingTypes.ts` | `NotebookRenderer.tsx` | `NotebookRepository.ts` |
| **Erasing** | `EraserEngine.ts` | `InputManager.ts`, `HistoryManager.ts` | `NotebookRenderer.tsx` | `NotebookRepository.ts` |
| **Text Editing** | `FloatingTextEditor.tsx` | `TextManager.ts`, `SlashMenuExtension.ts` | `NotebookRenderer.tsx` | `NotebookRepository.ts` |
| **Image Import** | `ImageManager.ts` | `NotebookFloatingToolbar.tsx`, `NotebookRenderer.tsx` | `NotebookFloatingToolbar.tsx` | `CanvasRepository.ts` (Blobs) |
| **Selection / Moving** | `SelectionEngine.ts` | `InputManager.ts` | `NotebookRenderer.tsx` | `NotebookRepository.ts` |
| **PDF Viewer** | `PdfWorkspace.tsx` | `PdfAnnotationSidebar.tsx`, `PdfThumbnailSidebar.tsx` | `WorkspaceContent.tsx` | `WorkspaceRepository.ts` |
| **Cloud Sync** | `SyncEngine.ts` | `SyncScheduler.ts`, `syncStore.ts` | `App.tsx` | Supabase API |
| **Authentication** | `LoginPage.tsx` | `AuthGuard.tsx`, `authStore.ts` | `App.tsx` | Supabase GoTrue |
| **Settings** | `SettingsLayout.tsx` | `AppearanceSection.tsx`, `notebookSettingsStore.ts` | `App.tsx` | `SettingsRepository.ts` |
| **Native File Saves** | `WorkspaceService.ts` (IPC) | `write-queue.ts`, `domain-handlers.ts` | `NotebookRepository.ts` | Local File System |
