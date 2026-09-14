# 09 — UI & Component Structure (09_UI_AND_COMPONENT_STRUCTURE.md)

## 1. UI Hierarchy Breakdown

```
AppShell [src/components/layout/AppShell.tsx]
├── TopBar [src/components/layout/TopBar.tsx]
│   ├── Native Titlebar Frameless Overlay Controls
│   ├── Workspace Breadcrumb Navigation
│   ├── Global Search Bar & Command Palette Trigger (CTRL+K)
│   ├── Theme Switcher Toggle
│   └── Sync Status Indicator [src/components/ui/SyncIndicator.tsx]
│
├── Sidebar [src/components/layout/Sidebar.tsx]
│   ├── User Avatar & Account Switcher [src/components/ui/UserAvatar.tsx]
│   ├── Quick Links (Home Dashboard, Library, Trash, Settings)
│   ├── Workspace Tree Explorer [src/components/workspace/WorkspaceTree.tsx]
│   └── New Item Action Buttons (+ Workspace, + Notebook, + Canvas)
│
├── Main Viewport Container
│   └── WorkspaceContent [src/components/workspace/WorkspaceContent.tsx]
│       ├── (Route: PDF Page) ───> PdfWorkspace [src/components/pdf/PdfWorkspace.tsx]
│       │                          ├── PdfThumbnailSidebar
│       │                          ├── PdfPageRenderer
│       │                          └── NotebookFloatingToolbar
│       │
│       ├── (Route: Notebook) ───> NotebookRenderer [src/components/notebook/NotebookRenderer.tsx]
│       │                          ├── NotebookFloatingToolbar (Top Pinned)
│       │                          ├── NotebookToolPropertiesPanel (Right Pinned Inspector)
│       │                          ├── Native Scroll Viewport (.notebook-viewport)
│       │                          │   └── PageRenderer [PageRenderer.tsx]
│       │                          │       ├── Paper Template SVG Overlay
│       │                          │       ├── FloatingTextEditor (TipTap)
│       │                          │       └── Canvas Ink Layer (NotebookEngine)
│       │                          └── NotebookNavigator Modal (Page Sorter Grid)
│       │
│       ├── (Route: Canvas) ────> CanvasWorkspace [src/components/canvas/CanvasWorkspace.tsx]
│       │                          ├── CanvasToolbar
│       │                          └── CanvasView (Excalidraw + Custom Blocks)
│       │
│       └── (Route: Explorer) ───> WorkspaceExplorerPreview [WorkspaceExplorerPreview.tsx]
│
├── Footer / StatusBar [src/components/layout/StatusBar.tsx]
└── Overlays & Dialogs
    ├── CommandPalette [src/components/ui/CommandPalette.tsx]
    ├── CreateDialog [src/components/workspace/CreateDialog.tsx]
    ├── NotebookContextMenu [src/components/notebook/NotebookContextMenu.tsx]
    └── Toast Container [src/components/ui/Toast.tsx]
```

---

## 2. Key Layout Components & Specifications

### 2.1 `AppShell.tsx` (`src/components/layout/AppShell.tsx`)
* Top-level wrapper managing application frame layout (`h-screen w-screen flex flex-col overflow-hidden`).
* Sets `data-theme` attribute on root `<html>`/`<div>` element based on `useLayoutStore` active theme.
* Listens for global keyboard shortcuts (`CTRL+K` for command palette, `CTRL+B` for sidebar toggle).

### 2.2 `TopBar.tsx` (`src/components/layout/TopBar.tsx`)
* Frameless window header (`h-11 flex items-center justify-between px-4`).
* Integrates seamlessly with Electron's `titleBarOverlay` native minimize, maximize, and close window controls on Windows/macOS.
* Displays dynamic breadcrumb hierarchy (`Workspace > Notebook > Section > Page`).
* Houses search input trigger and theme toggle switch.

### 2.3 `Sidebar.tsx` (`src/components/layout/Sidebar.tsx`)
* Collapsible navigation sidebar (`w-64 flex-shrink-0 flex flex-col`).
* Renders hierarchical workspace tree ([`WorkspaceTree.tsx`](../../src/components/workspace/WorkspaceTree.tsx)) showing Workspaces, Folders, Notebooks, Sections, and Canvas files.
* Supports drag-and-drop file imports into specific sections.

### 2.4 `NotebookRenderer.tsx` (`src/components/notebook/NotebookRenderer.tsx`)
* Core notebook view container.
* Establishes fixed bounding layout (`flex-1 flex overflow-hidden relative`).
* Contains `.notebook-viewport` scroll container (`flex-1 overflow-y-auto overflow-x-hidden`).
* Hosts fixed floating top toolbar (`NotebookFloatingToolbar`) and right inspector (`NotebookToolPropertiesPanel`).

---

## 3. UI Primitive Components (`src/components/ui/`)

* **`Toast.tsx`**: Toast notification overlay system (`useUIStore.getState().showToast(message, type)`).
* **`CommandPalette.tsx`**: Modal command palette triggered by `CTRL+K` for quick search and command execution.
* **`ContextMenu.tsx`**: Custom floating context menu popup for right-click interactions.
* **`SyncIndicator.tsx`**: Visual sync status dot (Green = Synced, Yellow = Pending, Red = Error, Gray = Local).
