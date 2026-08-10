# Image System

Panvas supports placing, selecting, and transforming native images on the infinite canvas.

## Architecture

Images in Panvas exist natively on the WebGL/2D canvas layer, meaning they scale perfectly with handwritten strokes and shapes, unlike floating React text boxes.

### `src/components/notebook/engine/ImageManager.ts`
Manages the lifecycle of images on the canvas.
- Maintains an array of `ImageObject` models (`id`, `x`, `y`, `width`, `height`, `fileId`, `rotation`).
- Implements an internal `imageCache: Map<string, HTMLImageElement>` to keep the decoded image in memory for instantaneous 60fps rendering.
- **`renderImages(ctx)`**: Iterates over `this.images`, retrieves the cached `HTMLImageElement`, applies `ctx.translate` and `ctx.rotate` based on the object's properties, and calls `ctx.drawImage()`.

### Loading & Caching
Because images are stored separately from the lightweight `.drawing.json` (to prevent massive JSON blobs), they must be loaded asynchronously:
1. `ImageManager.setImages()` or `addImage()` is called.
2. It invokes `preloadImage(fileId)`, which queries `canvasRepository.getImage(fileId)`.
3. It creates a local `Blob` and an `Object URL`, loads it into a standard `new Image()`, and puts it in `imageCache`.
4. Once loaded, it triggers `this.redrawCallback()` to force the `DrawingEngine` to paint the image.

## Flow: Image Insertion

1. **Toolbar Button (`NotebookFloatingToolbar.tsx`)**: User clicks the Image tool. A hidden `<input type="file" />` is triggered.
2. **File Selection**: User selects a `.png`/`.jpg`.
3. **Storage**: The file is read via `FileReader` as an `ArrayBuffer` and sent to `canvasRepository.saveImage(file, fileId)`.
4. **ImageObject Creation**: An `ImageObject` is created with calculated coordinates (centered on the current viewport or at the drop location).
5. **NotebookEngine Integration**: The `ImageObject` is pushed via `engine.images.addImage(newImg)`.
6. **Selection/Render**: The engine caches the image. Once loaded, the engine repaints. `NotebookFloatingToolbar` optionally switches to the `select` tool and selects the newly inserted image.
7. **Persistence**: `useAutosave` detects the updated JSON state and writes it to disk.

*(This exact flow applies to HTML5 Drag & Drop via `NotebookRenderer.tsx`'s `handleDrop` event).*
