/** Canonical local entity enumeration and payload retrieval for Cloud Sync. */
import type { SyncEntityKind, SyncJournalEntry } from './types.ts';
import type { ScannedSyncEntity, SyncPayloadSource } from './engine.ts';
import { canonicalizeJson } from './hash.ts';
import { db, SYSTEM_DEFAULT_WORKSPACE_ID, SYSTEM_WELCOME_CANVAS_ID } from '../../database/schema.ts';
import { encodeAssetEnvelope } from './assetEnvelope.ts';
import { parsePdfAnnotationStorageId } from '../../lib/pdfAnnotationStorage.ts';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(canonicalizeJson(value));

async function readBrowserSnapshot() {
  const [workspaces, folders, notebooks, sections, pages, contents, drawings, canvases, scenes, blocks, pdfs, media] = await Promise.all([
    db.workspaces.toArray(), db.folders.toArray(), db.notebooks.toArray(), db.notebookSections.toArray(), db.notebookPages.toArray(),
    db.notebookPageContents.toArray(), db.notebookPageDrawings.toArray(), db.canvasFiles.toArray(), db.canvasData.toArray(),
    db.customBlocks.toArray(), db.pdfFiles.toArray(), db.imageFiles.toArray(),
  ]);
  return { workspaces, folders, notebooks, sections, pages, contents, drawings, canvases, scenes, blocks, pdfs, media };
}

export type BrowserSyncSnapshot = Awaited<ReturnType<typeof readBrowserSnapshot>>;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isEmptyRecord = (value: unknown): boolean => isRecord(value) && Object.keys(value).length === 0;
const isEmptyArray = (value: unknown): boolean => Array.isArray(value) && value.length === 0;

/** Returns a semantic identity only for an untouched, deterministic system bootstrap record. */
export function semanticSystemBootstrapBytes(entityType: SyncEntityKind, entityId: string, bytes: Uint8Array): Uint8Array | null {
  let value: Record<string, unknown>;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(parsed)) return null;
    value = parsed;
  } catch { return null; }

  const workspaceUntouched = entityType === 'workspace'
    && entityId === SYSTEM_DEFAULT_WORKSPACE_ID
    && value.id === SYSTEM_DEFAULT_WORKSPACE_ID
    && value.name === 'My Workspace'
    && value.isSystem === true
    && value.systemType === 'default'
    && value.isPinned === false
    && value.color == null
    && value.deletedAt == null
    && value.deletedByAncestorId == null;
  const canvasFileUntouched = entityType === 'canvasFile'
    && entityId === SYSTEM_WELCOME_CANVAS_ID
    && value.id === SYSTEM_WELCOME_CANVAS_ID
    && value.workspaceId === SYSTEM_DEFAULT_WORKSPACE_ID
    && value.name === 'Welcome Canvas'
    && value.isSystem === true
    && value.systemType === 'welcome'
    && value.folderId == null
    && value.notebookId == null
    && value.sectionId == null
    && value.order === 0
    && value.isPinned === false
    && value.deletedAt == null
    && value.deletedByAncestorId == null;
  const canvasSceneUntouched = entityType === 'canvasScene'
    && entityId === SYSTEM_WELCOME_CANVAS_ID
    && value.canvasFileId === SYSTEM_WELCOME_CANVAS_ID
    && isEmptyArray(value.elements)
    && isEmptyRecord(value.appState)
    && isEmptyRecord(value.files)
    && (value.customBlocks === undefined || isEmptyArray(value.customBlocks))
    && value.version === 1;
  if (!workspaceUntouched && !canvasFileUntouched && !canvasSceneUntouched) return null;

  const semantic = { ...value };
  delete semantic.createdAt;
  delete semantic.updatedAt;
  delete semantic.lastOpenedAt;
  delete semantic.syncStatus;
  delete semantic.userId;
  return encode(semantic);
}

type AssetKind = 'pdf' | 'image' | 'audio';
interface AssetReference {
  id: string;
  ownerId: string;
  kind: AssetKind;
  fileName?: string;
  mimeType?: string;
  createdAt?: number;
  userId?: string | null;
}

function rememberAsset(target: Map<string, AssetReference>, reference: AssetReference): void {
  if (!reference.id || !reference.ownerId) return;
  target.set(reference.id, { ...target.get(reference.id), ...reference });
}

function rememberDrawingAssets(target: Map<string, AssetReference>, drawing: any, ownerId: string): void {
  for (const object of Array.isArray(drawing?.objects) ? drawing.objects : []) {
    if (object?.type === 'image' && typeof object.fileId === 'string') rememberAsset(target, { id: object.fileId, ownerId, kind: 'image' });
  }
  for (const note of Array.isArray(drawing?.audioNotes) ? drawing.audioNotes : []) {
    if (typeof note?.fileId === 'string') rememberAsset(target, { id: note.fileId, ownerId, kind: 'audio', fileName: note.fileName, mimeType: note.mimeType, createdAt: note.createdAt });
  }
}

function rememberCanvasAssets(target: Map<string, AssetReference>, scene: any, canvasId: string): void {
  for (const block of Array.isArray(scene?.customBlocks) ? scene.customBlocks : []) {
    const metadata = block?.metadata;
    if (block?.type === 'pdf' && typeof metadata?.pdfDataId === 'string') rememberAsset(target, { id: metadata.pdfDataId, ownerId: canvasId, kind: 'pdf', fileName: block.content });
    if (block?.type === 'audio' && typeof metadata?.audioFileId === 'string') rememberAsset(target, { id: metadata.audioFileId, ownerId: canvasId, kind: 'audio', fileName: block.content, mimeType: metadata.mimeType });
  }
}

async function mapBounded<T, R>(items: readonly T[], worker: (item: T) => Promise<R>, concurrency = 8): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const index = next++; result[index] = await worker(items[index]); }
  }));
  return result;
}

export class LocalSyncPayloadSource implements SyncPayloadSource {
  private readonly scanned = new Map<string, ScannedSyncEntity>();
  private readonly snapshotReader: () => Promise<BrowserSyncSnapshot>;
  private browserSnapshot: Promise<BrowserSyncSnapshot> | null = null;

  constructor(snapshotReader: () => Promise<BrowserSyncSnapshot> = readBrowserSnapshot) {
    this.snapshotReader = snapshotReader;
  }

  beginCycle(): void {
    if (!(typeof window !== 'undefined' && window.panvas)) this.browserSnapshot = this.snapshotReader();
  }

  endCycle(): void { this.browserSnapshot = null; }

  async listWorkspaceIds(): Promise<string[]> {
    if (typeof window !== 'undefined' && window.panvas) {
      const [active, trash] = await Promise.all([window.panvas.workspace.getAll(), window.panvas.trash.getAll(null)]);
      return [...new Set([...active, ...trash.workspaces].map(item => item.id))];
    }
    return (await (this.browserSnapshot ?? this.snapshotReader())).workspaces.map(item => item.id);
  }

  async scanWorkspace(workspaceId: string): Promise<ScannedSyncEntity[]> {
    const entities = typeof window !== 'undefined' && window.panvas
      ? await this.scanElectronWorkspace(workspaceId)
      : await this.scanBrowserWorkspace(workspaceId);
    for (const [key, entity] of this.scanned) if (entity.workspaceId === workspaceId) this.scanned.delete(key);
    for (const entity of entities) this.scanned.set(`${entity.entityType}:${entity.entityId}`, entity);
    return entities;
  }

  async loadPayload(entry: SyncJournalEntry): Promise<Uint8Array | null> {
    const cached = this.scanned.get(`${entry.entityType}:${entry.entityId}`);
    if (cached) return cached.bytes;
    try {
      if (typeof window !== 'undefined' && window.panvas) {
        const found = (await this.scanElectronWorkspace(entry.workspaceId))
          .find(item => item.entityType === entry.entityType && item.entityId === entry.entityId);
        return found?.bytes ?? null;
      }
      return this.loadBrowserPayload(entry);
    } catch { return null; }
  }

  async parentOf(entry: SyncJournalEntry): Promise<string | null> {
    const cached = this.scanned.get(`${entry.entityType}:${entry.entityId}`);
    if (cached) return cached.parentId;
    try {
      if (typeof window !== 'undefined' && window.panvas) {
        const found = (await this.scanElectronWorkspace(entry.workspaceId))
          .find(item => item.entityType === entry.entityType && item.entityId === entry.entityId);
        return found?.parentId ?? null;
      }
      return this.browserParent(entry);
    } catch { return null; }
  }

  private entity(entityType: SyncEntityKind, entityId: string, workspaceId: string, parentId: string | null, value: unknown, deletedAt?: number | null): ScannedSyncEntity {
    const tombstone = Boolean(deletedAt);
    return { entityType, entityId, workspaceId, parentId, bytes: tombstone ? null : encode(value), tombstone, deletedAt: deletedAt ?? null };
  }

  private async scanElectronWorkspace(workspaceId: string): Promise<ScannedSyncEntity[]> {
    const api = window.panvas;
    const workspaces = await api.workspace.getAll();
    let workspace = workspaces.find(item => item.id === workspaceId);
    if (!workspace) {
      // Deleted workspaces are not registered in the active-workspace IPC
      // registry. Enumerate the global Trash projection, then select the
      // requested root instead of asking the bridge to resolve a deleted ID.
      const trash = await api.trash.getAll(null);
      workspace = trash.workspaces.find(item => item.id === workspaceId);
      if (!workspace) return [];
      // Deleted roots are absent from active workspace APIs. Publish the root
      // tombstone without reopening or exposing deleted descendants.
      return [this.entity('workspace', workspace.id, workspaceId, null, workspace, workspace.deletedAt)];
    }
    const [folders, notebooks, sections, pages, canvases] = await Promise.all([
      api.folder.getAll(workspaceId), api.notebook.getAll(workspaceId),
      api.notebookSection.getAll(workspaceId), api.notebookPage.getAll(workspaceId), api.canvasFile.getAll(workspaceId),
    ]);
    const result: ScannedSyncEntity[] = [this.entity('workspace', workspace.id, workspaceId, null, workspace, workspace.deletedAt)];
    for (const item of folders) result.push(this.entity('folder', item.id, workspaceId, item.parentId ?? workspaceId, item, item.deletedAt));
    for (const item of notebooks) result.push(this.entity('notebook', item.id, workspaceId, item.folderId ?? workspaceId, item, item.deletedAt));
    for (const item of sections) result.push(this.entity('notebookSection', item.id, workspaceId, item.notebookId, item, item.deletedAt));
    const referencedAssets = new Map<string, AssetReference>();
    for (const page of pages) if (!page.deletedAt && page.type === 'pdf' && page.pdfDataId) rememberAsset(referencedAssets, { id: page.pdfDataId, ownerId: page.id, kind: 'pdf' });
    const pagePayloads = await mapBounded(pages, async page => {
      const entities = [this.entity('notebookPage', page.id, workspaceId, page.sectionId ?? page.notebookId, page, page.deletedAt)];
      if (page.deletedAt) return entities;
      const [content, drawing] = await Promise.all([api.notebook.loadPage(workspaceId, page.notebookId, page.id), api.notebook.loadDrawing(workspaceId, page.notebookId, page.id)]);
      if (content !== null && content !== undefined) entities.push(this.entity('pageContent', page.id, workspaceId, page.id, { pageId: page.id, workspaceId, notebookId: page.notebookId, data: content, version: 1 }));
      if (drawing !== null && drawing !== undefined) {
        entities.push(this.entity('pageDrawing', page.id, workspaceId, page.id, { pageId: page.id, workspaceId, notebookId: page.notebookId, data: drawing, version: 1 }));
        rememberDrawingAssets(referencedAssets, drawing, page.id);
      }
      return entities;
    });
    result.push(...pagePayloads.flat());
    const drawingRecords = await api.cloudsync?.listPageDrawingRecords?.(workspaceId) ?? [];
    const annotationPayloads = await mapBounded(drawingRecords.filter(record => record.id !== record.ownerPageId), async record => {
      const drawing = await api.notebook.loadDrawing(workspaceId, record.notebookId, record.id);
      if (drawing === null || drawing === undefined) return null;
      rememberDrawingAssets(referencedAssets, drawing, record.ownerPageId);
      return this.entity('pageDrawing', record.id, workspaceId, record.ownerPageId, { pageId: record.id, workspaceId, notebookId: record.notebookId, data: drawing, version: 1 });
    });
    result.push(...annotationPayloads.filter((item): item is NonNullable<typeof item> => item !== null));
    const canvasPayloads = await mapBounded(canvases, async canvas => {
      const entities = [this.entity('canvasFile', canvas.id, workspaceId, canvas.folderId ?? canvas.notebookId ?? workspaceId, canvas, canvas.deletedAt)];
      if (canvas.deletedAt) return entities;
      const scene = await api.canvas.load(workspaceId, canvas.id);
      if (scene !== null && scene !== undefined) {
        entities.push(this.entity('canvasScene', canvas.id, workspaceId, canvas.id, scene));
        rememberCanvasAssets(referencedAssets, scene, canvas.id);
      }
      return entities;
    });
    result.push(...canvasPayloads.flat());
    if (typeof indexedDB !== 'undefined') {
      const ownerIds = new Set([...pages.map(item => item.id), ...canvases.map(item => item.id), ...drawingRecords.map(item => item.id)]);
      const [pdfs, media] = await Promise.all([db.pdfFiles.toArray(), db.imageFiles.toArray()]);
      for (const item of pdfs.filter(item => ownerIds.has(item.canvasFileId))) rememberAsset(referencedAssets, { id: item.id, ownerId: item.canvasFileId, kind: 'pdf', fileName: item.fileName, createdAt: item.createdAt, userId: item.userId });
      for (const item of media.filter(item => ownerIds.has(item.canvasFileId))) rememberAsset(referencedAssets, { id: item.id, ownerId: item.canvasFileId, kind: /^audio\//i.test(item.mimeType) ? 'audio' : 'image', fileName: item.fileName, mimeType: item.mimeType, createdAt: item.createdAt, userId: item.userId });
    }
    const assetEntities = await mapBounded([...referencedAssets.values()], async item => {
      const stored = item.kind === 'pdf' ? await api.binary.getPdf(item.id) : item.kind === 'audio' ? await api.binary.getAudio(item.id) : await api.binary.getImage(item.id);
      if (!stored?.data) return null;
      const mimeType = item.kind === 'pdf' ? 'application/pdf' : (stored as any).mimeType ?? item.mimeType ?? 'application/octet-stream';
      return { entityType: 'asset' as const, entityId: item.id, workspaceId, parentId: item.ownerId, bytes: encodeAssetEnvelope({ id: item.id, ownerId: item.ownerId, fileName: stored.fileName || item.fileName || item.id, mimeType, assetKind: item.kind, createdAt: item.createdAt ?? (stored as any).createdAt ?? 0, userId: item.userId ?? null }, new Uint8Array(stored.data)), tombstone: false, deletedAt: null };
    });
    result.push(...assetEntities.filter((item): item is NonNullable<typeof item> => item !== null));
    return result;
  }

  private async scanBrowserWorkspace(workspaceId: string): Promise<ScannedSyncEntity[]> {
    const { workspaces, folders: allFolders, notebooks: allNotebooks, sections, pages, contents, drawings, canvases: allCanvases, scenes, blocks, pdfs, media } = await (this.browserSnapshot ?? this.snapshotReader());
    const workspace = workspaces.find(item => item.id === workspaceId);
    if (!workspace) return [];
    const folders = allFolders.filter(item => item.workspaceId === workspaceId);
    const notebooks = allNotebooks.filter(item => item.workspaceId === workspaceId);
    const canvases = allCanvases.filter(item => item.workspaceId === workspaceId);
    const notebookIds = new Set(notebooks.map(item => item.id));
    const pageIds = new Set(pages.filter(item => notebookIds.has(item.notebookId)).map(item => item.id));
    const canvasIds = new Set(canvases.map(item => item.id));
    const result: ScannedSyncEntity[] = [this.entity('workspace', workspace.id, workspaceId, null, workspace, workspace.deletedAt)];
    for (const item of folders) result.push(this.entity('folder', item.id, workspaceId, item.parentId ?? workspaceId, item, item.deletedAt));
    for (const item of notebooks) result.push(this.entity('notebook', item.id, workspaceId, item.folderId ?? workspaceId, item, item.deletedAt));
    for (const item of sections.filter(item => notebookIds.has(item.notebookId))) result.push(this.entity('notebookSection', item.id, workspaceId, item.notebookId, item, item.deletedAt));
    for (const item of pages.filter(item => notebookIds.has(item.notebookId))) result.push(this.entity('notebookPage', item.id, workspaceId, item.sectionId ?? item.notebookId, item, item.deletedAt));
    for (const item of contents.filter(item => pageIds.has(item.pageId))) result.push(this.entity('pageContent', item.pageId, workspaceId, item.pageId, item));
    const drawingIds = new Set<string>();
    for (const item of drawings) {
      const annotation = parsePdfAnnotationStorageId(item.pageId);
      const ownerPageId = annotation?.ownerPageId ?? item.pageId;
      if (!pageIds.has(ownerPageId)) continue;
      result.push(this.entity('pageDrawing', item.pageId, workspaceId, ownerPageId, item));
      drawingIds.add(item.pageId);
    }
    for (const item of canvases) result.push(this.entity('canvasFile', item.id, workspaceId, item.folderId ?? item.notebookId ?? workspaceId, item, item.deletedAt));
    for (const item of scenes.filter(item => canvasIds.has(item.canvasFileId))) result.push(this.entity('canvasScene', item.canvasFileId, workspaceId, item.canvasFileId, item));
    for (const item of blocks.filter(item => canvasIds.has(item.canvasFileId))) result.push(this.entity('customBlock', item.id, workspaceId, item.canvasFileId, item));
    const ownerIds = new Set([...pageIds, ...canvasIds, ...drawingIds]);
    for (const item of pdfs.filter(item => ownerIds.has(item.canvasFileId))) result.push({ entityType: 'asset', entityId: item.id, workspaceId, parentId: item.canvasFileId, bytes: encodeAssetEnvelope({ id: item.id, ownerId: item.canvasFileId, fileName: item.fileName, mimeType: 'application/pdf', assetKind: 'pdf', createdAt: item.createdAt, userId: item.userId }, new Uint8Array(item.data)), tombstone: false, deletedAt: null });
    for (const item of media.filter(item => ownerIds.has(item.canvasFileId))) result.push({ entityType: 'asset', entityId: item.id, workspaceId, parentId: item.canvasFileId, bytes: encodeAssetEnvelope({ id: item.id, ownerId: item.canvasFileId, fileName: item.fileName, mimeType: item.mimeType, assetKind: /^audio\//i.test(item.mimeType) ? 'audio' : 'image', createdAt: item.createdAt, userId: item.userId }, new Uint8Array(item.data)), tombstone: false, deletedAt: null });
    return result;
  }

  private async loadBrowserPayload(entry: SyncJournalEntry): Promise<Uint8Array | null> {
    let value: unknown;
    switch (entry.entityType) {
      case 'workspace': value = await db.workspaces.get(entry.entityId); break;
      case 'folder': value = await db.folders.get(entry.entityId); break;
      case 'notebook': value = await db.notebooks.get(entry.entityId); break;
      case 'notebookSection': value = await db.notebookSections.get(entry.entityId); break;
      case 'notebookPage': value = await db.notebookPages.get(entry.entityId); break;
      case 'pageContent': value = await db.notebookPageContents.get(entry.entityId); break;
      case 'pageDrawing': value = await db.notebookPageDrawings.get(entry.entityId); break;
      case 'canvasFile': value = await db.canvasFiles.get(entry.entityId); break;
      case 'canvasScene': value = await db.canvasData.get(entry.entityId); break;
      case 'customBlock': value = await db.customBlocks.get(entry.entityId); break;
      case 'asset': {
        const asset = await db.pdfFiles.get(entry.entityId) ?? await db.imageFiles.get(entry.entityId);
        if (!asset) return null;
        const isPdf = !('mimeType' in asset);
        const mimeType = isPdf ? 'application/pdf' : String(asset.mimeType);
        return encodeAssetEnvelope({ id: asset.id, ownerId: asset.canvasFileId, fileName: asset.fileName, mimeType, assetKind: isPdf ? 'pdf' : /^audio\//i.test(mimeType) ? 'audio' : 'image', createdAt: asset.createdAt, userId: asset.userId }, new Uint8Array(asset.data));
      }
      default: value = null;
    }
    return value === null || value === undefined ? null : encode(value);
  }

  private async browserParent(entry: SyncJournalEntry): Promise<string | null> {
    switch (entry.entityType) {
      case 'folder': return (await db.folders.get(entry.entityId))?.parentId ?? entry.workspaceId;
      case 'notebook': return (await db.notebooks.get(entry.entityId))?.folderId ?? entry.workspaceId;
      case 'notebookSection': return (await db.notebookSections.get(entry.entityId))?.notebookId ?? null;
      case 'notebookPage': { const item = await db.notebookPages.get(entry.entityId); return item?.sectionId ?? item?.notebookId ?? null; }
      case 'pageContent': case 'canvasScene': return entry.entityId;
      case 'pageDrawing': return parsePdfAnnotationStorageId(entry.entityId)?.ownerPageId ?? entry.entityId;
      case 'canvasFile': { const item = await db.canvasFiles.get(entry.entityId); return item?.folderId ?? item?.notebookId ?? entry.workspaceId; }
      case 'customBlock': return (await db.customBlocks.get(entry.entityId))?.canvasFileId ?? null;
      case 'asset': return (await db.pdfFiles.get(entry.entityId))?.canvasFileId ?? (await db.imageFiles.get(entry.entityId))?.canvasFileId ?? null;
      default: return null;
    }
  }
}
