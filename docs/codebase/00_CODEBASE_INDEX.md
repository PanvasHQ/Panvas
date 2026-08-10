# Codebase Index

Welcome to the Panvas codebase documentation. This directory provides a complete, factual snapshot of the repository's architecture, data flows, and systems based entirely on the active source code.

## Navigation Guide

Use this guide to find the right documentation file when developing or debugging specific features.

### 📚 Getting Started & Architecture
Start here to understand how the project is organized and how the layers interact.
- [01_PROJECT_STRUCTURE.md](./01_PROJECT_STRUCTURE.md) - Directory tree and folder responsibilities.
- [02_APP_ARCHITECTURE.md](./02_APP_ARCHITECTURE.md) - High-level system design (Electron + React + Stores).
- [16_BUILD_RUNTIME.md](./16_BUILD_RUNTIME.md) - Vite, TypeScript, and Electron dev/prod configurations.
- [17_FEATURE_TO_FILE_MAP.md](./17_FEATURE_TO_FILE_MAP.md) - A quick lookup matrix mapping user features to source files.

### 🎨 User Interface & Components
Learn how the React frontend is constructed.
- [03_FRONTEND_COMPONENTS.md](./03_FRONTEND_COMPONENTS.md) - Layout shells, sidebars, and UI primitives.
- [14_TOOLBAR_AND_UI_SYSTEM.md](./14_TOOLBAR_AND_UI_SYSTEM.md) - Floating toolbars, tool modes, and context menus.
- [13_ROUTING_AND_WORKSPACE_FLOW.md](./13_ROUTING_AND_WORKSPACE_FLOW.md) - App navigation and how workspaces load pages.

### 📝 The Notebook & Engine
Understand the core feature of Panvas: the infinite canvas.
- [04_NOTEBOOK_SYSTEM.md](./04_NOTEBOOK_SYSTEM.md) - The hierarchy of Workspaces, Notebooks, and Pages.
- [05_DRAWING_ENGINE.md](./05_DRAWING_ENGINE.md) - How WebGL/2D renders strokes, handles input, and manages the viewport.
- [06_TEXT_AND_EDITOR.md](./06_TEXT_AND_EDITOR.md) - How Tiptap rich text editors float synchronously over the canvas.
- [07_IMAGE_SYSTEM.md](./07_IMAGE_SYSTEM.md) - How native images are inserted, cached, and rendered.
- [08_PDF_AND_IMPORT_SYSTEM.md](./08_PDF_AND_IMPORT_SYSTEM.md) - The PDF workspace and file import logic.

### 💾 Data & State Management
Trace how data moves from memory to disk.
- [12_DATA_MODELS.md](./12_DATA_MODELS.md) - The core TypeScript interfaces (`Workspace`, `DrawingData`, `Stroke`).
- [11_STATE_MANAGEMENT.md](./11_STATE_MANAGEMENT.md) - Zustand global stores vs local component state.
- [09_DATABASE_STORAGE.md](./09_DATABASE_STORAGE.md) - IndexedDB schemas and the Repository abstraction layer.
- [10_ELECTRON_IPC.md](./10_ELECTRON_IPC.md) - Native file system access and inter-process communication.
- [15_PERSISTENCE_FLOW.md](./15_PERSISTENCE_FLOW.md) - Tracing the exact path from a user UI action to a JSON file write on disk.

### ⚠️ Troubleshooting
- [18_KNOWN_ISSUES.md](./18_KNOWN_ISSUES.md) - Observable bugs and deferred features currently present in the code.
