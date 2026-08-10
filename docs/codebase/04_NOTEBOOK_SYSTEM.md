# Notebook System

Panvas organizes data hierarchically into Notebooks, Sections, and Pages. 

## Hierarchy

1. **Workspace**: The root container for a user's data (e.g., "My Workspace").
2. **Notebook**: A collection of sections (e.g., "Math 101"). Can be grouped into logical Folders.
3. **Section**: A divider within a notebook (e.g., "Chapter 1").
4. **Page**: The actual infinite canvas or document (e.g., "Lecture 1 Notes").

## Key Components

### `src/components/workspace/WorkspaceTree.tsx`
Renders the hierarchical view in the left sidebar. It fetches the loaded Workspaces, Notebooks, and Sections from `workspaceStore`, and allows expanding/collapsing, dragging to reorder, and clicking to open a Page.

### `src/components/notebook/NotebookRenderer.tsx`
When a Page is active, this component mounts. It is responsible for:
- Initializing the `NotebookEngine`.
- Passing the canvas `ref` to the engine so it can attach WebGL/2D contexts.
- Rendering the static `PageRenderer.tsx` (the white paper background).
- Overlaying floating React components (Text editors, Image blocks) on top of the native canvas layer by computing their absolute `x, y` positions based on the `ViewportManager`'s current zoom and pan.
- Handling HTML5 Drag & Drop (`handleDrop`) to import files directly onto the canvas.

## Flow: Opening a Page

1. User clicks a Page in `WorkspaceTree.tsx`.
2. `workspaceStore.setActivePageId(page.id)` is called.
3. `AppShell` -> `WorkspaceContent` detects the active page type. If it's a default notebook page, it renders `NotebookRenderer`.
4. `NotebookRenderer` mounts and calls `engine.mount(canvasRef)`.
5. `NotebookRenderer` uses `notebookRepository.loadDrawingData()` to fetch the `.drawing.json` from disk (via `window.electron.ipcRenderer.invoke('workspace:read-page')`).
6. The data is passed to `engine.setDrawingData(data)`, which repopulates strokes, shapes, and images.
7. `engine.drawing.redraw()` is triggered to render the canvas.
