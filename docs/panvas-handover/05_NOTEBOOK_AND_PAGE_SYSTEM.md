# 05 — Notebook System (05_NOTEBOOK_SYSTEM.md)

## 1. Subsystem Architecture Overview

The Notebook System is the core document writing, drawing, and annotation environment in Panvas. It mimics a physical notebook experience with digital vector capabilities.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NOTEBOOK SHELL                                    │
│  [WorkspaceContent.tsx] -> [NotebookRenderer.tsx]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Top Floating Toolbar   [NotebookFloatingToolbar.tsx]                       │
│  Right Properties Panel [NotebookToolPropertiesPanel.tsx]                   │
│  Page Sorter / Navigator[NotebookNavigator.tsx]                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Native Scroll Viewport [.notebook-viewport]                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Page Container                                                        │  │
│  │ ┌───────────────────────────────────────────────────────────────────┐ │  │
│  │ │ Page Shell [PageRenderer.tsx]                                    │ │  │
│  │ │  ├── Paper Template Overlay (Ruled / Grid / Dotted / Cornell)     │ │  │
│  │ │  ├── Rich Text Surface [FloatingTextEditor.tsx] (TipTap)          │ │  │
│  │ │  └── HTML5 Vector Drawing Canvas Overlay (NotebookEngine)        │ │  │
│  │ └───────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Feature Implementation Status Matrix

| Feature | Status | Location / Component | Functional Summary |
|---|---|---|---|
| **Notebook Hierarchy** | **DONE** | `workspaceStore.ts`, `NotebookRepository.ts` | Workspace → Notebook → Section → Page hierarchy completely stored & rendered. |
| **Page Properties** | **DONE** | `NotebookToolPropertiesPanel.tsx` | Controls paper color, size, background format, orientation, margins, zoom. |
| **Apply To All Pages** | **DONE** | `NotebookToolPropertiesPanel.tsx` | Updates paper settings across all section/notebook pages simultaneously. |
| **Paper Templates** | **DONE** | `PageRenderer.tsx`, `TemplateRegistry.ts` | Render SVG/Canvas patterns for Blank, Ruled, Grid, Dots, Graph, Cornell. |
| **Viewport Scroll Modes** | **DONE** | `NotebookRenderer.tsx`, `layoutStore.ts` | Native CSS scroll containment (`.notebook-viewport`) for Vertical, Horizontal, 2-Page Horizontal. Pinned UI toolbars. |
| **Page Sorter & Management**| **DONE** | `NotebookNavigator.tsx` | Thumbnail grid, multi-select, drag reorder, duplicate, delete, insert before/after. |
| **Page Numbering** | **DONE** | `NotebookRenderer.tsx` | Dynamic display (`Page X of Y`). Updates automatically on add/delete/reorder. |
| **Vector Pen Tool** | **DONE** | `DrawingEngine.ts`, `InputManager.ts` | Smooth pressure-sensitive bezier curve pen rendering. |
| **Vector Pencil Tool** | **DONE** | `DrawingEngine.ts` | Textured graphite pencil stroke simulation. |
| **Highlighter Tool** | **DONE** | `DrawingEngine.ts` | Semi-transparent overlay ink blending mode. |
| **Stroke Eraser** | **DONE** | `EraserEngine.ts` | Removes entire stroke paths upon pointer intersection. |
| **Area Eraser** | **DONE** | `EraserEngine.ts` | Erases localized pixel/point segments of strokes. |
| **Lasso & Object Selection**| **DONE** | `SelectionEngine.ts` | Selects handwriting strokes, images, and text. Move, resize, recolor, change width. |
| **Undo / Redo** | **DONE** | `HistoryManager.ts` | Full stroke state history queue for ink drawing. |
| **Rich Text System** | **DONE** | `FloatingTextEditor.tsx` | TipTap ProseMirror integration with typography, lists, tasks, colors, handwriting fonts. |
| **Handwriting Fonts** | **DONE** | `FontSizeExtension.ts`, `FloatingTextEditor.tsx` | Selection of casual, cursive, and handwriting typeface options. |
| **Context Menus** | **DONE** | `NotebookContextMenu.tsx` | Right-click page options (Copy, Paste, Delete, Duplicate, Export). |

---

## 3. Native Viewport & Scroll System

### 3.1 Pinned Architecture Rule
The document layout isolates scroll events exclusively to `.notebook-viewport`. The top navigation bar (`TopBar`), left sidebar (`Sidebar`), top floating pen toolbar (`NotebookFloatingToolbar`), and right inspector panel (`NotebookToolPropertiesPanel`) remain **fixed and stationary** at all times.

### 3.2 Layout Modes in `NotebookRenderer.tsx`
* **Vertical Mode**:
  * CSS: `overflow-y: auto; overflow-x: hidden;`
  * Page layout: Pages stacked in flex column (`flex-col items-center gap-8 py-8`).
* **Horizontal Mode**:
  * CSS: `overflow-x: auto; overflow-y: hidden;`
  * Page layout: Pages lined up horizontally (`flex-row items-center gap-8 px-8`).
* **2-Page Horizontal Mode**:
  * CSS: `overflow-x: auto; overflow-y: hidden;`
  * Page layout: Pages rendered in side-by-side page pairs (`flex-row items-center gap-12 px-8`).

---

## 4. 2D Ink & Drawing Engine (`src/components/notebook/engine/`)

The drawing engine (`NotebookEngine.ts`) manages vector pen strokes on HTML5 `<canvas>` elements overlaying each page.

### 4.1 Engine Architecture Modules
* **`NotebookEngine.ts`**: Central facade orchestrating drawing, selection, input, history, viewport, and tool managers.
* **`InputManager.ts`**: Captures `pointerdown`, `pointermove`, `pointerup` events, pressure data, and multi-touch gestures.
* **`DrawingEngine.ts`**: Performs Catmull-Rom spline interpolation and quadratic curve smoothing for smooth ink paths.
* **`EraserEngine.ts`**:
  * *Stroke Eraser*: Evaluates point-to-segment distance algorithms to delete whole stroke objects when touched.
  * *Area Eraser*: Cuts stroke paths into smaller sub-paths at eraser intersection boundaries.
* **`SelectionEngine.ts`**: Implements bounding-box and polygon lasso collision checking against vector strokes. Draws transform handles (resize/rotate) and executes stroke transformations.
* **`HistoryManager.ts`**: Manages undo/redo stacks (`pushState`, `undo`, `redo`).
* **`ImageManager.ts`**: Manages inline image objects embedded into page canvases.

---

## 5. Rich Text & TipTap System (`FloatingTextEditor.tsx`)

Typed text is handled independently from ink strokes by TipTap (`@tiptap/react`).
* **Storage**: Content is serialized as HTML / JSON into `page.content` inside `<pageId>.json`.
* **Handwriting-style Fonts**: Custom font-family extensions allow typed text to render in handwriting typefaces (e.g. *Caveat*, *Architects Daughter*, *Kalam*), giving typed notes a handwritten visual appearance while preserving searchability and text editing capabilities.
