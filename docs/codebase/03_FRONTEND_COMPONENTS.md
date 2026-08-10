# Frontend Components

Panvas is composed of a unified React frontend architecture. The interface is heavily modularized to maintain performance.

## Layout Components (`src/components/layout/`)

- **`AppShell.tsx`**: The main container for the application. It receives standard children (the workspace content) and overlays the static UI elements like `TopBar`, `Sidebar`, and `StatusBar`. It responds to `layoutStore` to hide elements in "focus modes" (e.g., when `notebookModeLevel > 0`).
- **`Sidebar.tsx`**: Left-side navigation. It integrates the Workspace tree, Trash section, and global actions.
- **`TopBar.tsx`**: Global header.
- **`StatusBar.tsx`**: Footer providing information on sync status, last saved timestamps, and app version.

## UI Primitives (`src/components/ui/`)

These components are pure presentation layers designed for reusability.

- **`CommandPalette.tsx`**: Quick-action search interface (Ctrl+K).
- **`ContextMenu.tsx`**: Custom right-click menu system.
- **`OverlayManager.tsx`**: Coordinates floating z-index elements.
- **`Toast.tsx`**: Notifications system.
- **`SyncIndicator.tsx`**: Visual representation of the local/cloud sync state.

## Workspace Explorer (`src/components/workspace/`)

- **`WorkspaceContent.tsx`**: A conditional renderer that determines *which* workspace view to show based on the active file type (Canvas, PDF, Library, Settings).
- **`WorkspaceTree.tsx`**: Renders the hierarchical folder structure of Notebooks and Pages.
- **`CreateDialog.tsx`**: UI for creating new notebooks, folders, or pages.

## Authentication (`src/components/auth/`)

- **`AuthGuard.tsx`**: A high-order component that restricts access to protected routes based on `authStore` state.
- **`LoginPage.tsx`, `SignUpPage.tsx`**: Interfaces mapping to Supabase GoTrue APIs.
- **`AuthCallbackHandler.tsx`**: Handles OAuth/Magic Link redirects.

## Legal and Marketing

These static pages run inside the standard React router but omit the AppShell.
- `LandingPage.tsx`, `RoadmapPage.tsx`, `PrivacyPolicyPage.tsx`, etc.
