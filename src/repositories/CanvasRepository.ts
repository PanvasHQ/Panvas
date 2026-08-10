// ============================================
// Panvas — Canvas Repository
// Bridges local DB ↔ Sync Queue ↔ Supabase
// ============================================

import * as workspaceDB from '@/database/workspaceDB';
import * as canvasDB from '@/database/canvasDB';
import { db } from '@/database/schema';
import type { CanvasFile } from '@/types/workspace';
import type { CanvasData, CustomBlock, BlockType, PdfFileData, ImageFileData } from '@/types/canvas';
import type { SyncQueueItem } from '@/types/sync';

export class CanvasRepository {
  // ---- Canvas File CRUD ----

  async create(userId: string | null, workspaceId: string, folderId: string | null, name: string): Promise<CanvasFile> {
    if (typeof window !== 'undefined' && window.panvas) {
      return await window.panvas.canvasFile.create(workspaceId, name, folderId);
    }
    const canvas = await workspaceDB.createCanvasFile(userId, workspaceId, folderId, name);
    await this.queueSync('canvasFile', canvas.id, 'create', canvas);
    return canvas;
  }

  async rename(userId: string | null, workspaceId: string, id: string, name: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.canvasFile.update(workspaceId, id, { name });
      return;
    }
    await workspaceDB.renameCanvasFile(id, name);
    const updated = await db.canvasFiles.get(id);
    if (updated) {
      await this.queueSync('canvasFile', id, 'update', updated);
    }
  }

  async duplicate(userId: string | null, id: string): Promise<CanvasFile | null> {
    const canvas = await workspaceDB.duplicateCanvasFile(userId, id);
    if (canvas) {
      // Sync the duplicated file and data
      await this.queueSync('canvasFile', canvas.id, 'create', canvas);
      const data = await canvasDB.getCanvasData(userId, canvas.id);
      if (data) {
        await this.queueSync('canvasData', canvas.id, 'update', data);
      }
    }
    return canvas;
  }

  async move(userId: string | null, id: string, workspaceId: string, folderId: string | null): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.canvasFile.update(workspaceId, id, { workspaceId, folderId });
      return;
    }
    await workspaceDB.moveCanvasFile(id, workspaceId, folderId);
    const updated = await db.canvasFiles.get(id);
    if (updated) {
      await this.queueSync('canvasFile', id, 'update', updated);
    }
  }

  async delete(workspaceId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.canvasFile.update(workspaceId, id, { deletedAt: Date.now() });
      return;
    }
    await workspaceDB.deleteCanvasFile(id, true); // soft delete
    const deleted = await db.canvasFiles.get(id);
    if (deleted) {
      await this.queueSync('canvasFile', id, 'update', deleted);
    }
  }

  async restore(workspaceId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.canvasFile.update(workspaceId, id, { deletedAt: null });
      return;
    }
    await workspaceDB.restoreCanvasFile(id);
    const updated = await db.canvasFiles.get(id);
    if (updated) {
      await this.queueSync('canvasFile', id, 'update', updated);
    }
  }

  async permanentlyDelete(workspaceId: string, id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.canvasFile.delete(workspaceId, id);
      return;
    }
    await workspaceDB.deleteCanvasFile(id, false);
    await this.queueSync('canvasFile', id, 'delete', { id });
  }

  async getByWorkspace(userId: string | null, workspaceId: string): Promise<CanvasFile[]> {
    return workspaceDB.getCanvasFilesByWorkspace(userId, workspaceId);
  }

  async getAll(userId: string | null): Promise<CanvasFile[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      const workspaces = await window.panvas.workspace.getAll();
      let allCanvases: CanvasFile[] = [];
      for (const ws of workspaces) {
        const canvases = await window.panvas.canvasFile.getAll(ws.id);
        allCanvases = allCanvases.concat(canvases.filter((c: any) => !c.deletedAt));
      }
      return allCanvases;
    }
    return workspaceDB.getAllCanvasFiles(userId);
  }

  async getByFolder(userId: string | null, workspaceId: string, folderId: string | null): Promise<CanvasFile[]> {
    return workspaceDB.getCanvasFilesByFolder(userId, workspaceId, folderId);
  }

  async getRecent(userId: string | null, limit: number = 10): Promise<CanvasFile[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      const workspaces = await window.panvas.workspace.getAll();
      let allCanvases: CanvasFile[] = [];
      for (const ws of workspaces) {
        const canvases = await window.panvas.canvasFile.getAll(ws.id);
        allCanvases = allCanvases.concat(canvases);
      }
      return allCanvases.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, limit);
    }
    return workspaceDB.getRecentCanvasFiles(userId, limit);
  }

  async updateLastOpened(id: string): Promise<void> {
    return workspaceDB.updateCanvasLastOpened(id);
  }

  async togglePin(workspaceId: string, id: string, isPinned: boolean): Promise<void> {
    if (typeof window !== 'undefined' && window.panvas) {
      await window.panvas.canvasFile.update(workspaceId, id, { isPinned });
      return;
    }
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

  // ---- Image ----

  async storeImage(userId: string | null, canvasFileId: string, fileName: string, mimeType: string, data: ArrayBuffer): Promise<ImageFileData> {
    return canvasDB.storeImageFile(userId, canvasFileId, fileName, mimeType, data);
  }

  async getImage(id: string): Promise<ImageFileData | undefined> {
    return canvasDB.getImageFile(id);
  }

  async deleteImage(id: string): Promise<void> {
    return canvasDB.deleteImageFile(id);
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
