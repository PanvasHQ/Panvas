# Toolbar and UI System

The Notebook interface relies heavily on floating, context-aware toolbars rather than fixed menus.

## Primary Toolbars

### `src/components/notebook/NotebookFloatingToolbar.tsx`
The main drawing toolbar located at the top center of the canvas.
- Connects directly to the `NotebookEngine.tools` manager.
- Controls the active tool mode (`hand`, `select`, `pen`, `highlighter`, `eraser`, `shape`, `text`, `image`).
- **Interaction**: Clicking a tool sets `engine.tools.setMode('tool')`. The `InputManager` immediately listens to this mode to determine how to process mouse events.
- **Image Tool**: Contains a hidden file input. Clicking it triggers an OS file picker, reads the file, and pushes an `ImageObject` to the canvas.

### `src/components/notebook/NotebookToolPropertiesPanel.tsx`
A context-sensitive panel that appears next to the main toolbar or near the selected object.
- If `pen` is active, it shows stroke thickness and color swatches.
- If `shape` is active, it shows border width and fill color.
- If an object is selected via `select`, it shows properties specific to that object (e.g., text alignment).

## Tool State Architecture

The UI does not rely on React State (`useState`) for tracking the active tool. It reads directly from the engine to ensure perfect sync between the DOM and the WebGL canvas.

- **`ToolManager.ts`**: Holds the source of truth for the active tool mode, stroke color, and thickness.
- **Synchronization**: `NotebookFloatingToolbar` uses a custom event listener or periodic polling (via `useSyncExternalStore` or similar patterns) to highlight the active button based on `engine.tools.getMode()`.

## UI Overlays

### `CommandPalette.tsx`
Triggered via `Ctrl+K`. It allows users to search across their entire workspace hierarchy (Notebooks, Pages) by querying the `workspaceStore` and executing a navigation jump without touching the mouse.

### `ContextMenu.tsx`
Captures right-click events (`onContextMenu`) on the canvas or sidebar items to show a custom styled context menu for actions like Rename, Duplicate, or Delete.
