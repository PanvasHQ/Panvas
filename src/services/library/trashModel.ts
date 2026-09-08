/**
 * Shared local-first trash semantics for browser IndexedDB and Electron's
 * workspace.json metadata.  A deleted record may be a direct root deletion or
 * a descendant hidden by a deleted ancestor.  The latter is marked with
 * `deletedByAncestorId`; the relationship checks below also cover legacy rows
 * that predate that marker.
 */

export interface TrashRecord {
  id: string;
  deletedAt?: number | null;
  deletedByAncestorId?: string | null;
  updatedAt?: number;
  workspaceId?: string | null;
  parentId?: string | null;
  folderId?: string | null;
  notebookId?: string | null;
  sectionId?: string | null;
}

export interface TrashWorkspaceData {
  workspaces?: TrashRecord[];
  folders?: TrashRecord[];
  canvasFiles?: TrashRecord[];
  notebooks?: TrashRecord[];
  notebookSections?: TrashRecord[];
  notebookPages?: TrashRecord[];
}

export type TrashEntityKind = 'workspace' | 'folder' | 'canvas' | 'notebook' | 'section' | 'page';

export interface TrashRootData {
  workspaces: TrashRecord[];
  folders: TrashRecord[];
  canvasFiles: TrashRecord[];
  notebooks: TrashRecord[];
  sections: TrashRecord[];
  pages: TrashRecord[];
}

export function isDeleted(record: TrashRecord | undefined): boolean {
  return record?.deletedAt !== null && record?.deletedAt !== undefined;
}

/** Marks a directly deleted entity and clears any previous cascade marker. */
export function markDirectlyDeleted<T extends TrashRecord>(record: T, deletedAt: number, updatedAt = deletedAt): T {
  record.deletedAt = deletedAt;
  record.updatedAt = updatedAt;
  delete record.deletedByAncestorId;
  return record;
}

/** Marks only currently-live descendants; an earlier direct deletion wins. */
export function markDeletedByAncestor<T extends TrashRecord>(record: T, deletedAt: number, ancestorId: string, updatedAt = deletedAt): T {
  if (!isDeleted(record)) {
    record.deletedAt = deletedAt;
    record.deletedByAncestorId = ancestorId;
    record.updatedAt = updatedAt;
  }
  return record;
}

/** Restores a descendant only when this deletion root caused its deletion. */
export function clearAncestorDeletion<T extends TrashRecord>(record: T, ancestorId: string, updatedAt = Date.now(), ancestorDeletedAt?: number | null): T {
  const legacyCascade = !record.deletedByAncestorId && ancestorDeletedAt != null && record.deletedAt === ancestorDeletedAt;
  if (record.deletedByAncestorId === ancestorId || legacyCascade) {
    record.deletedAt = null;
    record.updatedAt = updatedAt;
    delete record.deletedByAncestorId;
  }
  return record;
}

function deletedMap(records: readonly TrashRecord[]): Map<string, TrashRecord> {
  return new Map(records.map(record => [record.id, record]));
}

/**
 * Computes visible Trash roots.  A deleted entity is suppressed whenever one
 * of its persisted ancestors is deleted.  This keeps legacy rows (without a
 * cascade marker) correct while the marker makes restore semantics lossless.
 */
export function getTrashRoots(data: TrashWorkspaceData): TrashRootData {
  const workspaces = data.workspaces ?? [];
  const folders = data.folders ?? [];
  const canvases = data.canvasFiles ?? [];
  const notebooks = data.notebooks ?? [];
  const sections = data.notebookSections ?? [];
  const pages = data.notebookPages ?? [];
  const workspaceById = deletedMap(workspaces);
  const folderById = deletedMap(folders);
  const notebookById = deletedMap(notebooks);
  const sectionById = deletedMap(sections);

  const deletedFolderAncestor = (folder: TrashRecord): boolean => {
    const visited = new Set<string>();
    let parentId = folder.parentId ?? null;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = folderById.get(parentId);
      if (!parent) break;
      if (isDeleted(parent)) return true;
      parentId = parent.parentId ?? null;
    }
    return Boolean(folder.workspaceId && isDeleted(workspaceById.get(folder.workspaceId)));
  };

  const notebookHiddenByAncestor = (notebook: TrashRecord): boolean => {
    if (notebook.workspaceId && isDeleted(workspaceById.get(notebook.workspaceId))) return true;
    if (!notebook.folderId) return false;
    const folder = folderById.get(notebook.folderId);
    return Boolean(folder && (isDeleted(folder) || deletedFolderAncestor(folder)));
  };

  const sectionHiddenByAncestor = (section: TrashRecord): boolean => {
    const notebook = notebookById.get(section.notebookId ?? '');
    return Boolean(notebook && (isDeleted(notebook) || notebookHiddenByAncestor(notebook)));
  };

  const pageHiddenByAncestor = (page: TrashRecord): boolean => {
    const section = sectionById.get(page.sectionId ?? '');
    const notebook = notebookById.get(page.notebookId ?? '')
      ?? (section ? notebookById.get(section.notebookId ?? '') : undefined);
    return Boolean(
      (section && (isDeleted(section) || sectionHiddenByAncestor(section)))
      || (notebook && (isDeleted(notebook) || notebookHiddenByAncestor(notebook))),
    );
  };

  const canvasHiddenByAncestor = (canvas: TrashRecord): boolean => {
    if (canvas.workspaceId && isDeleted(workspaceById.get(canvas.workspaceId))) return true;
    if (canvas.folderId) {
      const folder = folderById.get(canvas.folderId);
      if (folder && (isDeleted(folder) || deletedFolderAncestor(folder))) return true;
    }
    if (canvas.notebookId) {
      const notebook = notebookById.get(canvas.notebookId);
      if (notebook && (isDeleted(notebook) || notebookHiddenByAncestor(notebook))) return true;
    }
    if (canvas.sectionId) {
      const section = sectionById.get(canvas.sectionId);
      if (section && (isDeleted(section) || sectionHiddenByAncestor(section))) return true;
    }
    return false;
  };

  const roots = <T extends TrashRecord>(records: readonly T[], hidden: (record: T) => boolean): T[] => (
    records.filter(record => isDeleted(record) && !hidden(record))
  );

  return {
    workspaces: roots(workspaces, () => false),
    folders: roots(folders, deletedFolderAncestor),
    canvasFiles: roots(canvases, canvasHiddenByAncestor),
    notebooks: roots(notebooks, notebookHiddenByAncestor),
    sections: roots(sections, sectionHiddenByAncestor),
    pages: roots(pages, pageHiddenByAncestor),
  };
}
