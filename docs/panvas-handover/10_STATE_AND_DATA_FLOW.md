# 10 — State Management (10_STATE_MANAGEMENT.md)

## 1. Overview & Architecture

Panvas uses **Zustand (`^5.0.0`)** for client-side state management. State is decoupled into distinct, focused stores located in [`src/stores/`](file:///c:/Users/sksum/OneDrive/Documents/OSS%20ExcaliDraw/src/stores/).

Zustand stores do not handle direct low-level disk I/O; they delegate persistence and data operations to the **Repository Layer** (`src/repositories/`), which decides whether to use Electron IPC handlers or IndexedDB (Dexie).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           REACT COMPONENTS                              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Actions / Hooks
┌────────────────────────────────────▼────────────────────────────────────┐
│                             ZUSTAND STORES                              │
│  workspaceStore | canvasStore | layoutStore | notebookSettingsStore ... │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Delegate Async Operations
┌────────────────────────────────────▼────────────────────────────────────┐
│                           REPOSITORY LAYER                              │
│  WorkspaceRepository | NotebookRepository | CanvasRepository            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Invocation Branch
                  ┌──────────────────┴──────────────────┐
                  ▼                                     ▼
        Electron IPC Bridge                     IndexedDB (Dexie)
      (window.panvas / FS Disk)             (schema.ts / canvasDB.ts)
```

---

## 2. Store Matrix & Responsibilities

| Store File | Responsibilities & Managed State | Key Actions |
|---|---|---|
| **`workspaceStore.ts`** | Master document hierarchy state (Workspaces, Folders, Notebooks, Sections, Pages, CanvasFiles, Trash items). Active navigation IDs (`activeWorkspaceId`, `activePageId`, `activeNotebookId`). | `loadWorkspaces`, `setActiveWorkspace`, `setActivePage`, `createWorkspace`, `createNotebook`, `createPage`, `reorderItems`, `restoreItem` |
| **`canvasStore.ts`** | Infinite canvas elements, Excalidraw view state, custom blocks array (`markdown`, `latex`, `pdf` blocks), canvas file dirty state. | `loadCanvasData`, `saveCanvasData`, `updateElements`, `addCustomBlock`, `updateCustomBlock`, `deleteCustomBlock` |
| **`layoutStore.ts`** | Global UI layout settings: sidebar collapse state, active theme name, notebook scroll orientation (`vertical`, `horizontal`, `two-page-horizontal`). | `toggleSidebar`, `setTheme`, `setNotebookScrollMode`, `setNotebookModeLevel` |
| **`notebookSettingsStore.ts`** | Drawing tool settings: selected tool (`pen`, `pencil`, `highlighter`, `eraser`, `lasso`), stroke color, stroke width, eraser type (`stroke` vs `area`). | `setSelectedTool`, `setPenColor`, `setPenWidth`, `setEraserMode`, `setPaperColor`, `setBackgroundFormat` |
| **`uiStore.ts`** | Volatile UI state: active toasts list, global command palette visibility, create dialog modal state. | `showToast`, `removeToast`, `openCommandPalette`, `closeCommandPalette`, `setCreateDialogOpen` |
| **`authStore.ts`** | User authentication state (Supabase session, user object, login status). | `setUser`, `setSession`, `signOut` |
| **`syncStore.ts`** | Offline sync engine queue, pending sync items, online/offline status, last sync timestamp. | `enqueueChange`, `processQueue`, `setOnlineStatus` |

---

## 3. Storage & Local Storage Binding Keys

To preserve view state across application reloads, active selections are bound to `window.localStorage`:

| LocalStorage Key | Managed State | Default Fallback |
|---|---|---|
| `panvas.activeWorkspaceId` | Currently active workspace ID | `null` (Loads first available workspace) |
| `panvas.activeCanvasId` | Currently open canvas file ID | `null` |
| `panvas.activePageId` | Currently active notebook page ID | `null` |
| `panvas.expandedWorkspaces` | Array of expanded workspace tree node IDs | `[]` |
| `dexie_migrated` | Boolean flag indicating if IndexedDB to FS migration completed | `'false'` |

---

## 4. Example: Page Creation & State Lifecycle

```typescript
// In workspaceStore.ts:
createNotebookPage: async (sectionId, title) => {
  const { user, activeWorkspaceId, activeNotebookId, notebookPages } = get();
  
  // 1. Delegate creation to NotebookRepository (IPC or Dexie)
  const page = await notebookRepository.createPage(
    user?.id || null, 
    activeWorkspaceId, 
    activeNotebookId, 
    sectionId, 
    title
  );

  // 2. Update reactive store state
  set({ 
    notebookPages: [...notebookPages, page],
    activePageId: page.id 
  });

  // 3. Persist active page selection to localStorage
  writeStoredId('panvas.activePageId', page.id);
  return page;
}
```
