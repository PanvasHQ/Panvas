# Project Structure

This document outlines the high-level directory structure of the Panvas repository and explains the responsibilities of each primary folder.

## Root Directory

The root directory contains configuration files for the build system, package management, and TypeScript.

- `package.json`: Defines scripts and dependencies.
- `vite.config.ts`: Configuration for Vite, including the `vite-plugin-electron` setup.
- `tsconfig.json`: TypeScript compiler options.
- `electron/`: Contains the Electron main process code and IPC handlers.
- `src/`: Contains the entire React frontend and rendering engines.
- `docs/codebase/`: The current documentation snapshot.

## `electron/` - Native Process

Responsible for bridging the web app with the underlying OS (Windows/macOS/Linux) for local file storage, menu systems, and window management.

- `main.ts`: Entry point for the Electron main process. Manages window creation and DevTools.
- `preload.ts`: Exposes safe native APIs to the `window.electron` object in the renderer.
- `ipc/`: Inter-Process Communication handlers.
  - `domain-handlers.ts`: Registers handlers for workspace reading/writing.
  - `WorkspaceService.ts`: Reads and writes workspace configurations and `.panvas` notebook files to the local disk.
  - `write-queue.ts`: Manages atomic writes to prevent data corruption during synchronization (e.g., OneDrive locking).

## `src/` - React Renderer

The main web application. It uses a modern React + TypeScript + Vite stack.

### `src/app/`
Contains `App.tsx`, the root React component that sets up routing, themes, and global providers.

### `src/components/`
The UI is broken down into feature-based subdirectories:

- `auth/`: Supabase authentication pages (Login, SignUp, ForgotPassword).
- `layout/`: Global layout components (`AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`).
- `notebook/`: **The Core Feature**. Contains the infinite canvas, drawing engine, floating toolbars, and rich text editors.
  - `engine/`: The vanilla TypeScript rendering engine (`DrawingEngine.ts`, `InputManager.ts`) that runs the canvas without React overhead.
- `pdf/`: The PDF workspace for importing, rendering, and annotating PDFs.
- `workspace/`: The local file explorer tree (`WorkspaceTree.tsx`) for managing Notebooks and Pages.
- `ui/`: Generic, reusable UI primitives (Buttons, CommandPalette, Overlays).

### `src/database/`
Local storage definitions using Dexie.js (IndexedDB wrapper).

- `schema.ts`: Defines the unified database schema (if applicable).
- `workspaceDB.ts` & `notebookDB.ts`: Database instances for caching data locally before it hits the disk.

### `src/repositories/`
The Data Access Layer. Separates the UI from the raw database/API calls.

- `WorkspaceRepository.ts`: Manages Workspaces and Sections.
- `NotebookRepository.ts`: Manages saving and loading Notebook pages and drawing data.
- `CanvasRepository.ts`: Historical component, transitioning into NotebookRepository.

### `src/services/`
Background workers and external API clients.

- `supabase/`: Supabase client configuration for cloud authentication and sync.
- `sync/`: Background `SyncEngine.ts` and `SyncScheduler.ts` that synchronize local IndexedDB data with Supabase.

### `src/stores/`
Global state management using **Zustand**.

- `workspaceStore.ts`: Tracks the currently active Workspace, Notebook, and Page.
- `layoutStore.ts`: Tracks UI state (sidebar open/closed, toolbars).
- `uiStore.ts`: Toasts, dialogs, and overlays.
- `authStore.ts`: Current user session.

### `src/types/`
Global TypeScript definitions.

- `notebook.ts`: Interfaces for Page, Section, Block.
- `electron.d.ts`: Typings for the `window.electron` bridge.
- `workspace.ts`: Interfaces for Workspaces and files.

### `src/styles/`
Global vanilla CSS files.
- `index.css`: Main styling, CSS variables for theming.
- `blocks.css`: Specific styles for notebook blocks.
