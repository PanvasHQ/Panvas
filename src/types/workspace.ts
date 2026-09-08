// ============================================
// Panvas — Type Definitions: Workspace
// ============================================

export type SyncStatusField = 'local' | 'synced' | 'pending' | 'conflict';

export const FOLDER_ICON_IDS = ['folder', 'book', 'briefcase', 'archive'] as const;
export type FolderIconId = typeof FOLDER_ICON_IDS[number];
export const FOLDER_COLOR_PRESETS = ['#C97A40', '#557A95', '#5F8F72', '#8A6FB0', '#B75D6B', '#777777'] as const;
export interface FolderAppearance { color?: string; icon?: FolderIconId; }

export function normalizeFolderAppearance(appearance: FolderAppearance): FolderAppearance {
  const color = typeof appearance.color === 'string' && /^#[0-9a-f]{6}$/i.test(appearance.color)
    ? appearance.color.toUpperCase()
    : undefined;
  const icon = FOLDER_ICON_IDS.includes(appearance.icon as FolderIconId) ? appearance.icon : undefined;
  return { color, icon };
}

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
  /** Set only when an ancestor deletion hid this record from Trash roots. */
  deletedByAncestorId?: string | null;
  isSystem?: boolean;
  systemType?: 'default' | 'welcome';
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
  color?: string;
  icon?: FolderIconId;
  syncStatus: SyncStatusField;
  userId: string | null;
  deletedAt: number | null;
  /** Set only when an ancestor deletion hid this record from Trash roots. */
  deletedByAncestorId?: string | null;
}

export interface CanvasFile {
  id: string;
  workspaceId: string;
  folderId: string | null; // null = workspace root unless notebookId or sectionId is set
  notebookId?: string | null;
  sectionId?: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  order: number;
  isPinned: boolean;
  syncStatus: SyncStatusField;
  userId: string | null;
  deletedAt: number | null;
  /** Set only when an ancestor deletion hid this record from Trash roots. */
  deletedByAncestorId?: string | null;
  isSystem?: boolean;
  systemType?: 'default' | 'welcome';
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
