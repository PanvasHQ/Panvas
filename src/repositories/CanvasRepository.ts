// ============================================
// Panvas — Canvas Repository
// Bridges local DB ↔ Sync Queue ↔ Supabase
// ============================================

import * as workspaceDB from '@/database/workspaceDB';
import * as canvasDB from '@/database/canvasDB';
import { db } from '@/database/schema';
import type { CanvasFile } from '@/types/workspace';
import type { CanvasData, CustomBlock, BlockType, PdfFileData } from '@/types/canvas';
import type { SyncQueueItem } from '@/types/sync';

export class CanvasRepository {
  // ---- Canvas File CRUD ----

  async create(userId: string | null, workspaceId: string, folderId: string | null, name: string): Promise<CanvasFile> {
    const canvas = await workspaceDB.createCanvasFile(userId, workspaceId, folderId, name);
    await this.queueSync('canvasFile', canvas.id, 'create', canvas);
    return canvas;
  }

  async rename(userId: string | null, id: string, name: string): Promise<void> {
    await workspaceDB.renameCanvasFile(id, name);
    const updated = await db.canvasFiles.get(id);
    if (updated) {
      await this.queueSync('canvasFile', id, 'update', updated);
    }
  }

  async delete(id: string): Promise<void> {
    await workspaceDB.deleteCanvasFile(id, true); // soft delete
    await this.queueSync('canvasFile', id, 'delete', { id });
  }

  async getByWorkspace(userId: string | null, workspaceId: string): Promise<CanvasFile[]> {
    return workspaceDB.getCanvasFilesByWorkspace(userId, workspaceId);
  }

  async getByFolder(userId: string | null, workspaceId: string, folderId: string | null): Promise<CanvasFile[]> {
    return workspaceDB.getCanvasFilesByFolder(userId, workspaceId, folderId);
  }

  async getRecent(userId: string | null, limit: number = 10): Promise<CanvasFile[]> {
    return workspaceDB.getRecentCanvasFiles(userId, limit);
  }

  async updateLastOpened(id: string): Promise<void> {
    return workspaceDB.updateCanvasLastOpened(id);
  }

  async togglePin(id: string): Promise<void> {
    await workspaceDB.togglePinCanvas(id);
    const updated = await db.canvasFiles.get(id);
    if (updated) {
      await this.queueSync('canvasFile', id, 'update', updated);
    }
  }

  // ---- Canvas Data (Excalidraw scene) ----

  async loadData(userId: string | null, canvasFileId: string): Promise<CanvasData | undefined> {
    return canvasDB.getCanvasData(userId, canvasFileId);
  }

  async saveData(userId: string | null, data: Partial<CanvasData> & { canvasFileId: string }): Promise<void> {
    await canvasDB.saveCanvasData(userId, data);
    // Queue canvas data for sync
    const full = await canvasDB.getCanvasData(userId, data.canvasFileId);
    if (full) {
      await this.queueSync('canvasData', data.canvasFileId, 'update', full);
    }
  }

  // ---- Custom Blocks ----

  async loadBlocks(userId: string | null, canvasFileId: string): Promise<CustomBlock[]> {
    return canvasDB.getBlocksByCanvas(userId, canvasFileId);
  }

  async addBlock(userId: string | null, block: Omit<CustomBlock, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<CustomBlock> {
    return canvasDB.addCustomBlock(userId, block);
  }

  async updateBlock(id: string, updates: Partial<CustomBlock>): Promise<void> {
    return canvasDB.updateCustomBlock(id, updates);
  }

  async deleteBlock(id: string): Promise<void> {
    return canvasDB.deleteCustomBlock(id);
  }

  // ---- PDF ----

  async storePdf(userId: string | null, canvasFileId: string, fileName: string, data: ArrayBuffer): Promise<PdfFileData> {
    return canvasDB.storePdfFile(userId, canvasFileId, fileName, data);
  }

  async getPdf(userId: string | null, id: string): Promise<PdfFileData | undefined> {
    return canvasDB.getPdfFile(userId, id);
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
      console.warn('[CanvasRepo] Failed to queue sync:', err);
    }
  }
}

export const canvasRepository = new CanvasRepository();
