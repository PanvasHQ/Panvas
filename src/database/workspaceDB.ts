// ============================================
// Panvas — Workspace DB Operations
// ============================================

import { db } from './schema';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import { generateId } from '@/lib/utils/id';

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
    // Soft delete: mark as deleted, will be synced then purged
    const now = Date.now();
    await db.transaction('rw', [db.workspaces, db.folders, db.canvasFiles], async () => {
      await db.workspaces.update(id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' });
      // Also soft-delete children
      const canvases = await db.canvasFiles.where('workspaceId').equals(id).toArray();
      for (const canvas of canvases) {
        await db.canvasFiles.update(canvas.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' });
      }
      const folders = await db.folders.where('workspaceId').equals(id).toArray();
      for (const folder of folders) {
        await db.folders.update(folder.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' });
      }
    });
  } else {
    // Hard delete: remove from IndexedDB entirely
    await db.transaction('rw', [db.workspaces, db.folders, db.canvasFiles, db.canvasData, db.customBlocks], async () => {
      const canvases = await db.canvasFiles.where('workspaceId').equals(id).toArray();
      for (const canvas of canvases) {
        await db.canvasData.delete(canvas.id);
        await db.customBlocks.where('canvasFileId').equals(canvas.id).delete();
      }
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
    .filter(ws => ws.userId === userId && (ws.deletedAt === null || ws.deletedAt === undefined))
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
  await db.transaction('rw', [db.workspaces, db.folders, db.canvasFiles], async () => {
    await db.workspaces.update(id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
    const canvases = await db.canvasFiles.where('workspaceId').equals(id).toArray();
    for (const canvas of canvases) {
      if (canvas.deletedAt) await db.canvasFiles.update(canvas.id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
    }
    const folders = await db.folders.where('workspaceId').equals(id).toArray();
    for (const folder of folders) {
      if (folder.deletedAt) await db.folders.update(folder.id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
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
    await db.transaction('rw', [db.folders, db.canvasFiles], async () => {
      await db.folders.update(id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' });
      // Soft-delete subfolders recursively
      const subfolders = await db.folders.where('parentId').equals(id).toArray();
      for (const sub of subfolders) {
        await deleteFolder(sub.id, true);
      }
      // Soft-delete canvases
      const canvases = await db.canvasFiles.where('folderId').equals(id).toArray();
      for (const canvas of canvases) {
        await db.canvasFiles.update(canvas.id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' });
      }
    });
  } else {
    await db.transaction('rw', [db.folders, db.canvasFiles, db.canvasData, db.customBlocks], async () => {
      const subfolders = await db.folders.where('parentId').equals(id).toArray();
      for (const sub of subfolders) {
        await deleteFolder(sub.id, false);
      }
      const canvases = await db.canvasFiles.where('folderId').equals(id).toArray();
      for (const canvas of canvases) {
        await db.canvasData.delete(canvas.id);
        await db.customBlocks.where('canvasFileId').equals(canvas.id).delete();
      }
      await db.canvasFiles.where('folderId').equals(id).delete();
      await db.folders.delete(id);
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
  await db.transaction('rw', [db.folders, db.canvasFiles], async () => {
    await db.folders.update(id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
    const subfolders = await db.folders.where('parentId').equals(id).toArray();
    for (const sub of subfolders) {
      if (sub.deletedAt) await db.folders.update(sub.id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
    }
    const canvases = await db.canvasFiles.where('folderId').equals(id).toArray();
    for (const canvas of canvases) {
      if (canvas.deletedAt) await db.canvasFiles.update(canvas.id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
    }
  });
}

// ---- Canvas Files ----

export async function createCanvasFile(userId: string | null, workspaceId: string, folderId: string | null, name: string): Promise<CanvasFile> {
  const now = Date.now();
  const canvas: CanvasFile = {
    id: generateId('canvas'),
    workspaceId,
    folderId,
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
    await db.canvasFiles.update(id, { deletedAt: now, updatedAt: now, syncStatus: 'pending' });
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
    .filter(c => c.userId === userId && (c.deletedAt === null || c.deletedAt === undefined))
    .sortBy('order');
}

export async function getAnyCanvasFileById(userId: string | null, id: string): Promise<CanvasFile | undefined> {
  const cf = await db.canvasFiles.get(id);
  return cf?.userId === userId ? cf : undefined;
}

export async function getAllCanvasFiles(userId: string | null): Promise<CanvasFile[]> {
  return db.canvasFiles
    .filter(c => c.userId === userId && (c.deletedAt === null || c.deletedAt === undefined))
    .sortBy('order');
}

export async function getCanvasFilesByFolder(userId: string | null, workspaceId: string, folderId: string | null): Promise<CanvasFile[]> {
  if (folderId) {
    return db.canvasFiles
      .where({ workspaceId, folderId })
      .filter(c => c.userId === userId && (c.deletedAt === null || c.deletedAt === undefined))
      .sortBy('order');
  }
  return db.canvasFiles
    .where('workspaceId').equals(workspaceId)
    .filter(c => c.userId === userId && (c.folderId === null) && (c.deletedAt === null || c.deletedAt === undefined))
    .sortBy('order');
}

export async function getRecentCanvasFiles(userId: string | null, limit: number = 10): Promise<CanvasFile[]> {
  const all = await db.canvasFiles
    .orderBy('lastOpenedAt')
    .reverse()
    .filter(c => c.userId === userId && (c.deletedAt === null || c.deletedAt === undefined))
    .limit(limit)
    .toArray();
  return all;
}

export async function updateCanvasLastOpened(id: string): Promise<void> {
  await db.canvasFiles.update(id, { lastOpenedAt: Date.now() });
}

export async function togglePinCanvas(id: string): Promise<void> {
  const canvas = await db.canvasFiles.get(id);
  if (canvas) {
    await db.canvasFiles.update(id, { isPinned: !canvas.isPinned, syncStatus: 'pending' });
  }
}

export async function moveCanvasFile(id: string, newWorkspaceId: string, newFolderId: string | null): Promise<void> {
  await db.canvasFiles.update(id, { workspaceId: newWorkspaceId, folderId: newFolderId, updatedAt: Date.now(), syncStatus: 'pending' });
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
  await db.canvasFiles.update(id, { deletedAt: null, updatedAt: Date.now(), syncStatus: 'pending' });
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

export async function getDeletedItems(userId: string | null): Promise<{ workspaces: Workspace[], folders: Folder[], canvasFiles: CanvasFile[] }> {
  const workspaces = await db.workspaces
    .filter(ws => ws.userId === userId && ws.deletedAt !== null && ws.deletedAt !== undefined)
    .toArray();
  const folders = await db.folders
    .filter(f => f.userId === userId && f.deletedAt !== null && f.deletedAt !== undefined)
    .toArray();
  const canvasFiles = await db.canvasFiles
    .filter(c => c.userId === userId && c.deletedAt !== null && c.deletedAt !== undefined)
    .toArray();
  
  return { workspaces, folders, canvasFiles };
}
