# Drawing Engine

The rendering pipeline in Panvas is decoupled from React to maximize performance on the infinite canvas. The core orchestrator is `NotebookEngine.ts`.

## `NotebookEngine.ts`
The single source of truth for an active canvas page. It instantiates and manages the sub-engines:
- `DrawingEngine`
- `EraserEngine`
- `SelectionEngine`
- `ViewportManager`
- `HistoryManager`
- Managers for Shapes, Texts, and Images.

It exposes `.getDrawingData()` and `.setDrawingData()` to serialize/deserialize the canvas to/from the `NotebookRepository`.
**Lifecycle hooks**:
- `mount()` / `unmount()`: Binds and unbinds the input event listeners to the active canvas. A zoom change may trigger a React re-mount of the canvas, which calls `unmount()` safely without destroying the engine's internal data cache.
- `destroy()`: A hard cleanup called only when the page is actually closed, which flushes caches and destroys image object URLs to prevent memory leaks.

## `DrawingEngine.ts`
Responsible for the actual rendering to the HTML `<canvas>` element using the 2D Context API.

- **`redraw()`**: The core render loop. Clears the canvas, computes the viewport transform (translation/scale), and renders:
  - Background (paper color, templates like grids/lines).
  - Images (via `ImageManager`).
  - Shapes (via `ShapeManager`).
  - Strokes (via the internal `renderStrokes` loop, drawing bezier curves for smooth ink).
  - Selection boxes (via `SelectionEngine`).
- **Optimization**: Computes bounding boxes and culls objects outside the current viewport.

## `InputManager.ts`
Translates raw DOM `PointerEvent`s into logical actions based on the `ToolManager`'s active tool (`pen`, `highlighter`, `eraser`, `shape`, `hand`, `select`, `text`).

- **Drawing**: On pointerdown with `pen`, it initiates a new `Stroke`, records `StrokePoint`s on pointermove, and pushes the final stroke to `HistoryManager` on pointerup.
- **Erasing**: Invokes `EraserEngine` to perform polygon collision detection and slice/delete strokes.
- **Panning**: With the `hand` tool, manipulates `ViewportManager.pan()`.

## Flow: Handwritten Drawing
1. `InputManager` receives `pointerdown` (Tool: Pen).
2. It creates a new `Stroke` object in memory and stores it as the "current" stroke.
3. On `pointermove`, new `StrokePoint`s (x, y, pressure) are appended to the current stroke.
4. `InputManager` immediately calls `engine.drawing.redraw()` on every animation frame/pointer move.
5. `DrawingEngine.redraw()` iterates over all existing strokes + the live stroke, mapping point coordinates to spline curves, scaling them by `viewport.scale`, and calling `ctx.stroke()`.
6. On `pointerup`, the stroke is finalized, pushed to the active object array, and `history.pushExecuted()` is called for Undo/Redo support.
7. The `InputManager` fires `notifyChange()`, which triggers `useAutosave` to persist the new state to disk.
