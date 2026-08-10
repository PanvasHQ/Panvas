// ============================================
// Panvas — Workspace Repository
// Bridges local DB ↔ Sync Queue ↔ Supabase
// ============================================

import * as workspaceDB from '@/database/workspaceDB';
import { db } from '@/database/schema';
import type { Workspace } from '@/types/workspace';
import type { SyncQueueItem } from '@/types/sync';

export class WorkspaceRepository {
  // ---- Local CRUD ----

  async create(userId: string | null, name: string): Promise<Workspace> {
    if (typeof window !== 'undefined' && window.panvas) {
      return await window.panvas.workspace.create(name);
    }
    const workspace = await workspaceDB.createWorkspace(userId, name);
    await this.queueSync('workspace', workspace.id, 'create', workspace);
    return workspace;
  }

  async reorderItems(workspaceId: string, type: 'folder' | 'notebook' | 'canvas' | 'section' | 'page', itemIds: string[]): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.workspace.reorder(workspaceId, type, itemIds);
      return;
    }
  }

  async rename(userId: string | null, id: string, name: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.workspace.update(id, { name });
      return;
    }
    await workspaceDB.renameWorkspace(id, name);
    const updated = await workspaceDB.getWorkspaceById(userId, id);
    if (updated) {
      await this.queueSync('workspace', id, 'update', updated);
    }
  }

  async delete(id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.workspace.update(id, { deletedAt: Date.now() });
      return;
    }
    await workspaceDB.deleteWorkspace(id, true); // soft delete
    const deleted = await db.workspaces.get(id);
    if (deleted) {
      await this.queueSync('workspace', id, 'update', deleted);
    }
    const folders = await db.folders.where('workspaceId').equals(id).toArray();
    for (const f of folders) {
      if (f.deletedAt) await this.queueSync('folder', f.id, 'update', f);
    }
    const canvases = await db.canvasFiles.where('workspaceId').equals(id).toArray();
    for (const c of canvases) {
      if (c.deletedAt) await this.queueSync('canvasFile', c.id, 'update', c);
    }
  }

  async restore(userId: string | null, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.workspace.update(id, { deletedAt: null });
      return;
    }
    await workspaceDB.restoreWorkspace(id);
    const updated = await workspaceDB.getWorkspaceById(userId, id);
    if (updated) {
      await this.queueSync('workspace', id, 'update', updated);
    }
    const folders = await db.folders.where('workspaceId').equals(id).toArray();
    for (const f of folders) {
      if (!f.deletedAt) await this.queueSync('folder', f.id, 'update', f);
    }
    const canvases = await db.canvasFiles.where('workspaceId').equals(id).toArray();
    for (const c of canvases) {
      if (!c.deletedAt) await this.queueSync('canvasFile', c.id, 'update', c);
    }
  }

  async permanentlyDelete(id: string): Promise<void> {
    await workspaceDB.deleteWorkspace(id, false);
    await this.queueSync('workspace', id, 'delete', { id });
  }

  async getAll(userId: string | null): Promise<Workspace[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      return await window.panvas.workspace.getAll();
    }
    return workspaceDB.getAllWorkspaces(userId);
  }

  async getById(userId: string | null, id: string): Promise<Workspace | undefined> {
    return workspaceDB.getWorkspaceById(userId, id);
  }

  async togglePin(userId: string | null, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      const all = await window.panvas.workspace.getAll();
      const ws = all.find(w => w.id === id);
      if (ws) {
        await window.panvas.workspace.update(id, { isPinned: !ws.isPinned });
      }
      return;
    }
    await workspaceDB.togglePinWorkspace(id);
    const updated = await workspaceDB.getWorkspaceById(userId, id);
    if (updated) {
      await this.queueSync('workspace', id, 'update', updated);
    }
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
      // Sync queue failure should never block local operations
      console.warn('[WorkspaceRepo] Failed to queue sync:', err);
    }
  }
}

// Singleton instance
export const workspaceRepository = new WorkspaceRepository();
