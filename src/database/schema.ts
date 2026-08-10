// ============================================
// Panvas — Dexie.js Database Schema
// Local-first storage using IndexedDB
// ============================================

import Dexie, { type Table } from 'dexie';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import type { CanvasData, CustomBlock, PdfFileData, ImageFileData } from '@/types/canvas';
import type { SyncQueueItem } from '@/types/sync';
import type { Notebook, NotebookSection, NotebookPage } from '@/types/notebook';
import type { PdfAnnotation } from '@/types/pdfAnnotation';
import { generateId } from '@/lib/utils/id';

export class PanvasDB extends Dexie {
  workspaces!: Table<Workspace>;
  folders!: Table<Folder>;
  canvasFiles!: Table<CanvasFile>;
  canvasData!: Table<CanvasData>;
  customBlocks!: Table<CustomBlock>;
  pdfFiles!: Table<PdfFileData>;
  syncQueue!: Table<SyncQueueItem>;
  notebooks!: Table<Notebook>;
  notebookSections!: Table<NotebookSection>;
  notebookPages!: Table<NotebookPage>;
  imageFiles!: Table<ImageFileData>;

  constructor() {
    super('panvas');

    // Version 1: original schema
    this.version(1).stores({
      workspaces: 'id, name, updatedAt, isPinned',
      folders: 'id, workspaceId, parentId, order',
      canvasFiles: 'id, workspaceId, folderId, updatedAt, lastOpenedAt, isPinned',
      canvasData: 'canvasFileId',
      customBlocks: 'id, canvasFileId, type',
      pdfFiles: 'id, canvasFileId',
      syncQueue: '++id, entityType, entityId, status, createdAt',
    });

    // Version 2: add sync metadata fields
    this.version(2).stores({
      workspaces: 'id, name, updatedAt, isPinned, syncStatus, userId',
      folders: 'id, workspaceId, parentId, order, syncStatus, userId',
      canvasFiles: 'id, workspaceId, folderId, updatedAt, lastOpenedAt, isPinned, syncStatus, userId',
      canvasData: 'canvasFileId, userId',
      customBlocks: 'id, canvasFileId, type, userId',
      pdfFiles: 'id, canvasFileId, userId',
      syncQueue: '++id, entityType, entityId, status, createdAt',
    }).upgrade(tx => {
      // Add default values for new fields on existing rows
      tx.table('workspaces').toCollection().modify(ws => {
        ws.syncStatus = ws.syncStatus || 'local';
        ws.userId = ws.userId || null;
        ws.deletedAt = ws.deletedAt || null;
      });
      tx.table('folders').toCollection().modify(f => {
        f.syncStatus = f.syncStatus || 'local';
        f.userId = f.userId || null;
        f.deletedAt = f.deletedAt || null;
      });
      tx.table('canvasFiles').toCollection().modify(cf => {
        cf.syncStatus = cf.syncStatus || 'local';
        cf.userId = cf.userId || null;
        cf.deletedAt = cf.deletedAt || null;
      });
    });

    // Version 3: Enforce strict userId tracking on all internal canvas data and purge orphans
    this.version(3).stores({
      workspaces: 'id, name, updatedAt, isPinned, syncStatus, userId',
      folders: 'id, workspaceId, parentId, order, syncStatus, userId',
      canvasFiles: 'id, workspaceId, folderId, updatedAt, lastOpenedAt, isPinned, syncStatus, userId',
      canvasData: 'canvasFileId, userId',
      customBlocks: 'id, canvasFileId, type, userId',
      pdfFiles: 'id, canvasFileId, userId',
      syncQueue: '++id, entityType, entityId, status, createdAt',
    }).upgrade(async tx => {
      const canvasFiles = await tx.table('canvasFiles').toArray();
      const canvasMap = new Map<string, string | null>();
      for (const cf of canvasFiles) {
        canvasMap.set(cf.id, cf.userId);
      }

      await tx.table('canvasData').toCollection().modify((cd, ref) => {
        if (!canvasMap.has(cd.canvasFileId)) {
          delete ref.value; // purge orphan
        } else {
          cd.userId = canvasMap.get(cd.canvasFileId) ?? null;
        }
      });

      await tx.table('customBlocks').toCollection().modify((cb, ref) => {
        if (!canvasMap.has(cb.canvasFileId)) {
          delete ref.value; // purge orphan
        } else {
          cb.userId = canvasMap.get(cb.canvasFileId) ?? null;
        }
      });

      await tx.table('pdfFiles').toCollection().modify((pdf, ref) => {
        if (!canvasMap.has(pdf.canvasFileId)) {
          delete ref.value; // purge orphan
        } else {
          pdf.userId = canvasMap.get(pdf.canvasFileId) ?? null;
        }
      });
    });

    // Version 4: Add notebooks and imageFiles tables
    this.version(4).stores({
      workspaces: 'id, name, updatedAt, isPinned, syncStatus, userId',
      folders: 'id, workspaceId, parentId, order, syncStatus, userId',
      canvasFiles: 'id, workspaceId, folderId, updatedAt, lastOpenedAt, isPinned, syncStatus, userId',
      canvasData: 'canvasFileId, userId',
      customBlocks: 'id, canvasFileId, type, userId',
      pdfFiles: 'id, canvasFileId, userId',
      syncQueue: '++id, entityType, entityId, status, createdAt',
      notebooks: 'id, workspaceId, folderId, order, updatedAt, userId',
      notebookSections: 'id, notebookId, order, updatedAt, userId',
      notebookPages: 'id, notebookId, sectionId, order, updatedAt, userId',
      imageFiles: 'id, canvasFileId, userId',
    });
  }
}

// Singleton database instance
export const db = new PanvasDB();

// Initialize with a default workspace if empty
export async function initializeDatabase(userId: string | null = null): Promise<void> {
  // Only check workspaces belonging to the targeted userId context
  const workspaceCount = await db.workspaces.where('userId').equals(userId ?? '').count();
  if (workspaceCount === 0) {
    const now = Date.now();
    const defaultWorkspaceId = generateId('ws');
    const defaultCanvasId = generateId('canvas');

    await db.transaction('rw', [db.workspaces, db.canvasFiles, db.canvasData], async () => {
      await db.workspaces.add({
        id: defaultWorkspaceId,
        name: 'My Workspace',
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        syncStatus: userId ? 'pending' : 'local',
        userId: userId,
        deletedAt: null,
      });

      await db.canvasFiles.add({
        id: defaultCanvasId,
        workspaceId: defaultWorkspaceId,
        folderId: null,
        name: 'Welcome Canvas',
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        order: 0,
        isPinned: false,
        syncStatus: userId ? 'pending' : 'local',
        userId: userId,
        deletedAt: null,
      });

      await db.canvasData.add({
        canvasFileId: defaultCanvasId,
        elements: [],
        appState: {},
        files: {},
        customBlocks: [],
        version: 1,
        updatedAt: now,
        userId: userId,
      });

      if (userId) {
        await db.syncQueue.bulkAdd([
          {
            entityType: 'workspace',
            entityId: defaultWorkspaceId,
            action: 'create',
            data: { id: defaultWorkspaceId, name: 'My Workspace', createdAt: now, updatedAt: now, isPinned: false, userId },
            status: 'pending',
            attempts: 0,
            createdAt: now,
          },
          {
            entityType: 'canvasFile',
            entityId: defaultCanvasId,
            action: 'create',
            data: { id: defaultCanvasId, workspaceId: defaultWorkspaceId, folderId: null, name: 'Welcome Canvas', createdAt: now, updatedAt: now, lastOpenedAt: now, order: 0, isPinned: false, userId },
            status: 'pending',
            attempts: 0,
            createdAt: now,
          },
          {
            entityType: 'canvasData',
            entityId: defaultCanvasId,
            action: 'update',
            data: { canvasFileId: defaultCanvasId, elements: [], appState: {}, files: {}, customBlocks: [], version: 1, updatedAt: now, userId },
            status: 'pending',
            attempts: 0,
            createdAt: now,
          }
        ]);
      }
    });
  }
}

// Clear all data (used on logout)
export async function clearDatabase(): Promise<void> {
  // Close the active connection before deleting to prevent blocked deletes
  db.close();
  
  // Wipe the IndexedDB
  await Dexie.delete('panvas');
  
  // Clear stored memory pointers that might re-hydrate stale data
  window.localStorage.removeItem('panvas.activeWorkspaceId');
  window.localStorage.removeItem('panvas.activeCanvasId');
  
  // Re-open and re-initialize with a fresh default state
  await db.open();
  await initializeDatabase();
}
