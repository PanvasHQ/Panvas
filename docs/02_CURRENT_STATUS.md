# Current status

Legend: ✅ built and wired; 🟡 present but incomplete/placeholder; 🔴 not started.

## Real application capabilities

- ✅ React SPA bootstraps through `src/main.tsx` and `src/app/App.tsx`.
- ✅ `AppShell` provides TopBar, resizable/toggleable Sidebar, content region, and StatusBar.
- ✅ Workspace/folder/canvas persistence exists in Dexie/IndexedDB; delete is soft by default.
- ✅ Notebook, section, and page entities exist in Dexie and are created through `workspaceStore`/`NotebookRepository`.
- ✅ `/app` chooses `NotebookPagePlaceholder` when `activePageId` exists, otherwise real `CanvasView`.
- ✅ `CanvasView` lazy-loads Excalidraw, loads/saves canvas data, debounces autosave, supports canvas custom blocks, and intercepts PDF drop storage.
- ✅ Zustand stores exist for workspace, canvas, UI, auth, and sync.
- ✅ Supabase auth and an outbox-style sync implementation exist when configuration is supplied.
- ✅ Light, dark, and ink theme tokens exist; UI store persists selected theme in `localStorage`.

## UI pages and their implementation state

- ✅ Marketing: landing, roadmap, privacy, terms, security, coming-soon/auth pages.
- 🟡 Notebook: hierarchy/navigation and a sophisticated visual page shell; editor/drawing controls are visual placeholders.
- ✅ Canvas: existing `CanvasView` is functional Excalidraw integration. `CanvasWorkspace` is a separate static design preview.
- 🟡 PDF workspace: static reader/annotation interface; no PDF rendering or annotation persistence in this page.
- 🟡 Library, Workspace Explorer, Pen Toolbar, Theme Studio, System Components: review-only static UI routes.
- 🟡 Settings sections exist; verify individual controls before extending.

## Routes in `App.tsx`

Public: `/`, `/privacy`, `/terms`, `/security`, `/roadmap`.

Auth (when not marketing-only): `/auth/login`, `/auth/signup`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/callback`.

Application: `/app`, `/app/settings/:tab*` (both auth guarded).

Temporary preview routes: `/pdf-preview`, `/canvas-preview`, `/canvas-workspace-preview`, `/app/canvas-workspace-preview`, `/library-preview`, `/workspace-explorer-preview`, `/app/workspace-explorer-preview`, `//workspace-explorer-preview`, `/pen-toolbar-preview`, `/app/pen-toolbar-preview`, `//pen-toolbar-preview`, `/theme-preview`, `/system-preview`.

The double-slash routes are compatibility workarounds added after browser URL resolution issues. They are not product routes and should be cleaned up deliberately once preview review is complete.

## Production-ready vs mock

Production-oriented code: Dexie schema/repositories, workspace/canvas stores, Excalidraw persistence/autosave, auth/sync scaffolding, shared shell, real command/create/context/toast components.

Mock/placeholder code: every `*Preview`, `CanvasWorkspace`, PDF workspace UI, pen toolbar preview, theme studio, system preview, most notebook editor/drawing controls, and File Library/Explorer sample records. Do not connect these mock surfaces to persistence without replacing their static data intentionally.
