# 01 — Project Overview (01_PROJECT_OVERVIEW.md)

## 1. Product Vision

**Panvas** is a local-first, desktop-first digital workspace for visual thinking, studying, writing, drawing, document annotation, and knowledge organization.

The product combines core concepts from leading note-taking and visual tools:
* **Samsung Notes / GoodNotes**: Structured notebook hierarchy (Workspace → Notebook → Section → Page), pen/pencil/highlighter ink rendering, A4 paper formats, page sorter, and PDF template overlays.
* **Microsoft OneNote**: Flexible section tab organization, rich text typing alongside handwritten ink, and deep note organization.
* **Excalidraw**: Infinite freeform canvas mode with shape drawing, hand-drawn aesthetic, LaTeX formula blocks, Markdown text blocks, and diagramming.
* **PDF Annotation Software**: High-fidelity PDF rendering using PDF.js, page-by-page annotation overlays, page thumbnails, and PDF attachment management.

Panvas is not a clone of any single tool; it is a unified workspace designed to run natively on the desktop with zero reliance on cloud connectivity for core tasks.

---

## 2. Core Value Proposition & Principles

1. **Local-First Architecture**:
   * All workspaces, notebooks, pages, canvas drawings, and imported PDFs are saved directly to the user's local disk (`%USERPROFILE%/Documents/Panvas/`).
   * The app operates completely offline. Cloud sync (via Supabase or future Microsoft Graph / OneDrive) is an optional secondary layer.

2. **Desktop-First & Stylus/Touch-Friendly**:
   * Custom native window chrome using Electron window framing.
   * Precise pressure-sensitive pen, pencil, and highlighter drawing algorithms using HTML5 Canvas 2D contexts.
   * Full keyboard navigation, global search, and command palette (`CTRL+K`).

3. **Hybrid Document & Freeform Canvas Model**:
   * **Notebook System**: Structured multi-page document model (A4, Letter, Custom sizes) with fixed paper layouts, margin guidelines, templates (Ruled, Grid, Dotted, Cornell), and pagination modes (Vertical, Horizontal, 2-Page Horizontal).
   * **Canvas System**: Freeform infinite canvas workspace powered by custom object models and Excalidraw integration for unstructured brainstorming.
   * **PDF Workspace System**: Specialized PDF document viewer and annotation suite.

---

## 3. High-Level User Workflows

```
┌────────────────────────────────────────────────────────────────────────┐
│                               PANVAS                                   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│   NOTEBOOK   │            │    CANVAS    │            │ PDF WORKSPACE│
├──────────────┤            ├──────────────┤            ├──────────────┤
│ - Workspaces │            │ - Infinite   │            │ - Import PDF │
│ - Notebooks  │            │   Canvas     │            │ - Page View  │
│ - Sections   │            │ - Excalidraw │            │ - Thumbnail  │
│ - Pages      │            │ - Custom     │            │   Sidebar    │
│ - Handwriting│            │   Blocks     │            │ - Ink        │
│   & Ink      │            │   (LaTeX/MD) │            │   Overlay    │
│ - Rich Text  │            │ - Shapes &   │            │ - Annotations│
│ - Templates  │            │   Diagrams   │            │              │
└──────────────┘            └──────────────┘            └──────────────┘
```

### Flow A: Notebook Creation & Hand Note-taking
1. User opens Panvas and selects or creates a **Workspace**.
2. Inside the Workspace, user creates a **Notebook** and adds a **Section**.
3. User adds a **Page** (selecting template, background color, paper size, and orientation).
4. User writes typed text using the TipTap rich-text toolbar or draws ink strokes using Pen, Pencil, Highlighter, or Eraser tools.
5. Content is automatically saved locally via Electron IPC to `.panvas/workspace.json`.

### Flow B: PDF Import & Annotation
1. User imports a PDF via drag-and-drop or file picker in the Sidebar or Notebook.
2. The raw PDF binary is stored in IndexedDB (`pdfFiles` table in Dexie), and a page entry of `type: 'pdf'` with a corresponding `pdfDataId` is created in the notebook.
3. The page renders a first-page thumbnail in page preview lists via `InactivePagePreview.tsx`.
4. Clicking the PDF card opens `PdfWorkspace.tsx`, creating a fresh Blob Object URL (`URL.createObjectURL`), loading pages via `pdfjs-dist`, and providing annotation overlays.

---

## 4. Key Implementation Constraints & Rules

1. **Local Disk as Source of Truth**: When running in Electron mode (`window.panvas` exists), data is written to disk via IPC (`WorkspaceService.ts` and `domain-handlers.ts`). IndexedDB (`schema.ts`) acts as a fallback and as storage for large binary assets (PDFs, images).
2. **Strict Process Isolation**: Renderer process (React) interacts with Node/Electron main process solely through `window.panvas` exposed by `preload.ts`.
3. **Native Viewport Isolation**: The notebook viewport (`.notebook-viewport`) owns document scrolling. Fixed UI elements (toolbars, topbar, sidebars, page properties) must never scroll with document pages.
