# State Management

Panvas relies on Zustand for global, cross-component state management. Zustand was chosen for its minimal boilerplate and excellent React reactivity without needing context providers.

## Stores (`src/stores/`)

### `workspaceStore.ts`
The core state for the active user workspace.
- **State**: Holds `workspaces`, `activeWorkspaceId`, `activeNotebookId`, `activePageId`.
- **Derived State**: Exposes `activePage`, `activeNotebook` based on the IDs.
- **Actions**: `loadWorkspaces()`, `setActivePage()`, `createNotebook()`, `deletePage()`. These actions both update the local Zustand state and call the `WorkspaceRepository` to persist the changes to disk/DB.

### `layoutStore.ts`
Manages the visual layout of the application shell.
- **State**: `notebookModeLevel` (0 = full UI, 1 = focus mode, 2 = fullscreen canvas).
- **State**: `isNotebookPaneVisible`, `isPropertiesPanelOpen`.
- **Actions**: Toggles for the sidebar, toolbars, and panels.

### `uiStore.ts`
Manages ephemeral, global UI elements.
- **State**: Active Toasts, Dialogs, Context Menus, and the Command Palette visibility.

### `authStore.ts`
Integrates with Supabase to provide auth state.
- **State**: `user` (Supabase User object), `session`, `isLoading`.
- **Actions**: `initAuth()`, `signOut()`. Automatically synchronizes with Supabase's `onAuthStateChange` listener.

### `syncStore.ts`
Tracks the background synchronization process.
- **State**: `status` (idle, syncing, offline, error), `pendingChanges` count, `lastSyncedAt`.

## Local vs Global State
Panvas strictly differentiates between Global State and Local State.
- **Global (Zustand)**: Used for navigation (which page is open) and layout (is the sidebar open).
- **Local (React `useState`)**: Used for highly isolated UI states (e.g., dropdown open/close).
- **Engine State (Vanilla Class)**: The actual strokes, shapes, and images on the canvas are **NOT** stored in Zustand or React state. They are stored inside `NotebookEngine` instances. React components do not re-render when a stroke is drawn. They only communicate with the Engine imperatively.
