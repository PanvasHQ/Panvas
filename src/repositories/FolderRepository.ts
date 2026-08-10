// ============================================
// Panvas — Folder Repository
// Bridges local DB ↔ Sync Queue ↔ Supabase
// ============================================

import * as workspaceDB from '@/database/workspaceDB';
import { db } from '@/database/schema';
import type { Folder } from '@/types/workspace';
import type { SyncQueueItem } from '@/types/sync';

export class FolderRepository {
  // ---- Local CRUD ----

  async create(userId: string | null, workspaceId: string, parentId: string | null, name: string): Promise<Folder> {
    if (typeof window !== 'undefined' && window.panvas) {
      return await window.panvas.folder.create(workspaceId, name, parentId);
    }
    const folder = await workspaceDB.createFolder(userId, workspaceId, parentId, name);
    await this.queueSync('folder', folder.id, 'create', folder);
    return folder;
  }

  async rename(userId: string | null, workspaceId: string, id: string, name: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.folder.update(workspaceId, id, { name });
      return;
    }
    await workspaceDB.renameFolder(id, name);
    const updated = await db.folders.get(id);
    if (updated) {
      await this.queueSync('folder', id, 'update', updated);
    }
  }

  async move(userId: string | null, id: string, workspaceId: string, parentId: string | null): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      // NOTE: workspaceId parameter is the NEW workspaceId.
      // We assume the old workspaceId is the same since cross-workspace moves aren't implemented fully yet,
      // or we pass the current active workspaceId from store.
      await window.panvas.folder.update(workspaceId, id, { workspaceId, parentId });
      return;
    }
    await workspaceDB.moveFolder(id, workspaceId, parentId);
    const updated = await db.folders.get(id);
    if (updated) {
      await this.queueSync('folder', id, 'update', updated);
    }
  }

  async delete(userId: string | null, workspaceId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.folder.update(workspaceId, id, { deletedAt: Date.now() });
      return;
    }
    await workspaceDB.deleteFolder(id, true); // soft delete
    const deleted = await db.folders.get(id);
    if (deleted) {
      await this.queueSync('folder', id, 'update', deleted);
    }
    const subfolders = await db.folders.where('parentId').equals(id).toArray();
    for (const sub of subfolders) {
      if (sub.deletedAt) await this.queueSync('folder', sub.id, 'update', sub);
    }
    const canvases = await db.canvasFiles.where('folderId').equals(id).toArray();
    for (const c of canvases) {
      if (c.deletedAt) await this.queueSync('canvasFile', c.id, 'update', c);
    }
  }

  async restore(userId: string | null, workspaceId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.folder.update(workspaceId, id, { deletedAt: null });
      return;
    }
    await workspaceDB.restoreFolder(id);
    const updated = await db.folders.get(id);
    if (updated) {
      await this.queueSync('folder', id, 'update', updated);
    }
    const subfolders = await db.folders.where('parentId').equals(id).toArray();
    for (const sub of subfolders) {
      if (!sub.deletedAt) await this.queueSync('folder', sub.id, 'update', sub);
    }
    const canvases = await db.canvasFiles.where('folderId').equals(id).toArray();
    for (const c of canvases) {
      if (!c.deletedAt) await this.queueSync('canvasFile', c.id, 'update', c);
    }
  }

  async permanentlyDelete(userId: string | null, workspaceId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.folder.delete(workspaceId, id);
      return;
    }
    await workspaceDB.deleteFolder(id, false);
    await this.queueSync('folder', id, 'delete', { id });
  }

  async getByWorkspace(userId: string | null, workspaceId: string): Promise<Folder[]> {
    return workspaceDB.getFoldersByWorkspace(userId, workspaceId);
  }

  async getAll(userId: string | null): Promise<Folder[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      // In the electron app context, all workspaces are loaded one by one 
      // but the UI currently expects a flattened array or just relies on the active workspace.
      // We will need the active workspace ID to get its folders.
      // A quick fix for now is to get folders for the active workspace, but wait - the UI 
      // calls getAll when loading all workspaces.
      // Wait, in WorkspaceStore:
      //   const activeWorkspaceId = get().activeWorkspaceId;
      // We need to fetch from IPC. But IPC folder.getAll needs wsId.
      // Since workspace.json contains folders, we actually need to loop over all workspaces, 
      // OR we just rely on `workspaceRepository.getAll()` returning everything, 
      // but the legacy app expects `FolderRepository.getAll()` to return everything from ALL workspaces.
      // Let's implement getting ALL folders from ALL workspaces via IPC.
      const workspaces = await window.panvas.workspace.getAll();
      let allFolders: Folder[] = [];
      for (const ws of workspaces) {
        const folders = await window.panvas.folder.getAll(ws.id);
        allFolders = allFolders.concat(folders.filter((f: any) => !f.deletedAt));
      }
      return allFolders;
    }
    return workspaceDB.getAllFolders(userId);
  }

  async toggleExpanded(workspaceId: string, id: string, isExpanded: boolean): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.folder.update(workspaceId, id, { isExpanded });
      return;
    }
    await workspaceDB.toggleFolderExpanded(id);
    // No sync needed for UI-only state
  }

  // ---- Sync helpers ----

  private async queueSync(
    entityType: SyncQueueItem['entityType'],
    entityId: string,
    action: SyncQueueItem['action'],
    data: unknown
  ): Promise<void> {
    try {
      await db.syncQueue.add({
        entityType,
        entityId,
        action,
        data,
        status: 'pending',
        attempts: 0,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('[FolderRepo] Failed to queue sync:', err);
    }
  }
}

export const folderRepository = new FolderRepository();
