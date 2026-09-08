import path from 'path';
import { promises as fsPromises } from 'fs';
import { app } from 'electron';
import { writeQueue } from './write-queue.js';
import { generateId } from '../../src/lib/utils/id.js';
import { buildWorkspaceBackup, remapWorkspaceBackup, validateWorkspaceBackup, type BackupImportResult, type WorkspaceBackup } from '../../src/services/backup/backupService.js';
import type { CanvasData } from '../../src/types/canvas.js';
import type { SyncEntityKind } from '../../src/services/cloudsync/types.js';
import { parsePdfAnnotationStorageId } from '../../src/lib/pdfAnnotationStorage.js';

const SAFE_SYNC_FILE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export class WorkspaceService {
  private baseDir: string;
  private workspaceRegistry: Map<string, string> = new Map(); // workspaceId -> workspaceDir

  constructor() {
    this.baseDir = path.join(app.getPath('documents'), 'Panvas');
  }

  getWorkspaceDirById(workspaceId: string): string {
    const dir = this.workspaceRegistry.get(workspaceId);
    if (!dir) throw new Error(`Workspace ${workspaceId} not found in registry`);
    return dir;
  }

  registerWorkspace(workspaceId: string, workspaceDir: string) {
    this.workspaceRegistry.set(workspaceId, workspaceDir);
  }

  unregisterWorkspace(workspaceId: string) {
    this.workspaceRegistry.delete(workspaceId);
  }

  getWorkspaceDirByName(name: string) {
    return path.join(this.baseDir, name);
  }

  // Binary assets (imported PDFs) are keyed only by their generated id, not by
  // workspace: the renderer creates the PDF record before the owning page
  // exists, and the id already encodes uniqueness. The renderer's IndexedDB is
  // origin/profile scoped, so the filesystem below Documents/Panvas is the
  // durability boundary for these bytes.
  getPdfStoreDir(): string {
    return path.join(this.baseDir, 'Assets', 'pdf-store');
  }

  getImageStoreDir(): string {
    return path.join(this.baseDir, 'Assets', 'image-store');
  }

  getAudioStoreDir(): string {
    return path.join(this.baseDir, 'Assets', 'audio-store');
  }

  private getPanvasDir(workspaceDir: string) {
    return path.join(workspaceDir, '.panvas');
  }

  private getWorkspaceJsonPath(workspaceDir: string) {
    return path.join(this.getPanvasDir(workspaceDir), 'workspace.json');
  }

  private getWorkspaceRecoveryPath(workspaceDir: string) {
    return path.join(this.getPanvasDir(workspaceDir), 'recovery', 'workspace.last-good.json');
  }

  private parseWorkspaceJson(content: string) {
    const ws = JSON.parse(content);
    if (!ws || typeof ws !== 'object' || Array.isArray(ws) || typeof ws.id !== 'string') {
      throw new Error('Workspace metadata is not a valid object.');
    }
    ws.folders = Array.isArray(ws.folders) ? ws.folders : [];
    ws.canvasFiles = Array.isArray(ws.canvasFiles) ? ws.canvasFiles : [];
    ws.notebooks = Array.isArray(ws.notebooks) ? ws.notebooks : [];
    ws.notebookSections = Array.isArray(ws.notebookSections) ? ws.notebookSections : [];
    ws.notebookPages = Array.isArray(ws.notebookPages) ? ws.notebookPages : [];
    return ws;
  }

  async readWorkspaceJson(workspaceDir: string) {
    const workspacePath = this.getWorkspaceJsonPath(workspaceDir);
    try {
      return this.parseWorkspaceJson(await fsPromises.readFile(workspacePath, 'utf8'));
    } catch (primaryError) {
      try {
        const recoveryContent = await fsPromises.readFile(this.getWorkspaceRecoveryPath(workspaceDir), 'utf8');
        const recovered = this.parseWorkspaceJson(recoveryContent);
        await writeQueue.enqueue(workspacePath, JSON.stringify(recovered, null, 2));
        console.warn(`[WorkspaceService] Restored corrupt workspace metadata from last-good recovery: ${workspaceDir}`);
        return recovered;
      } catch (recoveryError) {
        const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
        const recoveryMessage = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
        throw new Error(`Workspace metadata and recovery copy are unreadable: ${workspaceDir} (primary: ${primaryMessage}; recovery: ${recoveryMessage})`);
      }
    }
  }

  async writeWorkspaceJson(workspaceDir: string, data: any) {
    const filePath = this.getWorkspaceJsonPath(workspaceDir);
    const serialized = JSON.stringify(this.parseWorkspaceJson(JSON.stringify(data)), null, 2);
    await writeQueue.enqueue(filePath, serialized);
    // This is a last-known-good recovery mirror, not a second source of truth.
    // It is written only after the canonical metadata write succeeds.
    try {
      await writeQueue.enqueue(this.getWorkspaceRecoveryPath(workspaceDir), serialized);
    } catch (error) {
      // Canonical metadata is already durable. A mirror failure must not turn a
      // successful save into a false failure, but it remains diagnosable.
      console.warn(`[WorkspaceService] Could not refresh last-good recovery for ${workspaceDir}:`, error);
    }
  }
  
  async ensureBaseDir() {
    await fsPromises.mkdir(this.baseDir, { recursive: true }).catch(() => {});
  }

  private async readOptionalJson(filePath: string): Promise<unknown | null> {
    try {
      return JSON.parse(await fsPromises.readFile(filePath, 'utf8'));
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw new Error(`Backup payload is unreadable: ${filePath}`);
    }
  }

  async exportWorkspaceBackup(workspaceId: string): Promise<WorkspaceBackup> {
    const workspaceDir = this.getWorkspaceDirById(workspaceId);
    const metadata = await this.readWorkspaceJson(workspaceDir);
    const pages = metadata.notebookPages ?? [];
    const pagePayloads: Record<string, { drawing: unknown; content: unknown }> = {};
    for (const page of pages) {
      const pagesDir = path.join(workspaceDir, 'Notebooks', page.notebookId, 'pages');
      pagePayloads[page.id] = {
        content: await this.readOptionalJson(path.join(pagesDir, `${page.id}.content.json`)),
        drawing: await this.readOptionalJson(path.join(pagesDir, `${page.id}.drawing.json`)),
      };
    }
    const canvasPayloads: Record<string, CanvasData> = {};
    for (const canvas of metadata.canvasFiles ?? []) {
      const payload = await this.readOptionalJson(path.join(workspaceDir, 'Canvas', `${canvas.id}.json`));
      canvasPayloads[canvas.id] = (payload && typeof payload === 'object' ? payload : {
        canvasFileId: canvas.id, elements: [], appState: {}, files: {}, customBlocks: [], version: 1, updatedAt: canvas.updatedAt, userId: canvas.userId ?? null,
      }) as CanvasData;
    }
    return buildWorkspaceBackup({
      workspace: metadata,
      folders: metadata.folders ?? [],
      notebooks: metadata.notebooks ?? [],
      sections: metadata.notebookSections ?? [],
      pages,
      canvases: metadata.canvasFiles ?? [],
      pagePayloads,
      canvasPayloads,
    });
  }

  async importWorkspaceBackup(input: unknown): Promise<BackupImportResult> {
    const backup = validateWorkspaceBackup(input);
    await this.ensureBaseDir();
    const baseName = backup.header.workspaceName.trim();
    let workspaceName = `${baseName} (Restored)`;
    let suffix = 2;
    while (true) {
      try {
        await fsPromises.access(this.getWorkspaceDirByName(workspaceName));
        workspaceName = `${baseName} (Restored ${suffix++})`;
      } catch {
        break;
      }
    }
    const restored = remapWorkspaceBackup(backup, { idFactory: prefix => generateId(prefix), workspaceName, userId: null, now: Date.now() });
    const workspaceDir = this.getWorkspaceDirByName(workspaceName);
    await Promise.all([
      fsPromises.mkdir(path.join(workspaceDir, '.panvas', 'recovery'), { recursive: true }),
      fsPromises.mkdir(path.join(workspaceDir, 'Notebooks'), { recursive: true }),
      fsPromises.mkdir(path.join(workspaceDir, 'Canvas'), { recursive: true }),
    ]);
    const metadata = {
      ...restored.workspace,
      name: workspaceName,
      version: 1,
      folders: restored.folders,
      canvasFiles: restored.canvases,
      notebooks: restored.notebooks,
      notebookSections: restored.sections,
      notebookPages: restored.pages,
    };
    await this.writeWorkspaceJson(workspaceDir, metadata);
    for (const page of restored.pages) {
      const pagesDir = path.join(workspaceDir, 'Notebooks', page.notebookId, 'pages');
      await fsPromises.mkdir(pagesDir, { recursive: true });
      const payload = restored.pagePayloads[page.id];
      if (payload.content !== null && payload.content !== undefined) await writeQueue.enqueue(path.join(pagesDir, `${page.id}.content.json`), JSON.stringify(payload.content, null, 2));
      if (payload.drawing !== null && payload.drawing !== undefined) await writeQueue.enqueue(path.join(pagesDir, `${page.id}.drawing.json`), JSON.stringify(payload.drawing, null, 2));
    }
    for (const canvas of restored.canvases) {
      await writeQueue.enqueue(path.join(workspaceDir, 'Canvas', `${canvas.id}.json`), JSON.stringify(restored.canvasPayloads[canvas.id], null, 2));
    }
    this.registerWorkspace(restored.workspace.id, workspaceDir);
    return { workspaceId: restored.workspace.id, workspaceName };
  }

  /** Enumerates persisted drawing identities without exposing their contents. */
  async listPageDrawingRecords(workspaceId: string): Promise<Array<{ id: string; notebookId: string; ownerPageId: string }>> {
    const workspaceDir = this.getWorkspaceDirById(workspaceId);
    const metadata = await this.readWorkspaceJson(workspaceDir);
    const activePages = (metadata.notebookPages ?? []).filter((page: any) => !page.deletedAt && SAFE_SYNC_FILE_ID.test(String(page.id)) && SAFE_SYNC_FILE_ID.test(String(page.notebookId)));
    const pagesById = new Map<string, any>(activePages.map((page: any) => [String(page.id), page]));
    const records: Array<{ id: string; notebookId: string; ownerPageId: string }> = [];

    for (const notebookId of [...new Set<string>(activePages.map((page: any) => String(page.notebookId)))]) {
      const pagesDir = path.join(workspaceDir, 'Notebooks', notebookId, 'pages');
      let entries: import('fs').Dirent[];
      try { entries = await fsPromises.readdir(pagesDir, { withFileTypes: true }); }
      catch (error: any) { if (error?.code === 'ENOENT') continue; throw error; }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith('.drawing.json')) continue;
        const id = entry.name.slice(0, -'.drawing.json'.length);
        if (!SAFE_SYNC_FILE_ID.test(id)) continue;
        const annotation = parsePdfAnnotationStorageId(id);
        const ownerPageId = annotation?.ownerPageId ?? id;
        const owner = pagesById.get(ownerPageId) as any;
        if (!owner || owner.notebookId !== notebookId || (annotation && owner.type !== 'pdf')) continue;
        records.push({ id, notebookId, ownerPageId });
      }
    }
    return records.sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Applies a validated cloud record while preserving its stable Panvas ID. */
  async applyRemoteRecord(workspaceId: string, kind: SyncEntityKind, id: string, payload: any, tombstone: boolean): Promise<void> {
    let workspaceDir: string;
    try {
      workspaceDir = this.getWorkspaceDirById(workspaceId);
    } catch {
      await this.ensureBaseDir();
      const entries = await fsPromises.readdir(this.baseDir, { withFileTypes: true });
      for (const entry of entries.filter(item => item.isDirectory())) {
        const candidate = path.join(this.baseDir, entry.name);
        try { const existing = await this.readWorkspaceJson(candidate); if (existing.id === workspaceId) this.registerWorkspace(workspaceId, candidate); } catch { /* not a workspace */ }
      }
      try { workspaceDir = this.getWorkspaceDirById(workspaceId); }
      catch {
        // A tombstone against an entity that is already absent is idempotent.
        // Do not invent a workspace root just so reconstruction can delete a
        // child that this device never had.
        if (tombstone) return;
        if (kind !== 'workspace' || tombstone || !payload || payload.id !== workspaceId) throw new Error('Remote workspace root must be applied first.');
        const safeBase = String(payload.name || workspaceId).replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').trim().slice(0, 120) || workspaceId;
        let directoryName = safeBase;
        let suffix = 2;
        while (true) {
          const candidate = this.getWorkspaceDirByName(directoryName);
          try { await fsPromises.access(candidate); directoryName = `${safeBase} (Cloud ${suffix++})`; } catch { workspaceDir = candidate; break; }
        }
        await Promise.all([
          fsPromises.mkdir(path.join(workspaceDir!, '.panvas', 'recovery'), { recursive: true }),
          fsPromises.mkdir(path.join(workspaceDir!, 'Notebooks'), { recursive: true }),
          fsPromises.mkdir(path.join(workspaceDir!, 'Canvas'), { recursive: true }),
        ]);
        this.registerWorkspace(workspaceId, workspaceDir!);
        await this.writeWorkspaceJson(workspaceDir!, { ...payload, id: workspaceId, folders: [], canvasFiles: [], notebooks: [], notebookSections: [], notebookPages: [] });
      }
    }

    if (kind === 'pageContent' || kind === 'pageDrawing') {
      const metadata = await this.readWorkspaceJson(workspaceDir!);
      const annotation = kind === 'pageDrawing' ? parsePdfAnnotationStorageId(id) : null;
      const ownerPageId = annotation?.ownerPageId ?? id;
      const page = (metadata.notebookPages ?? []).find((item: any) => item.id === ownerPageId);
      if (!page || (annotation && page.type !== 'pdf')) throw new Error('Remote page payload has no canonical page metadata.');
      const pagesDir = path.join(workspaceDir!, 'Notebooks', page.notebookId, 'pages');
      await fsPromises.mkdir(pagesDir, { recursive: true });
      const suffix = kind === 'pageContent' ? 'content' : 'drawing';
      await writeQueue.enqueue(path.join(pagesDir, `${id}.${suffix}.json`), JSON.stringify(payload?.data ?? payload, null, 2));
      return;
    }
    if (kind === 'canvasScene') {
      await fsPromises.mkdir(path.join(workspaceDir!, 'Canvas'), { recursive: true });
      await writeQueue.enqueue(path.join(workspaceDir!, 'Canvas', `${id}.json`), JSON.stringify(payload, null, 2));
      return;
    }

    const metadata = await this.readWorkspaceJson(workspaceDir!);
    if (kind === 'workspace') {
      const nested = { folders: metadata.folders, canvasFiles: metadata.canvasFiles, notebooks: metadata.notebooks, notebookSections: metadata.notebookSections, notebookPages: metadata.notebookPages };
      await this.writeWorkspaceJson(workspaceDir!, { ...metadata, ...payload, ...nested, id: workspaceId, deletedAt: tombstone ? Date.now() : payload.deletedAt ?? null });
      return;
    }
    const collections: Partial<Record<SyncEntityKind, string>> = { folder: 'folders', notebook: 'notebooks', notebookSection: 'notebookSections', notebookPage: 'notebookPages', canvasFile: 'canvasFiles' };
    const collectionName = collections[kind];
    if (collectionName) {
      const collection = Array.isArray(metadata[collectionName]) ? metadata[collectionName] : [];
      const index = collection.findIndex((item: any) => item.id === id);
      if (tombstone && index < 0) return;
      const value = tombstone ? { ...(index >= 0 ? collection[index] : payload ?? {}), id, deletedAt: Date.now() } : { ...payload, id };
      if (index >= 0) collection[index] = value; else collection.push(value);
      metadata[collectionName] = collection;
      await this.writeWorkspaceJson(workspaceDir!, metadata);
      return;
    }
    if (kind === 'customBlock') {
      const canvasId = payload?.canvasFileId;
      if (typeof canvasId !== 'string') throw new Error('Remote custom block has no canvas owner.');
      const canvasPath = path.join(workspaceDir!, 'Canvas', `${canvasId}.json`);
      const scene = JSON.parse(await fsPromises.readFile(canvasPath, 'utf8'));
      scene.customBlocks = Array.isArray(scene.customBlocks) ? scene.customBlocks : [];
      const index = scene.customBlocks.findIndex((item: any) => item.id === id);
      if (tombstone) { if (index >= 0) scene.customBlocks.splice(index, 1); }
      else if (index >= 0) scene.customBlocks[index] = payload; else scene.customBlocks.push(payload);
      await writeQueue.enqueue(canvasPath, JSON.stringify(scene, null, 2));
    }
  }
}

export const workspaceService = new WorkspaceService();
