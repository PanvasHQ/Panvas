# Data Models

This document outlines the core TypeScript interfaces that define Panvas data structures.

## Workspace Models (`src/types/workspace.ts`)

- `Workspace`: Represents a collection of notebooks for a specific user.
- `Folder`: Optional grouping construct within a workspace.

## Notebook Models (`src/types/notebook.ts`)

- `Notebook`: Represents a single notebook (`id`, `workspaceId`, `name`).
- `NotebookSection`: Represents a logical divider within a notebook (`id`, `notebookId`, `name`).
- `NotebookPage`: Represents a single page document (`id`, `notebookId`, `sectionId`, `title`). Includes `type` (default or pdf) and `pdfDataId`.

## Page Content Models (`src/components/notebook/engine/drawingTypes.ts`)

The raw content of a `NotebookPage` is represented as `DrawingData`.

- `DrawingData`: The serializable JSON structure saved to disk.
  - `version`: Number to track schema changes.
  - `objects`: Array of `NotebookObject` (Strokes, Shapes, Texts, Images).
  - `properties`: `PageProperties` for the background rendering.

### Objects

All objects extend `BasePageObject` which provides `id`, `type`, `x`, `y`, `width`, `height`, `createdAt`, and `metadata`.

- `Stroke`: Hand-drawn paths. Includes `tool` (pen, highlighter), `color`, `thickness`, and an array of `StrokePoint` (x, y, pressure, time).
- `Shape`: Vector primitives (rectangle, ellipse, arrow). Includes `shapeType`, `fill`, `rotation`.
- `TextObject`: Rich text floating blocks. The `content` is a Tiptap JSON document tree.
- `ImageObject`: Uploaded images. Uses `fileId` to map to raw image binaries in local storage.

### Page Properties
- `PageProperties`: Controls how the paper is rendered.
  - `template`: 'Blank', 'Dotted', 'Ruled', 'Grid', etc.
  - `paperColor`, `ruleLineColor`.
  - `orientation`, `pageSize`, `margins`.
