import {
  clearAncestorDeletion,
  getTrashRoots,
  markDeletedByAncestor,
  markDirectlyDeleted,
  type TrashRecord,
  type TrashWorkspaceData,
} from '../../src/services/library/trashModel.js';

export type WorkspaceTrashRecord = TrashRecord;
export type WorkspaceTrashData = TrashWorkspaceData;

function descendantFolderIds(workspace: WorkspaceTrashData, folderId: string): Set<string> {
  const folders = workspace.folders ?? [];
  const ids = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** Applies a folder deletion/restore to nested folders and owned entities. */
export function setFolderDeletedAt(
  workspace: WorkspaceTrashData,
  folderId: string,
  deletedAt: number | null,
  updatedAt = Date.now(),
): boolean {
  const root = (workspace.folders ?? []).find(item => item.id === folderId);
  if (!root) return false;
  const rootDeletedAt = root.deletedAt;
  const folderIds = descendantFolderIds(workspace, folderId);
  const notebookIds = new Set((workspace.notebooks ?? [])
    .filter(notebook => notebook.folderId != null && folderIds.has(notebook.folderId))
    .map(notebook => notebook.id));
  const sectionIds = new Set((workspace.notebookSections ?? [])
    .filter(section => section.notebookId != null && notebookIds.has(section.notebookId))
    .map(section => section.id));
  if (deletedAt === null) {
    root.deletedAt = null;
    root.updatedAt = updatedAt;
    delete root.deletedByAncestorId;
    for (const record of workspace.folders ?? []) if (record.id !== folderId && folderIds.has(record.id)) clearAncestorDeletion(record, folderId, updatedAt, rootDeletedAt);
    for (const record of workspace.notebooks ?? []) if (notebookIds.has(record.id)) clearAncestorDeletion(record, folderId, updatedAt, rootDeletedAt);
    for (const record of workspace.notebookSections ?? []) if (notebookIds.has(record.notebookId ?? '')) clearAncestorDeletion(record, folderId, updatedAt, rootDeletedAt);
    for (const record of workspace.notebookPages ?? []) if (notebookIds.has(record.notebookId ?? '')) clearAncestorDeletion(record, folderId, updatedAt, rootDeletedAt);
    for (const record of workspace.canvasFiles ?? []) {
      if ((record.folderId && folderIds.has(record.folderId)) || (record.notebookId && notebookIds.has(record.notebookId)) || (record.sectionId && sectionIds.has(record.sectionId))) clearAncestorDeletion(record, folderId, updatedAt, rootDeletedAt);
    }
  } else {
    markDirectlyDeleted(root, deletedAt, updatedAt);
    for (const record of workspace.folders ?? []) if (record.id !== folderId && folderIds.has(record.id)) markDeletedByAncestor(record, deletedAt, folderId, updatedAt);
    for (const record of workspace.notebooks ?? []) if (notebookIds.has(record.id)) markDeletedByAncestor(record, deletedAt, folderId, updatedAt);
    for (const record of workspace.notebookSections ?? []) if (notebookIds.has(record.notebookId ?? '')) markDeletedByAncestor(record, deletedAt, folderId, updatedAt);
    for (const record of workspace.notebookPages ?? []) if (notebookIds.has(record.notebookId ?? '')) markDeletedByAncestor(record, deletedAt, folderId, updatedAt);
    for (const record of workspace.canvasFiles ?? []) {
      if ((record.folderId && folderIds.has(record.folderId)) || (record.notebookId && notebookIds.has(record.notebookId)) || (record.sectionId && sectionIds.has(record.sectionId))) markDeletedByAncestor(record, deletedAt, folderId, updatedAt);
    }
  }
  return true;
}

/** Applies a notebook deletion/restore to sections, pages, and notebook canvases. */
export function setNotebookDeletedAt(
  workspace: WorkspaceTrashData,
  notebookId: string,
  deletedAt: number | null,
  updatedAt = Date.now(),
): boolean {
  const root = (workspace.notebooks ?? []).find(item => item.id === notebookId);
  if (!root) return false;
  const rootDeletedAt = root.deletedAt;
  if (deletedAt === null) {
    root.deletedAt = null;
    root.updatedAt = updatedAt;
    delete root.deletedByAncestorId;
    for (const record of workspace.notebookSections ?? []) if (record.notebookId === notebookId) clearAncestorDeletion(record, notebookId, updatedAt, rootDeletedAt);
    for (const record of workspace.notebookPages ?? []) if (record.notebookId === notebookId) clearAncestorDeletion(record, notebookId, updatedAt, rootDeletedAt);
    for (const record of workspace.canvasFiles ?? []) if (record.notebookId === notebookId) clearAncestorDeletion(record, notebookId, updatedAt, rootDeletedAt);
  } else {
    markDirectlyDeleted(root, deletedAt, updatedAt);
    for (const record of workspace.notebookSections ?? []) if (record.notebookId === notebookId) markDeletedByAncestor(record, deletedAt, notebookId, updatedAt);
    for (const record of workspace.notebookPages ?? []) if (record.notebookId === notebookId) markDeletedByAncestor(record, deletedAt, notebookId, updatedAt);
    for (const record of workspace.canvasFiles ?? []) if (record.notebookId === notebookId) markDeletedByAncestor(record, deletedAt, notebookId, updatedAt);
  }
  return true;
}

/** Marks a canvas as a direct trash root or restores it. */
export function setCanvasDeletedAt(
  workspace: WorkspaceTrashData,
  canvasId: string,
  deletedAt: number | null,
  updatedAt = Date.now(),
): boolean {
  const canvas = (workspace.canvasFiles ?? []).find(item => item.id === canvasId);
  if (!canvas) return false;
  if (deletedAt === null) {
    canvas.deletedAt = null;
    canvas.updatedAt = updatedAt;
    delete canvas.deletedByAncestorId;
  } else markDirectlyDeleted(canvas, deletedAt, updatedAt);
  return true;
}

/** Applies a section deletion/restore to its pages and section-owned canvases. */
export function setSectionDeletedAt(
  workspace: WorkspaceTrashData,
  sectionId: string,
  deletedAt: number | null,
  updatedAt = Date.now(),
): boolean {
  const section = (workspace.notebookSections ?? []).find(item => item.id === sectionId);
  if (!section) return false;
  const sectionDeletedAt = section.deletedAt;

  if (deletedAt === null) {
    section.deletedAt = null;
    section.updatedAt = updatedAt;
    delete section.deletedByAncestorId;
    for (const item of [...(workspace.notebookPages ?? []), ...(workspace.canvasFiles ?? [])]) {
      if (item.sectionId === sectionId) clearAncestorDeletion(item, sectionId, updatedAt, sectionDeletedAt);
    }
  } else {
    markDirectlyDeleted(section, deletedAt, updatedAt);
    for (const item of [...(workspace.notebookPages ?? []), ...(workspace.canvasFiles ?? [])]) {
      if (item.sectionId === sectionId) markDeletedByAncestor(item, deletedAt, sectionId, updatedAt);
    }
  }
  return true;
}

/** Marks a workspace's currently-live descendants without overwriting direct deletes. */
export function setWorkspaceDeletedAt(
  workspace: WorkspaceTrashData,
  workspaceId: string,
  deletedAt: number | null,
  updatedAt = Date.now(),
): boolean {
  const root = (workspace.workspaces ?? []).find(item => item.id === workspaceId);
  if (!root) return false;
  const rootDeletedAt = root.deletedAt;

  if (deletedAt === null) {
    root.deletedAt = null;
    root.updatedAt = updatedAt;
    delete root.deletedByAncestorId;
    for (const record of [
      ...(workspace.folders ?? []),
      ...(workspace.canvasFiles ?? []),
      ...(workspace.notebooks ?? []),
      ...(workspace.notebookSections ?? []),
      ...(workspace.notebookPages ?? []),
    ]) clearAncestorDeletion(record, workspaceId, updatedAt, rootDeletedAt);
  } else {
    markDirectlyDeleted(root, deletedAt, updatedAt);
    for (const record of [
      ...(workspace.folders ?? []),
      ...(workspace.canvasFiles ?? []),
      ...(workspace.notebooks ?? []),
      ...(workspace.notebookSections ?? []),
      ...(workspace.notebookPages ?? []),
    ]) {
      const belongsToWorkspace = record.workspaceId === workspaceId
        || (record.notebookId && (workspace.notebooks ?? []).some(notebook => notebook.id === record.notebookId && notebook.workspaceId === workspaceId))
        || (record.sectionId && (workspace.notebookSections ?? []).some(section => section.id === record.sectionId && (workspace.notebooks ?? []).some(notebook => notebook.id === section.notebookId && notebook.workspaceId === workspaceId)));
      if (belongsToWorkspace) markDeletedByAncestor(record, deletedAt, workspaceId, updatedAt);
    }
  }
  return true;
}

/** Returns only directly deleted roots; descendants remain internally persisted. */
export function getDeletedWorkspaceItems(workspace: WorkspaceTrashData) {
  const roots = getTrashRoots(workspace);
  return {
    workspaces: roots.workspaces,
    folders: roots.folders,
    canvasFiles: roots.canvasFiles,
    notebooks: roots.notebooks,
    sections: roots.sections,
    pages: roots.pages,
  };
}
