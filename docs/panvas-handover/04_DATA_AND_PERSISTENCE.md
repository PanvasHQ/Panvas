# 04 — Data Model & Persistence (04_DATA_MODEL_AND_PERSISTENCE.md)

## 1. Domain Entities & TypeScript Schemas

The core data entities are defined in [`src/types/workspace.ts`](../../src/types/workspace.ts), [`src/types/notebook.ts`](../../src/types/notebook.ts), [`src/types/canvas.ts`](../../src/types/canvas.ts), and [`src/components/notebook/engine/drawingTypes.ts`](../../src/components/notebook/engine/drawingTypes.ts).

### 1.1 Hierarchy Specification

```
Workspace
├── Folder (Optional, nested tree via parentId)
│   ├── Notebook
│   └── CanvasFile
└── Notebook
    └── NotebookSection
        └── NotebookPage
            ├── Rich Text (TipTap prose content)
            ├── DrawingData (Vector pen/pencil/highlighter strokes)
            └── Metadata (Paper format, color, margins, PDF data link)
```

---

### 1.2 Entity Specifications

#### Workspace (`src/types/workspace.ts`)
```typescript
export interface Workspace {
  id: string;
  name: string;
  locationPath?: string;
  isPinned?: boolean;
  order?: number;
  createdAt: number;
  updatedAt: number;
  syncStatus?: 'local' | 'synced' | 'pending' | 'conflict';
  userId?: string | null;
  deletedAt?: number | null;
}
```

#### Folder (`src/types/workspace.ts`)
```typescript
export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  order: number;
  isExpanded?: boolean;
  createdAt: number;
  updatedAt: number;
  syncStatus?: 'local' | 'synced' | 'pending' | 'conflict';
  userId?: string | null;
  deletedAt?: number | null;
}
```

#### Notebook (`src/types/notebook.ts`)
```typescript
export interface Notebook {
  id: string;
  workspaceId: string;
  folderId?: string | null;
  name: string;
  order: number;
  isExpanded?: boolean;
  coverColor?: string;
  paperStyle?: string;
  createdAt: number;
  updatedAt: number;
}
```

#### NotebookSection (`src/types/notebook.ts`)
```typescript
export interface NotebookSection {
  id: string;
  notebookId: string;
  name: string;
  color?: string;
  order: number;
  isExpanded?: boolean;
  createdAt: number;
  updatedAt: number;
}
```

#### NotebookPage (`src/types/notebook.ts`)
```typescript
export interface NotebookPage {
  id: string;
  notebookId: string;
  sectionId: string;
  title: string;
  order: number;
  type?: 'default' | 'pdf' | 'template';
  pdfDataId?: string;
  paperColor?: string;
  backgroundFormat?: 'blank' | 'ruled' | 'grid' | 'dots' | 'graph' | 'cornell';
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter' | 'a5' | 'legal';
  margins?: 'none' | 'narrow' | 'normal' | 'wide';
  content?: string; // Rich text HTML / JSON
  createdAt: number;
  updatedAt: number;
}
```

#### CanvasFile (`src/types/workspace.ts`)
```typescript
export interface CanvasFile {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  order: number;
  lastOpenedAt?: number;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  syncStatus?: 'local' | 'synced' | 'pending' | 'conflict';
  userId?: string | null;
  deletedAt?: number | null;
}
```

#### DrawingData & Stroke (`drawingTypes.ts`)
```typescript
export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  id: string;
  tool: 'pen' | 'pencil' | 'highlighter' | 'eraser';
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  smooth?: boolean;
}

export interface DrawingData {
  version: number;
  strokes: Stroke[];
  shapes: ShapeObject[];
  texts: TextObject[];
  images: ImageObject[];
  updatedAt: number;
}
```

---

## 2. Persistence Implementation & File Structure

When running in Electron desktop mode, data persistence is performed by [`WorkspaceService.ts`](../../electron/ipc/WorkspaceService.ts) and [`domain-handlers.ts`](../../electron/ipc/domain-handlers.ts).

```
%USERPROFILE%/Documents/Panvas/
└── <WorkspaceName>/
    └── .panvas/
        ├── workspace.json              # Master structural registry
        ├── canvases/
        │   └── <canvasId>.json         # Canvas elements, custom blocks, Excalidraw state
        └── notebooks/
            └── <notebookId>/
                └── pages/
                    ├── <pageId>.json         # Rich text content & page properties
                    └── <pageId>.drawing.json # Raw vector ink strokes (DrawingData)
```

### 2.1 Workspace Registry Format (`workspace.json`)
```json
{
  "id": "ws_123456",
  "name": "Computer Science Notes",
  "createdAt": 1770630000000,
  "updatedAt": 1770630500000,
  "folders": [...],
  "canvasFiles": [...],
  "notebooks": [...],
  "notebookSections": [...],
  "notebookPages": [...]
}
```

---

## 3. IndexedDB Layer (`src/database/schema.ts`)

Dexie database schema version 2 definition:
```typescript
this.version(2).stores({
  workspaces: 'id, name, updatedAt, isPinned, syncStatus, userId',
  folders: 'id, workspaceId, parentId, order, syncStatus, userId',
  canvasFiles: 'id, workspaceId, folderId, updatedAt, lastOpenedAt, isPinned, syncStatus, userId',
  canvasData: 'canvasFileId, userId',
  customBlocks: 'id, canvasFileId, type, userId',
  pdfFiles: 'id, canvasFileId, userId',
  syncQueue: '++id, entityType, entityId, status, createdAt',
  notebooks: 'id, workspaceId, folderId, order',
  notebookSections: 'id, notebookId, order',
  notebookPages: 'id, notebookId, sectionId, order',
  imageFiles: 'id, canvasFileId, userId'
});
```

### 3.1 PDF & Image Storage (`src/database/canvasDB.ts`)
* `storePdfFile(userId, canvasFileId, fileName, data: ArrayBuffer)`: Stores full raw ArrayBuffer into `db.pdfFiles`.
* `getPdfFile(userId, id)`: Fetches record from `db.pdfFiles`.

---

## 4. Item Reordering & ID Generation

* **ID Generation**: Handled by [`src/lib/utils/id.ts`](../../src/lib/utils/id.ts) using custom prefixes + Nanoid:
  * Workspace ID: `ws_...`
  * Notebook ID: `nb_...`
  * Section ID: `sec_...`
  * Page ID: `page_...`
  * Canvas ID: `canvas_...`
  * PDF ID: `pdf_...`
* **Order Calculations**: Each array item contains an `order` integer. When items are dragged or reordered, `window.panvas.workspace.reorder(...)` updates the `order` key of all impacted entities in `workspace.json`.
