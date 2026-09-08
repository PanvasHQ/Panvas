/** Downloads remote manifest records into the canonical local adapter. */
import type { CloudSyncProvider, RecordPointer, SyncEntityKind, SyncJournalEntry } from './types.ts';
import { db } from '../../database/schema.ts';
import type { SyncEntryError, SyncEntryErrorClass, SyncJournalStore } from './engine.ts';
import { decodeAssetEnvelope } from './assetEnvelope.ts';

const APPLY_PHASE: Record<SyncEntityKind, number> = {
  workspace: 0,
  folder: 1,
  notebook: 2,
  notebookSection: 3,
  notebookPage: 4,
  canvasFile: 4,
  pageContent: 5,
  pageDrawing: 5,
  canvasScene: 5,
  customBlock: 6,
  asset: 7,
};

export interface RemoteRecordLocalAdapter {
  applyRecord(input: { workspaceId: string; pointer: RecordPointer; bytes: Uint8Array | null }): Promise<void>;
}

function applyFailure(error: unknown, pointer: RecordPointer, stage: 'remote-object-download' | 'remote-record-apply'): SyncEntryError {
  const candidate = error as { name?: string; status?: number; reason?: string };
  const name = String(candidate?.name ?? 'Error');
  const status = typeof candidate?.status === 'number' ? candidate.status : undefined;
  const errorClass: SyncEntryErrorClass = name === 'AuthExpiredError' || status === 401 ? 'auth-expired'
    : name === 'RateLimitedError' || status === 429 ? 'rate-limited'
      : 'provider-error';
  return {
    entityId: pointer.id,
    entityType: pointer.kind,
    operation: pointer.tombstone ? 'delete' : 'create',
    stage,
    errorClass,
    providerStatus: status,
    providerReason: stage === 'remote-record-apply' ? 'local-apply-failed' : String(candidate?.reason ?? name),
    retryable: stage === 'remote-object-download' && (errorClass === 'rate-limited' || name === 'GoogleDriveTimeoutError' || name === 'AbortError' || name === 'TypeError' || status === 408 || Boolean(status && status >= 500)),
  };
}

async function mapBounded<T>(items: readonly T[], worker: (item: T) => Promise<void>, concurrency = 4): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

export async function applyRemoteChanges(input: {
  workspaceId: string;
  records: RecordPointer[];
  provider: CloudSyncProvider;
  journalStore: SyncJournalStore;
  localAdapter?: RemoteRecordLocalAdapter;
  mode?: 'reconcile' | 'reconstruct';
  now?: number;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{ applied: number; skipped: number; errors: number; firstError?: SyncEntryError }> {
  const { workspaceId, provider, journalStore, mode = 'reconcile', now = Date.now(), onProgress } = input;
  const localAdapter = input.localAdapter ?? defaultRemoteRecordLocalAdapter;
  let applied = 0, skipped = 0, errors = 0, completed = 0;
  let firstError: SyncEntryError | undefined;
  let workspaceTombstoneSatisfied = false;
  const localEntries = await journalStore.latestByEntity(workspaceId);
  const records = [...input.records].sort((left, right) => APPLY_PHASE[left.kind] - APPLY_PHASE[right.kind]);

  // Metadata/content ordering matters, so process each dependency tier in
  // order while keeping downloads within a tier bounded-concurrent.
  for (const phase of [...new Set(records.map(pointer => APPLY_PHASE[pointer.kind]))]) {
    const tier = records.filter(pointer => APPLY_PHASE[pointer.kind] === phase);
    await mapBounded(tier, async pointer => {
      const key = `${pointer.kind}:${pointer.id}`;
      const local = localEntries.get(key);
      if (workspaceTombstoneSatisfied && pointer.kind !== 'workspace') {
        const baseline: SyncJournalEntry = {
          entryId: `remote:${workspaceId}:${pointer.kind}:${pointer.id}:${pointer.revision}`,
          entityType: pointer.kind, entityId: pointer.id, workspaceId,
          operation: pointer.tombstone ? 'delete' : 'create', localRevision: pointer.revision,
          contentHash: pointer.tombstone ? null : pointer.contentHash, baseRevision: pointer.baseRevision,
          updatedAt: now, deletedAt: pointer.tombstone ? now : null, tombstone: pointer.tombstone,
          state: 'synced', attempts: 0, nextAttemptAt: null, lastErrorClass: null,
          payloadRef: pointer.tombstone ? null : pointer.id,
        };
        await journalStore.upsert(baseline); localEntries.set(key, baseline);
        skipped += 1; completed += 1; onProgress?.(completed, records.length); return;
      }
      if (mode === 'reconstruct' && pointer.tombstone) {
        // The entity is absent on a fresh replica. Preserve the explicit
        // remote tombstone as a baseline, but do not invent deleted metadata
        // or require a workspace root solely in order to delete nothing.
        const baseline: SyncJournalEntry = {
          entryId: `remote:${workspaceId}:${pointer.kind}:${pointer.id}:${pointer.revision}`,
          entityType: pointer.kind, entityId: pointer.id, workspaceId,
          operation: 'delete', localRevision: pointer.revision,
          contentHash: null, baseRevision: pointer.baseRevision,
          updatedAt: now, deletedAt: now, tombstone: true,
          state: 'synced', attempts: 0, nextAttemptAt: null, lastErrorClass: null, payloadRef: null,
        };
        await journalStore.upsert(baseline); localEntries.set(key, baseline);
        if (pointer.kind === 'workspace') workspaceTombstoneSatisfied = true;
        skipped += 1; completed += 1; onProgress?.(completed, records.length); return;
      }
      if (mode === 'reconcile' && (local?.state === 'pending' || local?.state === 'syncing' || local?.state === 'conflict' || local?.state === 'error')) {
        skipped += 1; completed += 1; onProgress?.(completed, records.length); return;
      }
      if (mode === 'reconcile' && local && local.localRevision >= pointer.revision
        && local.tombstone === pointer.tombstone
        && (pointer.tombstone || local.contentHash === pointer.contentHash)) {
        if (pointer.kind === 'workspace' && pointer.tombstone) workspaceTombstoneSatisfied = true;
        skipped += 1; completed += 1; onProgress?.(completed, records.length); return;
      }
      if (mode === 'reconcile' && pointer.tombstone
        && (!local || local.state !== 'synced' || pointer.baseRevision !== local.localRevision || pointer.revision <= local.localRevision)) {
        const failure: SyncEntryError = {
          entityId: pointer.id, entityType: pointer.kind, operation: 'delete',
          stage: 'remote-record-apply', errorClass: 'conflict',
          providerReason: 'destructive-base-unproven', retryable: false,
        };
        firstError ??= failure;
        errors += 1; completed += 1; onProgress?.(completed, records.length); return;
      }
      let bytes: Uint8Array | null;
      try {
        bytes = pointer.tombstone ? null : await provider.getObject(workspaceId, pointer.contentHash);
      } catch (error) {
        firstError ??= applyFailure(error, pointer, 'remote-object-download');
        errors += 1; completed += 1; onProgress?.(completed, records.length); return;
      }
      try {
        await localAdapter.applyRecord({ workspaceId, pointer, bytes });
        const baseline: SyncJournalEntry = {
          entryId: `remote:${workspaceId}:${pointer.kind}:${pointer.id}:${pointer.revision}`,
          entityType: pointer.kind, entityId: pointer.id, workspaceId,
          operation: pointer.tombstone ? 'delete' : 'create', localRevision: pointer.revision,
          contentHash: pointer.tombstone ? null : pointer.contentHash, baseRevision: pointer.baseRevision,
          updatedAt: now, deletedAt: pointer.tombstone ? now : null, tombstone: pointer.tombstone,
          state: 'synced', attempts: 0, nextAttemptAt: null, lastErrorClass: null, payloadRef: pointer.tombstone ? null : pointer.id,
        };
        await journalStore.upsert(baseline); localEntries.set(key, baseline); applied += 1;
        if (pointer.kind === 'workspace' && pointer.tombstone) workspaceTombstoneSatisfied = true;
      } catch (error) {
        firstError ??= applyFailure(error, pointer, 'remote-record-apply');
        errors += 1;
      }
      completed += 1; onProgress?.(completed, records.length);
    });
  }
  return firstError ? { applied, skipped, errors, firstError } : { applied, skipped, errors };
}

export const defaultRemoteRecordLocalAdapter: RemoteRecordLocalAdapter = {
  async applyRecord({ workspaceId, pointer, bytes }) {
    if (pointer.tombstone) { await applySoftDelete(workspaceId, pointer.kind, pointer.id); return; }
    if (!bytes) throw new Error('Remote object bytes are unavailable.');
    if (pointer.kind === 'asset') { await saveAssetLocally(bytes); return; }
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    await savePayloadLocally(workspaceId, pointer.kind, pointer.id, payload, false);
  },
};

async function applySoftDelete(workspaceId: string, kind: SyncEntityKind, id: string): Promise<void> {
  if (typeof window !== 'undefined' && window.panvas?.cloudsync?.applyRemoteRecord && kind !== 'asset') {
    await window.panvas.cloudsync.applyRemoteRecord(workspaceId, { kind, id, payload: null, tombstone: true });
    return;
  }
  const deletedAt = Date.now();
  if (kind === 'workspace') await db.workspaces.update(id, { deletedAt } as any);
  else if (kind === 'folder') await db.folders.update(id, { deletedAt } as any);
  else if (kind === 'notebook') await db.notebooks.update(id, { deletedAt } as any);
  else if (kind === 'notebookSection') await db.notebookSections.update(id, { deletedAt } as any);
  else if (kind === 'notebookPage') await db.notebookPages.update(id, { deletedAt } as any);
  else if (kind === 'canvasFile') await db.canvasFiles.update(id, { deletedAt } as any);
  else if (kind === 'asset') { await db.pdfFiles.delete(id); await db.imageFiles.delete(id); }
}

async function saveAssetLocally(bytes: Uint8Array): Promise<void> {
  const decoded = decodeAssetEnvelope(bytes);
  if (!decoded) throw new Error('Remote asset uses an unsupported legacy payload envelope.');
  const { metadata, bytes: data } = decoded;
  const buffer = data.slice().buffer;
  if (metadata.assetKind === 'pdf') {
    await db.pdfFiles.put({ id: metadata.id, canvasFileId: metadata.ownerId, fileName: metadata.fileName, data: buffer, createdAt: metadata.createdAt, userId: metadata.userId });
    if (typeof window !== 'undefined' && window.panvas) await window.panvas.binary.storePdf(metadata.id, metadata.fileName, buffer);
  } else {
    await db.imageFiles.put({ id: metadata.id, canvasFileId: metadata.ownerId, fileName: metadata.fileName, mimeType: metadata.mimeType, data: buffer, createdAt: metadata.createdAt, userId: metadata.userId });
    if (typeof window !== 'undefined' && window.panvas) {
      if (metadata.assetKind === 'audio') await window.panvas.binary.storeAudio(metadata.id, metadata.fileName, metadata.mimeType, buffer);
      else await window.panvas.binary.storeImage(metadata.id, metadata.fileName, metadata.mimeType, buffer);
    }
  }
}

async function savePayloadLocally(workspaceId: string, kind: SyncEntityKind, id: string, payload: any, tombstone: boolean): Promise<void> {
  if (typeof window !== 'undefined' && window.panvas?.cloudsync?.applyRemoteRecord) {
    await window.panvas.cloudsync.applyRemoteRecord(workspaceId, { kind, id, payload, tombstone });
    return;
  }
  if (kind === 'workspace') await db.workspaces.put(payload);
  else if (kind === 'folder') await db.folders.put(payload);
  else if (kind === 'notebook') await db.notebooks.put(payload);
  else if (kind === 'notebookSection') await db.notebookSections.put(payload);
  else if (kind === 'notebookPage') await db.notebookPages.put(payload);
  else if (kind === 'pageContent') await db.notebookPageContents.put(payload);
  else if (kind === 'pageDrawing') await db.notebookPageDrawings.put(payload);
  else if (kind === 'canvasFile') await db.canvasFiles.put(payload);
  else if (kind === 'canvasScene') await db.canvasData.put(payload);
  else if (kind === 'customBlock') await db.customBlocks.put(payload);
}
