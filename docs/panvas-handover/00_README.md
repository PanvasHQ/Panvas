# Panvas Engineering Handover — Documentation Index (00_README.md)

Welcome to the **Panvas** engineering handover documentation. This directory (`docs/panvas-handover/`) contains comprehensive architectural, structural, operational, and historical documentation for the Panvas digital workspace codebase.

> [!IMPORTANT]
> **Source of Truth & Governance Rules**:
> 1. Read this entry point (`00_README.md`) first.
> 2. Read [`01_PROJECT_OVERVIEW.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/01_PROJECT_OVERVIEW.md) and [`02_ARCHITECTURE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/02_ARCHITECTURE.md).
> 3. Inspect ground-truth source files in `src/` and `electron/` before making any code modifications.
> 4. Do not assume roadmap checkboxes in `roadmap.md` mean features are functionally complete. Refer to [`14_ROADMAP_STATUS.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/14_ROADMAP_STATUS.md).
> 5. UI presence does NOT equal functional completion.

---

## 📚 Handover Documentation Structure

| File | Topic & Primary Content |
|---|---|
| [`00_README.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/00_README.md) | Entry point, document index, repository directory map, reading guide. |
| [`01_PROJECT_OVERVIEW.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/01_PROJECT_OVERVIEW.md) | Product vision, core value proposition, key user flows, local-first design philosophy. |
| [`02_ARCHITECTURE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/02_ARCHITECTURE.md) | High-level system architecture, Electron IPC bridge, process boundary (Main vs Renderer), hybrid storage model. |
| [`03_TECH_STACK_AND_DEPENDENCIES.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/03_TECH_STACK_AND_DEPENDENCIES.md) | Audit of `package.json`, Vite configuration, TypeScript setup, Electron build pipeline, key third-party libraries. |
| [`04_DATA_MODEL_AND_PERSISTENCE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/04_DATA_MODEL_AND_PERSISTENCE.md) | Data schemas, entity relations, filesystem storage (`.panvas/workspace.json`), IndexedDB fallback (`schema.ts`), Dexie-to-FS migration. |
| [`05_NOTEBOOK_SYSTEM.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/05_NOTEBOOK_SYSTEM.md) | Notebook hierarchy, native 2D drawing/pen engine, rich text (TipTap), layout/scroll modes (Vertical, Horizontal, 2-Page), page sorter. |
| [`06_CANVAS_SYSTEM.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/06_CANVAS_SYSTEM.md) | Free-form infinite canvas, Excalidraw integration, custom blocks (LaTeX, Markdown, PDF block, mockups). |
| [`07_PDF_SYSTEM.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/07_PDF_SYSTEM.md) | PDF import, storage, first-page thumbnail preview (`InactivePagePreview`), full PDF workspace (`PdfWorkspace`), PDF.js worker setup. |
| [`08_IMPORT_EXPORT_SYSTEM.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/08_IMPORT_EXPORT_SYSTEM.md) | Universal drag & drop router, image insertion, file picker handlers, export capabilities. |
| [`09_UI_AND_COMPONENT_STRUCTURE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/09_UI_AND_COMPONENT_STRUCTURE.md) | Component tree breakdown, layout shells (`AppShell`, `TopBar`, `Sidebar`, `NotebookRenderer`), floating toolbars, dialogs. |
| [`10_STATE_MANAGEMENT.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/10_STATE_MANAGEMENT.md) | Zustand stores (`workspaceStore`, `canvasStore`, `layoutStore`, `notebookSettingsStore`, `uiStore`, `authStore`, `syncStore`), repository layer design. |
| [`11_KNOWN_BUGS_AND_FIX_HISTORY.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/11_KNOWN_BUGS_AND_FIX_HISTORY.md) | Detailed bug history, root causes, exact fixes applied (Viewport scroll isolation, PDF worker CSP fix, Zombie process locks, etc.). |
| [`12_COMPLETED_FEATURES.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/12_COMPLETED_FEATURES.md) | Comprehensive list of fully functional (`DONE`) features verified against code and behavior. |
| [`13_PARTIAL_AND_MISSING_FEATURES.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/13_PARTIAL_AND_MISSING_FEATURES.md) | Classification of `PARTIAL`, `BROKEN`, `MISSING`, and `UNKNOWN` components. |
| [`14_ROADMAP_STATUS.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/14_ROADMAP_STATUS.md) | Audit of `roadmap.md` Phases 1 through 20 comparing claimed vs actual implementation status. |
| [`15_DEVELOPMENT_AND_DEBUGGING_GUIDE.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/15_DEVELOPMENT_AND_DEBUGGING_GUIDE.md) | Local development setup, build scripts, type-checking, debugging IPC, handling Electron zombie process locks. |
| [`16_HANDOVER.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/16_HANDOVER.md) | Senior engineering briefing, critical warnings, dangerous files, exact immediate next steps, what NOT to touch. |

---

## 📁 Repository Map

```
Panvas/
├── electron/                         # Native Electron Main & Preload Process
│   ├── main.ts                       # Electron main entry point, window management
│   ├── preload.ts                    # ContextBridge API exposition (window.panvas)
│   └── ipc/                          # Main process domain handlers & file system operations
│       ├── domain-handlers.ts        # IPC invocation handlers for workspace/notebook/canvas CRUD
│       ├── WorkspaceService.ts       # Low-level disk IO for Documents/Panvas/<workspace>/.panvas/
│       └── write-queue.ts            # Serialized write queue for json disk persistence
│
├── src/                              # React Renderer Process (Vite app)
│   ├── app/                          # Application wrapper & routes
│   ├── components/                   # React Component Hierarchy
│   │   ├── appearance/               # Theme studio & custom appearance controls
│   │   ├── auth/                     # Supabase authentication UI & guard components
│   │   ├── canvas/                   # Freeform infinite canvas view & custom block renderers
│   │   ├── layout/                   # Global shell (AppShell, TopBar, Sidebar, Footer, StatusBar)
│   │   ├── library/                  # Library workspace & preview cards
│   │   ├── notebook/                 # Notebook editor system & 2D drawing surface
│   │   │   ├── engine/               # HTML5 Canvas 2D Drawing & Input Engine (NotebookEngine)
│   │   │   └── templates/            # Paper templates (Grid, Ruled, Dotted, Cornell, etc.)
│   │   ├── pdf/                      # PDF Workspace, thumbnail sidebar, page renderer
│   │   ├── pen-toolbar/              # Pen toolbar preview & stroke style pickers
│   │   ├── settings/                 # Settings dialog sections
│   │   ├── ui/                       # Reusable UI elements (Toast, CommandPalette, ContextMenu)
│   │   └── workspace/                # Workspace tree explorer & dialogs
│   ├── database/                     # IndexedDB / Dexie.js Schema & fallback CRUD operations
│   │   ├── schema.ts                 # Dexie.js database schema definition
│   │   ├── canvasDB.ts               # Canvas & PDF binary storage helpers
│   │   ├── notebookDB.ts             # Local notebook data helpers
│   │   └── workspaceDB.ts            # Local workspace data helpers
│   ├── hooks/                        # Custom React hooks (usePdfDocument, useKeyboardShortcuts, useAutosave)
│   ├── lib/                          # Utility functions, validation, migration scripts
│   │   └── migration.ts              # Dexie-to-Filesystem migration handler
│   ├── repositories/                 # Repository Pattern abstraction layer (delegates IPC vs Dexie)
│   │   ├── CanvasRepository.ts
│   │   ├── FolderRepository.ts
│   │   ├── NotebookRepository.ts
│   │   ├── SettingsRepository.ts
│   │   └── WorkspaceRepository.ts
│   ├── services/                     # Background services (Auth, Drop router, Sync, Storage)
│   ├── stores/                       # Zustand Global Stores
│   │   ├── workspaceStore.ts         # Active workspace, notebook, section, page & folder state
│   │   ├── canvasStore.ts            # Active canvas elements & blocks state
│   │   ├── layoutStore.ts            # Viewport modes, scroll directions, panel states
│   │   ├── notebookSettingsStore.ts  # Pen colors, widths, tool selections
│   │   ├── uiStore.ts                # Toast messages, modals, sidebars toggle
│   │   ├── authStore.ts              # User authentication state
│   │   └── syncStore.ts              # Sync engine queue state
│   ├── styles/                       # CSS files (index.css, blocks.css, themes)
│   └── types/                        # TypeScript type definitions (workspace, notebook, canvas, electron)
│
├── docs/                             # Project documentation
│   └── panvas-handover/              # Engineering Handover Documents (This directory)
│
├── public/                           # Static public assets
├── electron-builder.json             # Packaging configuration
├── package.json                      # Build scripts and dependency manifest
├── tsconfig.json                     # TypeScript compiler configuration
└── vite.config.ts                    # Vite build & Electron plugin configuration
```

---

## ⚡ Quick Start for Incoming Engineers

1. **Verify environment & dependencies**:
   ```bash
   node -v # Recommended: Node 18+ or 20+
   npm install
   ```

2. **Run TypeScript check**:
   ```bash
   npx tsc -b
   ```

3. **Run local dev mode / Electron shell**:
   ```bash
   npm start
   ```

4. **Next Step**: Read [`16_HANDOVER.md`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/docs/panvas-handover/16_HANDOVER.md) before making any code modifications.
