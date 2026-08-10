# 06 — Canvas System (06_CANVAS_SYSTEM.md)

## 1. Subsystem Architecture Overview

The **Canvas System** is Panvas's freeform infinite workspace for unstructured brainstorming, visual diagramming, and multi-block composition. It operates as a distinct workspace mode separate from the structured multi-page Notebook System.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CANVAS WORKSPACE SHELL                            │
│  [WorkspaceContent.tsx] -> [CanvasWorkspace.tsx]                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Canvas Toolbar [CanvasToolbar.tsx] & Floating Controls                │
├─────────────────────────────────────────────────────────────────────────┤
│  Excalidraw Core Viewport [CanvasView.tsx]                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Excalidraw Canvas (Shapes, Freehand Ink, Connectors)              │  │
│  │                                                                   │  │
│  │ Custom Panvas Overlay Blocks:                                     │  │
│  │  ├── LaTeX Formula Block [LatexBlock.tsx]                         │  │
│  │  ├── Markdown Text Block [MarkdownBlock.tsx]                       │  │
│  │  ├── Embedded PDF Block [PdfBlock.tsx]                             │  │
│  │  └── Welcome / Starter Template [WelcomeScreen.tsx]               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown & Locations

| Component | Path | Primary Responsibility |
|---|---|---|
| **`CanvasWorkspace.tsx`** | `src/components/canvas/CanvasWorkspace.tsx` | Main outer wrapper for active canvas files. Handles save triggers and canvas toolbar positioning. |
| **`CanvasView.tsx`** | `src/components/canvas/CanvasView.tsx` | Embeds `@excalidraw/excalidraw` core component, syncs elements state, and renders custom block overlays. |
| **`CanvasToolbar.tsx`** | `src/components/canvas/CanvasToolbar.tsx` | Tool selection bar for switching between select, hand pan, shape tools, and adding custom blocks. |
| **`CanvasFloatingToolbar.tsx`** | `src/components/canvas/CanvasFloatingToolbar.tsx` | Quick action floating bar for selected canvas elements. |
| **`LatexBlock.tsx`** | `src/components/canvas/LatexBlock.tsx` | Interactive math formula block powered by KaTeX rendering. |
| **`MarkdownBlock.tsx`** | `src/components/canvas/MarkdownBlock.tsx` | Rich markdown note block with code syntax highlighting and GFM support. |
| **`PdfBlock.tsx`** | `src/components/canvas/PdfBlock.tsx` | Embedded interactive PDF card on canvas with page navigation controls. |
| **`WelcomeScreen.tsx`** | `src/components/canvas/WelcomeScreen.tsx` | Default onboarding canvas template for new workspaces. |

---

## 3. Implementation Status Matrix

| Feature | Status | Implementation Summary |
|---|---|---|
| **Excalidraw Engine** | **DONE** | Vector shapes (rectangles, diamonds, ellipses, lines, arrows, freehand) fully functional. |
| **Infinite Pan & Zoom** | **DONE** | Full viewport movement, pinch zoom, wheel pan powered by Excalidraw view state. |
| **LaTeX Block** | **DONE** | Render LaTeX math expressions inline using KaTeX (`katex`). Editable via modal popup. |
| **Markdown Block** | **DONE** | Renders GitHub-flavored Markdown notes with `react-markdown`, `remark-gfm`, `rehype-katex`, and syntax highlighting. |
| **PDF Block on Canvas** | **DONE** | Loads PDF ArrayBuffer from IndexedDB (`canvasRepository.getPdf`), renders pages via PDF.js worker into `<canvas>`. |
| **Canvas Local Persistence** | **DONE** | Saves elements, appState, and customBlocks array to `.panvas/canvases/<canvasId>.json` via IPC (or `canvasData` in Dexie). |
| **Undo / Redo** | **DONE** | Native Excalidraw history stack. |
| **Export to Image / PNG** | **PARTIAL** | Basic canvas snapshot capability via Excalidraw export helpers; export dialog UI partially hooked up. |

---

## 4. Canvas Data Model & Persistence Flow

Canvas state consists of:
1. `elements`: Array of Excalidraw element objects (shapes, strokes, arrows).
2. `appState`: Viewport state (zoom, scrollX, scrollY, viewBackgroundColor).
3. `customBlocks`: Custom Panvas blocks array:

```typescript
export interface CustomBlock {
  id: string;
  canvasFileId: string;
  type: 'markdown' | 'latex' | 'pdf' | 'image' | 'code';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}
```

### Save Lifecycle:
1. `CanvasView.tsx` detects changes in elements or custom blocks.
2. Changes trigger debounced `saveCanvasData` call in `canvasStore.ts`.
3. `CanvasRepository.saveCanvasData(...)` invokes IPC handler `canvas:save`.
4. Electron main process serializes data to `.panvas/canvases/<canvasId>.json` via `writeQueue`.
