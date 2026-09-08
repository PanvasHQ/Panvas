import type { CloudSyncProvider, RecordPointer, RemoteWorkspaceSummary, SyncJournalEntry } from './types.ts';
import type { ScannedSyncEntity, SyncEntryError, SyncJournalStore, SyncPayloadSource } from './engine.ts';
import { applyRemoteChanges, type RemoteRecordLocalAdapter } from './applyRemoteChanges.ts';
import { createJournalEntry } from './journal.ts';
import { sha256Bytes } from './hash.ts';
import { validateRemoteManifest } from './manifest.ts';
import { CloudOperationError } from './errors.ts';

const entityKey = (value: { entityType: string; entityId: string }) => `${value.entityType}:${value.entityId}`;

function syncedBaseline(workspaceId: string, pointer: RecordPointer, now: number): SyncJournalEntry {
  return {
    entryId: `remote:${workspaceId}:${pointer.kind}:${pointer.id}:${pointer.revision}`,
    entityType: pointer.kind, entityId: pointer.id, workspaceId,
    operation: pointer.tombstone ? 'delete' : 'create', localRevision: pointer.revision,
    contentHash: pointer.tombstone ? null : pointer.contentHash, baseRevision: pointer.baseRevision,
    updatedAt: now, deletedAt: pointer.tombstone ? now : null, tombstone: pointer.tombstone,
    state: 'synced', attempts: 0, nextAttemptAt: null, lastErrorClass: null,
    payloadRef: pointer.tombstone ? null : pointer.id,
  };
}

async function stageExistingReplica(input: {
  workspaceId: string;
  records: readonly RecordPointer[];
  journalStore: SyncJournalStore;
  payloadSource: SyncPayloadSource;
  now: number;
}): Promise<number> {
  if (!input.payloadSource.scanWorkspace) return 0;
  const scanned = await input.payloadSource.scanWorkspace(input.workspaceId);
  const remote = new Map(input.records.map(pointer => [`${pointer.kind}:${pointer.id}`, pointer]));
  const latest = await input.journalStore.latestByEntity(input.workspaceId);
  const localKeys = new Set(scanned.map(entityKey));
  let stagedConflicts = 0;
  for (const local of scanned) {
    const key = entityKey(local);
    const existing = latest.get(key);
    if (existing && ['pending', 'syncing', 'conflict', 'error'].includes(existing.state)) continue;
    const pointer = remote.get(key);
    const contentHash = local.tombstone ? null : local.bytes ? await sha256Bytes(local.bytes) : null;
    if (!local.tombstone && !contentHash) continue;
    if (pointer && pointer.tombstone === local.tombstone && (local.tombstone || pointer.contentHash === contentHash)) {
      await input.journalStore.upsert(syncedBaseline(input.workspaceId, pointer, input.now));
      continue;
    }
    const operation = local.tombstone ? 'delete' : pointer?.tombstone ? 'restore' : pointer ? 'update' : 'create';
    // An unbound local replica that differs from an existing remote head has
    // no proven common base. Deliberately use a stale base so the normal
    // conflict engine preserves both sides rather than overwriting either.
    const baseRevision = pointer ? Math.max(0, pointer.revision - 1) : null;
    const entry = createJournalEntry({
      entityType: local.entityType, entityId: local.entityId, workspaceId: input.workspaceId,
      operation, currentLocalRevision: Math.max(existing?.localRevision ?? 0, pointer?.revision ?? 0),
      contentHash, baseRevision, deletedAt: local.deletedAt, payloadRef: local.tombstone ? null : local.entityId,
      now: input.now, entryId: `attach:${local.entityType}:${local.entityId}:${input.now}`,
    });
    await input.journalStore.upsert(entry);
    if (pointer) stagedConflicts += 1;
  }
  for (const pointer of input.records) {
    const key = `${pointer.kind}:${pointer.id}`;
    if (!pointer.tombstone || localKeys.has(key) || latest.has(key)) continue;
    // Explicit deletion of an entity this replica never had is already
    // satisfied. Keep its baseline for idempotency without inventing a local
    // deleted row or invoking the filesystem reconstruction path.
    await input.journalStore.upsert(syncedBaseline(input.workspaceId, pointer, input.now));
  }
  return stagedConflicts;
}

export async function attachWorkspaceReplica(input: {
  workspaceId: string;
  records: RecordPointer[];
  remoteRevision: number;
  hasLocalWorkspace: boolean;
  provider: CloudSyncProvider;
  journalStore: SyncJournalStore;
  payloadSource: SyncPayloadSource;
  localAdapter?: RemoteRecordLocalAdapter;
  now?: number;
  onProgress?: (completed: number, total: number) => void;
}): Promise<{ applied: number; skipped: number; errors: number; stagedConflicts: number; firstError?: SyncEntryError }> {
  const now = input.now ?? Date.now();
  const stagedConflicts = input.hasLocalWorkspace
    ? await stageExistingReplica({ workspaceId: input.workspaceId, records: input.records, journalStore: input.journalStore, payloadSource: input.payloadSource, now })
    : 0;
  const root = input.records.find(pointer => pointer.kind === 'workspace' && pointer.id === input.workspaceId);
  if (!input.hasLocalWorkspace && !root && input.records.some(pointer => !pointer.tombstone)) {
    const first = input.records.find(pointer => !pointer.tombstone)!;
    return {
      applied: 0, skipped: 0, errors: 1, stagedConflicts,
      firstError: {
        entityId: first.id, entityType: first.kind, operation: 'create',
        stage: 'remote-record-apply', errorClass: 'provider-error',
        providerReason: 'workspace-root-missing', retryable: false,
      },
    };
  }
  // A deleted remote workspace is not reconstructed. Any child records under
  // that tombstoned root are historical and must not resurrect the tree.
  const records = !input.hasLocalWorkspace && root?.tombstone
    ? input.records.filter(pointer => pointer.tombstone)
    : input.records;
  const applied = await applyRemoteChanges({
    workspaceId: input.workspaceId, records, provider: input.provider,
    journalStore: input.journalStore, localAdapter: input.localAdapter, now, onProgress: input.onProgress,
    mode: input.hasLocalWorkspace ? 'reconcile' : 'reconstruct',
  });
  return { ...applied, stagedConflicts };
}

export async function replicateMissingRemoteWorkspaces(input: {
  remoteWorkspaces: readonly RemoteWorkspaceSummary[];
  localWorkspaceIds: readonly string[];
  provider: CloudSyncProvider;
  journalStore: SyncJournalStore;
  payloadSource: SyncPayloadSource;
  localAdapter?: RemoteRecordLocalAdapter;
  now?: number;
  onWorkspace?: (completed: number, total: number, workspaceId: string) => void;
  onRecordProgress?: (workspaceNumber: number, workspaceTotal: number, completed: number, total: number, workspaceId: string) => void;
}): Promise<Array<{ workspaceId: string; remoteRevision: number }>> {
  const localIds = new Set(input.localWorkspaceIds);
  const missing = input.remoteWorkspaces.filter(remote => remote.workspaceId !== 'default' && !localIds.has(remote.workspaceId));
  const replicated: Array<{ workspaceId: string; remoteRevision: number }> = [];

  for (let index = 0; index < missing.length; index += 1) {
    const remoteWorkspace = missing[index];
    input.onWorkspace?.(index + 1, missing.length, remoteWorkspace.workspaceId);
    const remote = await input.provider.readManifest(remoteWorkspace.workspaceId);
    const manifest = remote.manifest ? validateRemoteManifest(remote.manifest) : null;
    if (!manifest || manifest.workspaceId !== remoteWorkspace.workspaceId) {
      throw new CloudOperationError('remote-workspace', {
        workspaceId: remoteWorkspace.workspaceId,
        stage: 'workspace-attach',
        operation: 'read-manifest',
        reason: 'manifest-unavailable',
        retryable: false,
      });
    }
    const attached = await attachWorkspaceReplica({
      workspaceId: remoteWorkspace.workspaceId,
      records: manifest.records,
      remoteRevision: manifest.revision,
      hasLocalWorkspace: false,
      provider: input.provider,
      journalStore: input.journalStore,
      payloadSource: input.payloadSource,
      localAdapter: input.localAdapter,
      now: input.now,
      onProgress: (completed, total) => input.onRecordProgress?.(index + 1, missing.length, completed, total, remoteWorkspace.workspaceId),
    });
    if (attached.errors > 0) {
      throw new CloudOperationError('remote-workspace', {
        workspaceId: remoteWorkspace.workspaceId,
        stage: 'workspace-reconstruction',
        reason: attached.firstError?.providerReason ?? attached.firstError?.errorClass ?? 'record-apply-failed',
        status: attached.firstError?.providerStatus,
        entityKind: attached.firstError?.entityType,
        entityId: attached.firstError?.entityId,
        operation: attached.firstError?.operation,
        retryable: attached.firstError?.retryable ?? false,
      });
    }
    const activeRoot = manifest.records.some(pointer => pointer.kind === 'workspace' && pointer.id === remoteWorkspace.workspaceId && !pointer.tombstone);
    if (activeRoot) replicated.push({ workspaceId: remoteWorkspace.workspaceId, remoteRevision: manifest.revision });
  }

  return replicated;
}
