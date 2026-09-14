// ============================================
// Panvas — Dexie.js Database Schema
// Local-first storage using IndexedDB
// ============================================

import Dexie, { type Table } from 'dexie';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import type { CanvasData, CustomBlock, PdfFileData, ImageFileData } from '@/types/canvas';
import type { SyncQueueItem } from '@/types/sync';
import {
  DEFAULT_PAGE_PROPERTY_SET,
  type Notebook,
  type NotebookPage,
  type NotebookPageContentRecord,
  type NotebookPageDrawingRecord,
  type NotebookSection,
} from '../types/notebook.ts';
import type { PdfAnnotation } from '@/types/pdfAnnotation';
import type { SyncJournalEntry } from '@/services/cloudsync/types';
import { initializeBrowserStorageDurability } from '../services/storage/browserStorageDurability.ts';
import { generateId } from '../lib/utils/id.ts';

export const SYSTEM_DEFAULT_WORKSPACE_ID = 'ws-system-default-v1';
export const SYSTEM_WELCOME_CANVAS_ID = 'canvas-system-welcome-v1';
export const SYSTEM_DEFAULT_NOTEBOOK_ID = 'nb-system-default-v1';
export const SYSTEM_DEFAULT_SECTION_ID = 'sec-system-default-v1';
export const SYSTEM_DEFAULT_PAGE_ID = 'page-system-default-v1';
/** Set while an explicit device reset is hydrating from a verified cloud. */
export const DEVICE_RESET_PENDING_KEY = 'panvas.cloudSync.deviceResetPending.v1';

export function markDeviceResetPending(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(DEVICE_RESET_PENDING_KEY, 'true'); } catch { /* optional marker */ }
}

export function clearDeviceResetPending(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(DEVICE_RESET_PENDING_KEY); } catch { /* optional marker */ }
}

export function isDeviceResetPending(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(DEVICE_RESET_PENDING_KEY) === 'true'; } catch { return false; }
}

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
  notebookPageContents!: Table<NotebookPageContentRecord>;
  notebookPageDrawings!: Table<NotebookPageDrawingRecord>;
  imageFiles!: Table<ImageFileData>;
  syncJournal!: Table<SyncJournalEntry>;

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

    // Version 5: browser-local notebook payloads. Electron persists these
    // payloads as per-page JSON files; browser mode needs an equivalent
    // canonical IndexedDB path instead of silently dropping writes.
    this.version(5).stores({
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
      notebookPageContents: 'pageId, workspaceId, notebookId, updatedAt, userId',
      notebookPageDrawings: 'pageId, workspaceId, notebookId, updatedAt, userId',
      imageFiles: 'id, canvasFileId, userId',
    }).upgrade(tx => {
      // Older browser rows predate trash parity. Normalizing the marker keeps
      // read-path filtering and restore behavior deterministic after upgrade.
      tx.table('notebooks').toCollection().modify(item => {
        if (item.deletedAt === undefined) item.deletedAt = null;
      });
      tx.table('notebookSections').toCollection().modify(item => {
        if (item.deletedAt === undefined) item.deletedAt = null;
      });
      tx.table('notebookPages').toCollection().modify(item => {
        if (item.deletedAt === undefined) item.deletedAt = null;
      });
    });

    // Version 6: provider-neutral sync journal (Cloud Sync Phase 1).
    // Strictly additive — every existing store definition is unchanged.
    this.version(6).stores({
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
      notebookPageContents: 'pageId, workspaceId, notebookId, updatedAt, userId',
      notebookPageDrawings: 'pageId, workspaceId, notebookId, updatedAt, userId',
      imageFiles: 'id, canvasFileId, userId',
      syncJournal: 'entryId, entityId, entityType, workspaceId, state, updatedAt',
    });
  }
}

// Singleton database instance
export const db = new PanvasDB();

// Initialize with a default workspace if empty
export async function initializeDatabase(userId: string | null = null): Promise<void> {
  if (isDeviceResetPending()) return;
  if (typeof window !== 'undefined' && !window.panvas) await initializeBrowserStorageDurability();
  const normalizedUserId = userId || null;
  // Only check workspaces belonging to the targeted userId context
  const workspaceCount = await db.workspaces
    .filter(workspace => (workspace.userId || null) === normalizedUserId && !workspace.deletedAt)
    .count();
  if (workspaceCount === 0) {
    await db.transaction('rw', [
      db.workspaces,
      db.canvasFiles,
      db.canvasData,
      db.notebooks,
      db.notebookSections,
      db.notebookPages,
      db.notebookPageContents,
      db.notebookPageDrawings,
      db.syncQueue,
    ], async () => {
      // The initial count is only a fast path. Re-check inside the write
      // transaction because React StrictMode, auth restoration, and a sync
      // bootstrap can call initializeDatabase concurrently. Without this
      // second check, each caller can allocate a fresh random default before
      // either transaction commits, recreating the duplicate-shell bug.
      const targetWorkspaces = await db.workspaces
        .filter(workspace => (workspace.userId || null) === normalizedUserId && !workspace.deletedAt)
        .toArray();
      if (targetWorkspaces.length > 0) return;

      const now = Date.now();
      const fixedWorkspace = await db.workspaces.get(SYSTEM_DEFAULT_WORKSPACE_ID);
      const fixedWorkspaceOwnedByTarget = Boolean(fixedWorkspace && !fixedWorkspace.deletedAt && (fixedWorkspace.userId || null) === normalizedUserId);
      const defaultWorkspaceId = !fixedWorkspace || fixedWorkspaceOwnedByTarget
        ? SYSTEM_DEFAULT_WORKSPACE_ID
        : generateId('ws');
      const existingSystemWorkspace = defaultWorkspaceId === SYSTEM_DEFAULT_WORKSPACE_ID
        ? fixedWorkspace
        : await db.workspaces.get(defaultWorkspaceId);
      const fixedCanvas = await db.canvasFiles.get(SYSTEM_WELCOME_CANVAS_ID);
      const fixedCanvasOwnedByTarget = Boolean(fixedCanvas && !fixedCanvas.deletedAt
        && (fixedCanvas.userId || null) === normalizedUserId
        && fixedCanvas.workspaceId === defaultWorkspaceId);
      const defaultCanvasId = defaultWorkspaceId === SYSTEM_DEFAULT_WORKSPACE_ID && (!fixedCanvas || fixedCanvasOwnedByTarget)
        ? SYSTEM_WELCOME_CANVAS_ID
        : generateId('canvas');
      const existingWelcomeCanvas = defaultCanvasId === SYSTEM_WELCOME_CANVAS_ID
        ? fixedCanvas
        : await db.canvasFiles.get(defaultCanvasId);

      const fixedNotebook = await db.notebooks.get(SYSTEM_DEFAULT_NOTEBOOK_ID);
      const fixedNotebookOwnedByTarget = Boolean(fixedNotebook && !fixedNotebook.deletedAt
        && (fixedNotebook.userId || null) === normalizedUserId
        && fixedNotebook.workspaceId === defaultWorkspaceId);
      const defaultNotebookId = defaultWorkspaceId === SYSTEM_DEFAULT_WORKSPACE_ID && (!fixedNotebook || fixedNotebookOwnedByTarget)
        ? SYSTEM_DEFAULT_NOTEBOOK_ID
        : generateId('nb');
      const existingNotebook = defaultNotebookId === SYSTEM_DEFAULT_NOTEBOOK_ID
        ? fixedNotebook
        : await db.notebooks.get(defaultNotebookId);

      const fixedSection = await db.notebookSections.get(SYSTEM_DEFAULT_SECTION_ID);
      const fixedSectionOwnedByTarget = Boolean(fixedSection && !fixedSection.deletedAt
        && (fixedSection.userId || null) === normalizedUserId
        && fixedSection.notebookId === defaultNotebookId);
      const defaultSectionId = defaultNotebookId === SYSTEM_DEFAULT_NOTEBOOK_ID && (!fixedSection || fixedSectionOwnedByTarget)
        ? SYSTEM_DEFAULT_SECTION_ID
        : generateId('sec');
      const existingSection = defaultSectionId === SYSTEM_DEFAULT_SECTION_ID
        ? fixedSection
        : await db.notebookSections.get(defaultSectionId);

      const fixedPage = await db.notebookPages.get(SYSTEM_DEFAULT_PAGE_ID);
      const fixedPageOwnedByTarget = Boolean(fixedPage && !fixedPage.deletedAt
        && (fixedPage.userId || null) === normalizedUserId
        && fixedPage.sectionId === defaultSectionId
        && fixedPage.notebookId === defaultNotebookId);
      const defaultPageId = defaultSectionId === SYSTEM_DEFAULT_SECTION_ID && (!fixedPage || fixedPageOwnedByTarget)
        ? SYSTEM_DEFAULT_PAGE_ID
        : generateId('page');
      const existingPage = defaultPageId === SYSTEM_DEFAULT_PAGE_ID
        ? fixedPage
        : await db.notebookPages.get(defaultPageId);

      if (!existingSystemWorkspace) await db.workspaces.add({
        id: defaultWorkspaceId,
        name: 'My Workspace',
        createdAt: now,
        updatedAt: now,
        isPinned: false,
        syncStatus: normalizedUserId ? 'pending' : 'local',
        userId: normalizedUserId,
        deletedAt: null,
        isSystem: true,
        systemType: 'default',
      });

      if (!existingWelcomeCanvas) await db.canvasFiles.add({
        id: defaultCanvasId,
        workspaceId: defaultWorkspaceId,
        folderId: null,
        name: 'Welcome Canvas',
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        order: 0,
        isPinned: false,
        syncStatus: normalizedUserId ? 'pending' : 'local',
        userId: normalizedUserId,
        deletedAt: null,
        isSystem: true,
        systemType: 'welcome',
      });

      if (!(await db.canvasData.get(defaultCanvasId))) await db.canvasData.add({
        canvasFileId: defaultCanvasId,
        elements: [],
        appState: {},
        files: {},
        customBlocks: [],
        version: 1,
        updatedAt: now,
        userId: normalizedUserId,
      });

      if (!existingNotebook) await db.notebooks.add({
        id: defaultNotebookId,
        workspaceId: defaultWorkspaceId,
        folderId: null,
        name: 'My Notebook',
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        order: 0,
        isExpanded: true,
        isPinned: false,
        userId: normalizedUserId,
        deletedAt: null,
        defaultPageProperties: { ...DEFAULT_PAGE_PROPERTY_SET },
      });

      if (!existingSection) await db.notebookSections.add({
        id: defaultSectionId,
        notebookId: defaultNotebookId,
        name: 'Section 1',
        createdAt: now,
        updatedAt: now,
        order: 0,
        isExpanded: true,
        userId: normalizedUserId,
        deletedAt: null,
      });

      if (!existingPage) await db.notebookPages.add({
        id: defaultPageId,
        notebookId: defaultNotebookId,
        sectionId: defaultSectionId,
        title: 'Page 1',
        type: 'default',
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        order: 0,
        userId: normalizedUserId,
        deletedAt: null,
        pagePropertyOverrides: {},
      });

      if (!(await db.notebookPageContents.get(defaultPageId))) await db.notebookPageContents.add({
        pageId: defaultPageId,
        workspaceId: defaultWorkspaceId,
        notebookId: defaultNotebookId,
        data: { type: 'doc', content: [] },
        version: 1,
        updatedAt: now,
        userId: normalizedUserId,
      });

      if (!(await db.notebookPageDrawings.get(defaultPageId))) await db.notebookPageDrawings.add({
        pageId: defaultPageId,
        workspaceId: defaultWorkspaceId,
        notebookId: defaultNotebookId,
        data: { objects: [], layers: [] },
        version: 1,
        updatedAt: now,
        userId: normalizedUserId,
      });

      if (normalizedUserId && !existingSystemWorkspace && !existingWelcomeCanvas) {
        await db.syncQueue.bulkAdd([
          {
            entityType: 'workspace',
            entityId: defaultWorkspaceId,
            action: 'create',
            data: { id: defaultWorkspaceId, name: 'My Workspace', createdAt: now, updatedAt: now, isPinned: false, userId: normalizedUserId, isSystem: true, systemType: 'default' },
            status: 'pending',
            attempts: 0,
            createdAt: now,
          },
          {
            entityType: 'canvasFile',
            entityId: defaultCanvasId,
            action: 'create',
            data: { id: defaultCanvasId, workspaceId: defaultWorkspaceId, folderId: null, name: 'Welcome Canvas', createdAt: now, updatedAt: now, lastOpenedAt: now, order: 0, isPinned: false, userId: normalizedUserId, isSystem: true, systemType: 'welcome' },
            status: 'pending',
            attempts: 0,
            createdAt: now,
          },
          {
            entityType: 'canvasData',
            entityId: defaultCanvasId,
            action: 'update',
            data: { canvasFileId: defaultCanvasId, elements: [], appState: {}, files: {}, customBlocks: [], version: 1, updatedAt: now, userId: normalizedUserId },
            status: 'pending',
            attempts: 0,
            createdAt: now,
          },
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
  const localStorage = (globalThis as any).localStorage;
  localStorage?.removeItem('panvas.activeWorkspaceId');
  localStorage?.removeItem('panvas.activeCanvasId');
  
  // Re-open and re-initialize with a fresh default state
  await db.open();
  await initializeDatabase();
}
