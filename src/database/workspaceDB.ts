// ============================================
// Panvas — Workspace DB Operations
// ============================================

import { db } from './schema';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import { generateId } from '@/lib/utils/id';
import { clearAncestorDeletion, getTrashRoots, markDeletedByAncestor, markDirectlyDeleted } from '@/services/library/trashModel';

// ---- Workspaces ----

export async function createWorkspace(userId: string | null, name: string): Promise<Workspace> {
  const now = Date.now();
  const workspace: Workspace = {
    id: generateId('ws'),
    name,
    createdAt: now,
    updatedAt: now,
    isPinned: false,
    syncStatus: userId ? 'pending' : 'local',
    userId: userId,
    deletedAt: null,
  };
  await db.workspaces.add(workspace);
  return workspace;
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  await db.workspaces.update(id, { name, updatedAt: Date.now(), syncStatus: 'pending' });
}

export async function deleteWorkspace(id: string, soft = true): Promise<void> {
  if (soft) {
    const now = Date.now();
    await db.transaction('rw', [db.workspaces, db.folders, db.canvasFiles, db.notebooks, db.notebookSections, db.notebookPages], async () => {
      const workspace = await db.workspaces.get(id);
      if (!workspace) return;
      markDirectlyDeleted(workspace, now);
      workspace.syncStatus = 'pending';
      await db.workspaces.put(workspace);

      const [folders, canvases, notebooks, sections, pages] = await Promise.all([
        db.folders.where('workspaceId').equals(id).toArray(),
        db.canvasFiles.where('workspaceId').equals(id).toArray(),
        db.notebooks.where('workspaceId').equals(id).toArray(),
        db.notebookSections.toArray(),
        db.notebookPages.toArray(),
      ]);
      for (const folder of folders) {
        markDeletedByAncestor(folder, now, id);
        folder.syncStatus = 'pending';
        await db.folders.put(folder);
      }
      for (const notebook of notebooks) {
        markDeletedByAncestor(notebook, now, id);
        await db.notebooks.put(notebook);
      }
      for (const section of sections.filter(item => notebooks.some(notebook => notebook.id === item.notebookId))) {
        markDeletedByAncestor(section, now, id);
        await db.notebookSections.put(section);
      }
      for (const page of pages.filter(item => notebooks.some(notebook => notebook.id === item.notebookId))) {
        markDeletedByAncestor(page, now, id);
        await db.notebookPages.put(page);
      }
      for (const canvas of canvases) {
        markDeletedByAncestor(canvas, now, id);
        canvas.syncStatus = 'pending';
        await db.canvasFiles.put(canvas);
      }
    });
  } else {
    // Hard delete: remove from IndexedDB entirely
    await db.transaction('rw', [
      db.workspaces, db.folders, db.canvasFiles, db.canvasData, db.customBlocks,
      db.pdfFiles, db.imageFiles, db.notebooks, db.notebookSections, db.notebookPages,
      db.notebookPageContents, db.notebookPageDrawings,
    ], async () => {
      const canvases = await db.canvasFiles.where('workspaceId').equals(id).toArray();
      const notebooks = await db.notebooks.where('workspaceId').equals(id).toArray();
      const notebookIds = new Set(notebooks.map(notebook => notebook.id));
      const sections = (await db.notebookSections.toArray()).filter(section => notebookIds.has(section.notebookId));
      const sectionIds = new Set(sections.map(section => section.id));
      const pages = (await db.notebookPages.toArray()).filter(page => notebookIds.has(page.notebookId) || sectionIds.has(page.sectionId));
      for (const canvas of canvases) {
        await db.canvasData.delete(canvas.id);
        await db.customBlocks.where('canvasFileId').equals(canvas.id).delete();
        await db.pdfFiles.where('canvasFileId').equals(canvas.id).delete();
        await db.imageFiles.where('canvasFileId').equals(canvas.id).delete();
      }
      for (const page of pages) {
        await db.notebookPageContents.delete(page.id);
        await db.notebookPageDrawings.delete(page.id);
      }
      await db.notebookPages.bulkDelete(pages.map(page => page.id));
      await db.notebookSections.bulkDelete(sections.map(section => section.id));
      await db.notebooks.bulkDelete(notebooks.map(notebook => notebook.id));
      await db.canvasFiles.where('workspaceId').equals(id).delete();
      await db.folders.where('workspaceId').equals(id).delete();
      await db.workspaces.delete(id);
    });
  }
}

export async function togglePinWorkspace(id: string): Promise<void> {
  const workspace = await db.workspaces.get(id);
  if (workspace) {
    await db.workspaces.update(id, { isPinned: !workspace.isPinned, syncStatus: 'pending' });
  }
}

export async function getAllWorkspaces(userId: string | null): Promise<Workspace[]> {
  return db.workspaces
    .filter(ws => (ws.userId ?? null) === (userId ?? null) && (ws.deletedAt === null || ws.deletedAt === undefined))
    .reverse()
    .sortBy('updatedAt');
}

export async function getWorkspaceById(userId: string | null, id: string): Promise<Workspace | undefined> {
  const ws = await db.workspaces.get(id);
  return ws?.userId === userId && !ws.deletedAt ? ws : undefined;
}

export async function getAnyWorkspaceById(userId: string | null, id: string): Promise<Workspace | undefined> {
  const ws = await db.workspaces.get(id);
  return ws?.userId === userId ? ws : undefined;
}

export async function restoreWorkspace(id: string): Promise<void> {
  await db.transaction('rw', [db.workspaces, db.folders, db.canvasFiles, db.notebooks, db.notebookSections, db.notebookPages], async () => {
    const workspace = await db.workspaces.get(id);
    if (!workspace) return;
    const now = Date.now();
    const workspaceDeletedAt = workspace.deletedAt;
    workspace.deletedAt = null;
    workspace.updatedAt = now;
    workspace.syncStatus = 'pending';
    delete workspace.deletedByAncestorId;
    await db.workspaces.put(workspace);

    const [folders, canvases, notebooks, sections, pages] = await Promise.all([
      db.folders.where('workspaceId').equals(id).toArray(),
      db.canvasFiles.where('workspaceId').equals(id).toArray(),
      db.notebooks.where('workspaceId').equals(id).toArray(),
      db.notebookSections.toArray(),
      db.notebookPages.toArray(),
    ]);
    for (const folder of folders) {
      clearAncestorDeletion(folder, id, now, workspaceDeletedAt);
      if (!folder.deletedAt) folder.syncStatus = 'pending';
      await db.folders.put(folder);
    }
    for (const notebook of notebooks) {
      clearAncestorDeletion(notebook, id, now, workspaceDeletedAt);
      await db.notebooks.put(notebook);
    }
    const notebookIds = new Set(notebooks.map(notebook => notebook.id));
    for (const section of sections.filter(item => notebookIds.has(item.notebookId))) {
      clearAncestorDeletion(section, id, now, workspaceDeletedAt);
      await db.notebookSections.put(section);
    }
    for (const page of pages.filter(item => notebookIds.has(item.notebookId))) {
      clearAncestorDeletion(page, id, now, workspaceDeletedAt);
      await db.notebookPages.put(page);
    }
    for (const canvas of canvases) {
      clearAncestorDeletion(canvas, id, now, workspaceDeletedAt);
      if (!canvas.deletedAt) canvas.syncStatus = 'pending';
      await db.canvasFiles.put(canvas);
    }
  });
}

// ---- Folders ----

export async function createFolder(userId: string | null, workspaceId: string, parentId: string | null, name: string): Promise<Folder> {
  const now = Date.now();
  const siblings = await db.folders
    .where({ workspaceId, parentId: parentId ?? '' })
    .count();

  const folder: Folder = {
    id: generateId('folder'),
    workspaceId,
    parentId,
    name,
    createdAt: now,
    updatedAt: now,
    order: siblings,
    isExpanded: true,
    syncStatus: userId ? 'pending' : 'local',
    userId: userId,
    deletedAt: null,
  };
  await db.folders.add(folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await db.folders.update(id, { name, updatedAt: Date.now(), syncStatus: 'pending' });
}

export async function updateFolderAppearance(id: string, appearance: Pick<Folder, 'color' | 'icon'>): Promise<void> {
  await db.folders.update(id, { ...appearance, updatedAt: Date.now(), syncStatus: 'pending' });
}

export async function moveFolder(id: string, newWorkspaceId: string, newParentId: string | null = null): Promise<void> {
  // We must move the folder AND all its children (canvases & notebooks) to the new workspace/parent
  await db.transaction('rw', [db.folders, db.canvasFiles, db.notebooks], async () => {
    await db.folders.update(id, { workspaceId: newWorkspaceId, parentId: newParentId, updatedAt: Date.now(), syncStatus: 'pending' });
    const canvases = await db.canvasFiles.where('folderId').equals(id).toArray();
    for (const canvas of canvases) {
      await db.canvasFiles.update(canvas.id, { workspaceId: newWorkspaceId, updatedAt: Date.now(), syncStatus: 'pending' });
    }
    const notebooks = await db.notebooks.where('folderId').equals(id).toArray();
    for (const notebook of notebooks) {
      await db.notebooks.update(notebook.id, { workspaceId: newWorkspaceId, updatedAt: Date.now() });
    }
  });
}

export async function deleteFolder(id: string, soft = true): Promise<void> {
  if (soft) {
    const now = Date.now();
    await db.transaction('rw', [db.folders, db.canvasFiles, db.notebooks, db.notebookSections, db.notebookPages], async () => {
      const root = await db.folders.get(id);
      if (!root) return;
      markDirectlyDeleted(root, now);
      root.syncStatus = 'pending';
      await db.folders.put(root);

      const [folders, canvases, notebooks, sections, pages] = await Promise.all([
        db.folders.toArray(),
        db.canvasFiles.toArray(),
        db.notebooks.toArray(),
        db.notebookSections.toArray(),
        db.notebookPages.toArray(),
      ]);
      const descendantFolderIds = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of folders) {
          if (folder.parentId && descendantFolderIds.has(folder.parentId) && !descendantFolderIds.has(folder.id)) {
            descendantFolderIds.add(folder.id);
            changed = true;
          }
        }
      }
      for (const folder of folders) {
        if (!descendantFolderIds.has(folder.id) || folder.id === id) continue;
        markDeletedByAncestor(folder, now, id);
        folder.syncStatus = 'pending';
        await db.folders.put(folder);
      }
      const notebookIds = new Set(notebooks.filter(notebook => notebook.folderId !== null && descendantFolderIds.has(notebook.folderId)).map(notebook => notebook.id));
      for (const notebook of notebooks) {
        if (!notebookIds.has(notebook.id)) continue;
        markDeletedByAncestor(notebook, now, id);
        await db.notebooks.put(notebook);
      }
      for (const section of sections.filter(item => notebookIds.has(item.notebookId))) {
        markDeletedByAncestor(section, now, id);
        await db.notebookSections.put(section);
      }
      for (const page of pages.filter(item => notebookIds.has(item.notebookId))) {
        markDeletedByAncestor(page, now, id);
        await db.notebookPages.put(page);
      }
      for (const canvas of canvases) {
        const belongs = (canvas.folderId !== null && descendantFolderIds.has(canvas.folderId))
          || (canvas.notebookId != null && notebookIds.has(canvas.notebookId))
          || (canvas.sectionId != null && sections.some(section => section.id === canvas.sectionId && notebookIds.has(section.notebookId)));
        if (!belongs) continue;
        markDeletedByAncestor(canvas, now, id);
        canvas.syncStatus = 'pending';
        await db.canvasFiles.put(canvas);
      }
    });
  } else {
    await db.transaction('rw', [
      db.folders, db.canvasFiles, db.canvasData, db.customBlocks,
      db.pdfFiles, db.imageFiles, db.notebooks, db.notebookSections, db.notebookPages,
      db.notebookPageContents, db.notebookPageDrawings,
    ], async () => {
      const folders = await db.folders.toArray();
      const folderIds = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of folders) {
          if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
            folderIds.add(folder.id);
            changed = true;
          }
        }
      }
      const notebooks = (await db.notebooks.toArray()).filter(notebook => notebook.folderId != null && folderIds.has(notebook.folderId));
      const notebookIds = new Set(notebooks.map(notebook => notebook.id));
      const sections = (await db.notebookSections.toArray()).filter(section => notebookIds.has(section.notebookId));
      const sectionIds = new Set(sections.map(section => section.id));
      const pages = (await db.notebookPages.toArray()).filter(page => notebookIds.has(page.notebookId) || sectionIds.has(page.sectionId));
      const canvases = (await db.canvasFiles.toArray()).filter(canvas => (
        (canvas.folderId != null && folderIds.has(canvas.folderId))
        || (canvas.notebookId != null && notebookIds.has(canvas.notebookId))
        || (canvas.sectionId != null && sectionIds.has(canvas.sectionId))
      ));
      for (const canvas of canvases) {
        await db.canvasData.delete(canvas.id);
        await db.customBlocks.where('canvasFileId').equals(canvas.id).delete();
        await db.pdfFiles.where('canvasFileId').equals(canvas.id).delete();
        await db.imageFiles.where('canvasFileId').equals(canvas.id).delete();
      }
      for (const page of pages) {
        await db.notebookPageContents.delete(page.id);
        await db.notebookPageDrawings.delete(page.id);
      }
      await db.notebookPages.bulkDelete(pages.map(page => page.id));
      await db.notebookSections.bulkDelete(sections.map(section => section.id));
      await db.notebooks.bulkDelete(notebooks.map(notebook => notebook.id));
      await db.canvasFiles.bulkDelete(canvases.map(canvas => canvas.id));
      await db.folders.bulkDelete([...folderIds]);
    });
  }
}

export async function toggleFolderExpanded(id: string): Promise<void> {
  const folder = await db.folders.get(id);
  if (folder) {
    await db.folders.update(id, { isExpanded: !folder.isExpanded });
  }
}

export async function getFoldersByWorkspace(userId: string | null, workspaceId: string): Promise<Folder[]> {
  return db.folders
    .where('workspaceId').equals(workspaceId)
    .filter(f => f.userId === userId && (f.deletedAt === null || f.deletedAt === undefined))
    .sortBy('order');
}

export async function getAllFolders(userId: string | null): Promise<Folder[]> {
  return db.folders
    .filter(f => f.userId === userId && (f.deletedAt === null || f.deletedAt === undefined))
    .sortBy('order');
}

export async function getAnyFolderById(userId: string | null, id: string): Promise<Folder | undefined> {
  const f = await db.folders.get(id);
  return f?.userId === userId ? f : undefined;
}

export async function restoreFolder(id: string): Promise<void> {
  await db.transaction('rw', [db.folders, db.canvasFiles, db.notebooks, db.notebookSections, db.notebookPages], async () => {
    const now = Date.now();
    const [folders, canvases, notebooks, sections, pages] = await Promise.all([
      db.folders.toArray(), db.canvasFiles.toArray(), db.notebooks.toArray(), db.notebookSections.toArray(), db.notebookPages.toArray(),
    ]);
    const folderIds = new Set<string>([id]);
    const rootFolder = folders.find(folder => folder.id === id);
    const rootFolderDeletedAt = rootFolder?.deletedAt;
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
        folderIds.add(folder.id);
        changed = true;
      }
    }
    const notebookIds = new Set(notebooks.filter(notebook => notebook.folderId !== null && folderIds.has(notebook.folderId)).map(notebook => notebook.id));
    const sectionIds = new Set(sections.filter(section => notebookIds.has(section.notebookId)).map(section => section.id));
    for (const folder of folders) if (folderIds.has(folder.id)) {
      if (folder.id === id) { folder.deletedAt = null; delete folder.deletedByAncestorId; folder.updatedAt = now; }
      else clearAncestorDeletion(folder, id, now, rootFolderDeletedAt);
      if (!folder.deletedAt) folder.syncStatus = 'pending';
      await db.folders.put(folder);
    }
    for (const notebook of notebooks) if (notebookIds.has(notebook.id)) { clearAncestorDeletion(notebook, id, now, rootFolderDeletedAt); await db.notebooks.put(notebook); }
    for (const section of sections) if (notebookIds.has(section.notebookId)) { clearAncestorDeletion(section, id, now, rootFolderDeletedAt); await db.notebookSections.put(section); }
    for (const page of pages) if (notebookIds.has(page.notebookId)) { clearAncestorDeletion(page, id, now, rootFolderDeletedAt); await db.notebookPages.put(page); }
    for (const canvas of canvases) {
      const belongs = (canvas.folderId !== null && folderIds.has(canvas.folderId)) || (canvas.notebookId != null && notebookIds.has(canvas.notebookId)) || (canvas.sectionId != null && sectionIds.has(canvas.sectionId));
      if (belongs) { clearAncestorDeletion(canvas, id, now, rootFolderDeletedAt); if (!canvas.deletedAt) canvas.syncStatus = 'pending'; await db.canvasFiles.put(canvas); }
    }
  });
}

// ---- Canvas Files ----

export async function createCanvasFile(userId: string | null, workspaceId: string, folderId: string | null, notebookId: string | null, sectionId: string | null, name: string): Promise<CanvasFile> {
  const now = Date.now();
  const canvas: CanvasFile = {
    id: generateId('canvas'),
    workspaceId,
    folderId,
    notebookId,
    sectionId,
    name,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    order: 0,
    isPinned: false,
    syncStatus: userId ? 'pending' : 'local',
    userId: userId,
    deletedAt: null,
  };

  await db.transaction('rw', [db.canvasFiles, db.canvasData], async () => {
    await db.canvasFiles.add(canvas);
    await db.canvasData.add({
      canvasFileId: canvas.id,
      elements: [],
      appState: {},
      files: {},
      customBlocks: [],
      version: 1,
      updatedAt: now,
      userId: userId,
    });
  });

  return canvas;
}

export async function renameCanvasFile(id: string, name: string): Promise<void> {
  await db.canvasFiles.update(id, { name, updatedAt: Date.now(), syncStatus: 'pending' });
}

export async function deleteCanvasFile(id: string, soft = true): Promise<void> {
  if (soft) {
    const now = Date.now();
    const canvas = await db.canvasFiles.get(id);
    if (canvas) {
      markDirectlyDeleted(canvas, now);
      canvas.syncStatus = 'pending';
      await db.canvasFiles.put(canvas);
    }
  } else {
    await db.transaction('rw', [db.canvasFiles, db.canvasData, db.customBlocks], async () => {
      await db.canvasData.delete(id);
      await db.customBlocks.where('canvasFileId').equals(id).delete();
      await db.canvasFiles.delete(id);
    });
  }
}

export async function getCanvasFilesByWorkspace(userId: string | null, workspaceId: string): Promise<CanvasFile[]> {
  return db.canvasFiles
    .where('workspaceId').equals(workspaceId)
    .filter(c => (c.userId ?? null) === (userId ?? null) && (c.deletedAt === null || c.deletedAt === undefined))
    .sortBy('order');
}

export async function getAnyCanvasFileById(userId: string | null, id: string): Promise<CanvasFile | undefined> {
  const cf = await db.canvasFiles.get(id);
  return (cf?.userId ?? null) === (userId ?? null) ? cf : undefined;
}

export async function getAllCanvasFiles(userId: string | null): Promise<CanvasFile[]> {
  return db.canvasFiles
    .filter(c => (c.userId ?? null) === (userId ?? null) && (c.deletedAt === null || c.deletedAt === undefined))
    .sortBy('order');
}

export async function getCanvasFilesByFolder(userId: string | null, workspaceId: string, folderId: string | null): Promise<CanvasFile[]> {
  if (folderId) {
    return db.canvasFiles
      .where({ workspaceId, folderId })
      .filter(c => (c.userId ?? null) === (userId ?? null) && (c.deletedAt === null || c.deletedAt === undefined))
      .sortBy('order');
  }
  return db.canvasFiles
    .where('workspaceId').equals(workspaceId)
    .filter(c => (c.userId ?? null) === (userId ?? null) && (c.folderId === null) && (c.deletedAt === null || c.deletedAt === undefined))
    .sortBy('order');
}

export async function getRecentCanvasFiles(userId: string | null, limit: number = 10): Promise<CanvasFile[]> {
  const all = await db.canvasFiles
    .filter(c => (c.userId ?? null) === (userId ?? null) && (c.deletedAt === null || c.deletedAt === undefined))
    .toArray();
  return all
    .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt) - (a.lastOpenedAt ?? a.updatedAt))
    .slice(0, limit);
}

export async function updateCanvasLastOpened(id: string, openedAt = Date.now()): Promise<void> {
  await db.canvasFiles.update(id, { lastOpenedAt: openedAt });
}

export async function togglePinCanvas(id: string, isPinned?: boolean): Promise<void> {
  const canvas = await db.canvasFiles.get(id);
  if (canvas) {
    const nextPinned = typeof isPinned === 'boolean' ? isPinned : !canvas.isPinned;
    await db.canvasFiles.update(id, { isPinned: nextPinned, updatedAt: Date.now(), syncStatus: 'pending' });
  }
}

export async function moveCanvasFile(id: string, newWorkspaceId: string, newFolderId: string | null, newNotebookId: string | null, newSectionId: string | null): Promise<void> {
  await db.canvasFiles.update(id, { workspaceId: newWorkspaceId, folderId: newFolderId, notebookId: newNotebookId, sectionId: newSectionId, updatedAt: Date.now(), syncStatus: 'pending' });
}

export async function duplicateCanvasFile(userId: string | null, originalId: string): Promise<CanvasFile | null> {
  const originalCanvas = await db.canvasFiles.get(originalId);
  const originalData = await db.canvasData.get(originalId);
  const originalBlocks = await db.customBlocks.where('canvasFileId').equals(originalId).toArray();

  if (!originalCanvas || !originalData) return null;

  const now = Date.now();
  const newCanvas: CanvasFile = {
    ...originalCanvas,
    id: generateId('canvas'),
    name: `${originalCanvas.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    syncStatus: userId ? 'pending' : 'local',
  };

  const newData: typeof originalData = {
    ...originalData,
    canvasFileId: newCanvas.id,
    version: 1,
    updatedAt: now,
  };

  await db.transaction('rw', [db.canvasFiles, db.canvasData, db.customBlocks], async () => {
    await db.canvasFiles.add(newCanvas);
    await db.canvasData.add(newData);
    
    for (const block of originalBlocks) {
      const newBlock = {
        ...block,
        id: generateId('block'),
        canvasFileId: newCanvas.id,
        createdAt: now,
        updatedAt: now,
      };
      await db.customBlocks.add(newBlock);
    }
  });

  return newCanvas;
}

export async function restoreCanvasFile(id: string): Promise<void> {
  const canvas = await db.canvasFiles.get(id);
  if (canvas) {
    const now = Date.now();
    canvas.deletedAt = null;
    canvas.updatedAt = now;
    delete canvas.deletedByAncestorId;
    canvas.syncStatus = 'pending';
    await db.canvasFiles.put(canvas);
  }
}

// ---- Purge soft-deleted items (call after sync confirms deletion) ----

export async function purgeSoftDeleted(): Promise<void> {
  await db.transaction('rw', [db.workspaces, db.folders, db.canvasFiles, db.canvasData, db.customBlocks], async () => {
    const deletedCanvases = await db.canvasFiles.filter(c => c.deletedAt !== null && c.deletedAt !== undefined).toArray();
    for (const c of deletedCanvases) {
      await db.canvasData.delete(c.id);
      await db.customBlocks.where('canvasFileId').equals(c.id).delete();
      await db.canvasFiles.delete(c.id);
    }
    const deletedFolders = await db.folders.filter(f => f.deletedAt !== null && f.deletedAt !== undefined).toArray();
    for (const f of deletedFolders) {
      await db.folders.delete(f.id);
    }
    const deletedWorkspaces = await db.workspaces.filter(ws => ws.deletedAt !== null && ws.deletedAt !== undefined).toArray();
    for (const ws of deletedWorkspaces) {
      await db.workspaces.delete(ws.id);
    }
  });
}

export async function getDeletedItems(userId: string | null) {
  return db.transaction('r', [db.workspaces, db.folders, db.canvasFiles, db.notebooks, db.notebookSections, db.notebookPages], async () => getTrashRoots({
    workspaces: await db.workspaces.filter(ws => (ws.userId ?? null) === (userId ?? null)).toArray(),
    folders: await db.folders.filter(folder => (folder.userId ?? null) === (userId ?? null)).toArray(),
    canvasFiles: await db.canvasFiles.filter(canvas => (canvas.userId ?? null) === (userId ?? null)).toArray(),
    notebooks: await db.notebooks.filter(notebook => (notebook.userId ?? null) === (userId ?? null)).toArray(),
    notebookSections: await db.notebookSections.filter(section => (section.userId ?? null) === (userId ?? null)).toArray(),
    notebookPages: await db.notebookPages.filter(page => (page.userId ?? null) === (userId ?? null)).toArray(),
  }));
}
