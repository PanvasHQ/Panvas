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
    const workspace = await workspaceDB.createWorkspace(userId, name);
    await this.queueSync('workspace', workspace.id, 'create', workspace);
    return workspace;
  }

  async rename(userId: string | null, id: string, name: string): Promise<void> {
    await workspaceDB.renameWorkspace(id, name);
    const updated = await workspaceDB.getWorkspaceById(userId, id);
    if (updated) {
      await this.queueSync('workspace', id, 'update', updated);
    }
  }

  async delete(id: string): Promise<void> {
    await workspaceDB.deleteWorkspace(id, true); // soft delete
    await this.queueSync('workspace', id, 'delete', { id });
  }

  async getAll(userId: string | null): Promise<Workspace[]> {
    return workspaceDB.getAllWorkspaces(userId);
  }

  async getById(userId: string | null, id: string): Promise<Workspace | undefined> {
    return workspaceDB.getWorkspaceById(userId, id);
  }

  async togglePin(userId: string | null, id: string): Promise<void> {
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
