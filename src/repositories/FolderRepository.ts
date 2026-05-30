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
    const folder = await workspaceDB.createFolder(userId, workspaceId, parentId, name);
    await this.queueSync('folder', folder.id, 'create', folder);
    return folder;
  }

  async rename(id: string, name: string): Promise<void> {
    await workspaceDB.renameFolder(id, name);
    const updated = await db.folders.get(id);
    if (updated) {
      await this.queueSync('folder', id, 'update', updated);
    }
  }

  async delete(id: string): Promise<void> {
    await workspaceDB.deleteFolder(id, true); // soft delete
    await this.queueSync('folder', id, 'delete', { id });
  }

  async getByWorkspace(userId: string | null, workspaceId: string): Promise<Folder[]> {
    return workspaceDB.getFoldersByWorkspace(userId, workspaceId);
  }

  async toggleExpanded(id: string): Promise<void> {
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
