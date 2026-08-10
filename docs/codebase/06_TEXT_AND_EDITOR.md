# Text & Editor System

Panvas integrates rich text editing directly onto the infinite canvas using Tiptap (a headless wrapper around ProseMirror).

## Architecture

Because standard `<canvas>` cannot easily render complex rich text with selections, formatting, and cursors, Panvas uses **Floating React Components** placed precisely over the native WebGL/Canvas layer.

### `src/components/notebook/FloatingTextEditor.tsx`
- **Tiptap Integration**: Initializes a `useEditor` hook for each individual text block on the page.
- **Extensions**: Includes standard formatting (bold, italic, underline), task lists, highlights, custom fonts, and a custom `SlashMenuExtension` (for Notion-like `/` commands).
- **Positioning**: Uses CSS `transform: translate(x, y) scale(z)` governed by the `ViewportManager` to ensure the DOM text perfectly aligns and scales with the underlying zoom/pan state of the canvas.
- **Lifecycle**:
  - Unregisters itself if empty on blur.
  - Pushes edits into the `NotebookEngine.texts` manager.

### `src/components/notebook/engine/TextManager.ts`
- Holds the in-memory array of `TextObject`s.
- Maintains a registry mapping object IDs to their active Tiptap `Editor` instances.
- Allows the native `InputManager` to query text boundaries or force focus on a specific editor using custom DOM events (`panvas:focus-text`).

## Flow: Creating a Text Block
1. User selects the `text` tool from the toolbar.
2. User clicks on the canvas. `InputManager` captures the exact logical `(x, y)` coordinates.
3. `InputManager` creates a new `TextObject` with an empty Tiptap JSON schema.
4. `TextManager` adds the object to its internal state.
5. `NotebookRenderer` re-renders, looping over `engine.texts.getTexts()` and mounting a new `<FloatingTextEditor>`.
6. `FloatingTextEditor` mounts, initializes Tiptap, and listens for the `panvas:focus-text` event which the `InputManager` immediately dispatches to set the cursor.
7. As the user types, `onUpdate` triggers, updating the underlying `TextObject.content` JSON and notifying `useAutosave`.
