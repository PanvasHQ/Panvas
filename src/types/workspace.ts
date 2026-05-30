// ============================================
// Panvas — Type Definitions: Workspace
// ============================================

export type SyncStatusField = 'local' | 'synced' | 'pending' | 'conflict';

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  color?: string; // accent color for workspace
  syncStatus: SyncStatusField;
  userId: string | null;
  deletedAt: number | null;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null; // null = root level
  name: string;
  createdAt: number;
  updatedAt: number;
  order: number;
  isExpanded?: boolean;
  syncStatus: SyncStatusField;
  userId: string | null;
  deletedAt: number | null;
}

export interface CanvasFile {
  id: string;
  workspaceId: string;
  folderId: string | null; // null = workspace root
  name: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  order: number;
  isPinned: boolean;
  syncStatus: SyncStatusField;
  userId: string | null;
  deletedAt: number | null;
}

export type TreeNodeType = 'workspace' | 'folder' | 'canvas';

export interface TreeItem {
  id: string;
  name: string;
  type: TreeNodeType;
  parentId: string | null;
  workspaceId: string;
  children?: TreeItem[];
  isExpanded?: boolean;
  isPinned?: boolean;
  depth: number;
}
