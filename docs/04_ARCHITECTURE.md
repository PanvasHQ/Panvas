# Architecture

## Runtime flow

`main.tsx` imports global CSS, initializes PostHog analytics, and renders `App` in `StrictMode`. `App` initializes auth, Dexie defaults, workspace/recent/trash state, and sync scheduling. Wouter chooses a route. `AppShell` surrounds authenticated work and preview routes. `WorkspaceContent` renders a notebook shell when a page is active; otherwise it renders the real Excalidraw canvas.

## Layers

1. **components/**: page features and shared layout/UI.
2. **stores/**: Zustand view/domain state and actions.
3. **repositories/**: thin domain interfaces (`CanvasRepository`, `WorkspaceRepository`, `FolderRepository`, `NotebookRepository`).
4. **database/**: Dexie schema and data-access functions.
5. **services/**: Supabase auth/client, sync engine/scheduler, storage metrics.
6. **types/**: workspace, canvas, notebook, and sync contracts.

Data flow is normally component → Zustand action → repository → Dexie. Canvas changes flow Excalidraw → `useAutosave` (1s debounce) → `canvasStore.saveCanvasData` → repository/Dexie and sync pending count. Sync consumes `syncQueue` only when Supabase is configured and a user is present.

## Domain model

- Workspace: name, timestamps, pin/sync/user/delete/system metadata.
- Folder: workspace ID, recursive parent ID, ordering and expanded state.
- CanvasFile and CanvasData: file metadata plus Excalidraw elements/app state/files; custom markdown/LaTex/PDF blocks are separate.
- Notebook → NotebookSection → NotebookPage: workspace/folder ownership and ordered hierarchy. Page content is **not** yet stored in the model.

## Routing caveat

Marketing mode (`VITE_MARKETING_ONLY=true`) routes `/app` to Coming Soon. In normal mode `/app` is auth guarded. Preview routes appear before those conditional routes and intentionally bypass normal workspace selection; they are visual review tools.
