# Routing and Workspace Flow

Panvas handles routing entirely on the client side using the `wouter` library. However, instead of mapping every notebook page to a distinct URL, Panvas uses a hybrid URL + Global State routing model.

## URL Routing (`src/app/App.tsx`)

`wouter` is used primarily for top-level application states (Authentication, Legal, and Settings).
- `/`: The main application workspace.
- `/login`, `/signup`, `/forgot-password`: Authentication flows.
- `/settings`: Settings overlay/page.
- `/privacy`, `/terms`: Legal documents.

## Workspace Flow (`src/components/workspace/WorkspaceContent.tsx`)

When the user is on the `/` route, `AppShell` renders `WorkspaceContent.tsx`. This component acts as the "internal router" based on the `workspaceStore` state.

1. **Check Active Workspace**: If no workspace is selected, it renders the `WorkspaceExplorerPreview` (a high-level grid of recent files).
2. **Check Active Page**: If a `NotebookPage` is selected in the `Sidebar.tsx` tree:
   - It checks `page.type`.
   - If `type === 'pdf'`, it mounts `<PdfWorkspace page={activePage} />`.
   - If `type === 'default'`, it mounts `<NotebookRenderer page={activePage} />`.
3. **No Active Page**: If a workspace is open but no page is selected, it renders a blank or "Welcome" state.

## Navigation Action (Clicking a Page)

1. User clicks "Lecture Notes" in the sidebar.
2. `WorkspaceTree` calls `workspaceStore.getState().setActivePageId('page-123')`.
3. React re-renders `WorkspaceContent`.
4. `NotebookRenderer` mounts, passing the new `pageId` to `useAutosave` and triggering the `engine.setDrawingData()` to load the new content.
