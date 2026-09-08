import { sha256Bytes } from '../hash.ts';
import type { ScannedSyncEntity } from '../engine.ts';
import { CloudOperationError, presentCloudError, type CloudErrorCode } from '../errors.ts';
import { semanticSystemBootstrapBytes } from '../payloadSource.ts';
import type { SafeCloudDiagnostic, SyncEntityKind } from '../types.ts';
import type { SyncV2BaselineRecord, SyncV2BaselineStore, SyncV2Catalog, SyncV2ConflictStore, SyncV2LocalAdapter, SyncV2LocalSource, SyncV2Manifest, SyncV2Profile, SyncV2Provider, SyncV2Record } from './types.ts';

const keyOf = (value: { kind?: SyncEntityKind; entityType?: SyncEntityKind; id?: string; entityId?: string }) => `${value.kind ?? value.entityType}:${value.id ?? value.entityId}`;
const phase: Record<SyncEntityKind, number> = { workspace: 0, folder: 1, notebook: 2, notebookSection: 3, notebookPage: 4, canvasFile: 4, pageContent: 5, pageDrawing: 5, canvasScene: 5, customBlock: 6, asset: 7 };

async function mapBounded<T>(items: readonly T[], worker: (item: T) => Promise<void>, concurrency = 8): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

export interface SyncV2Result {
  status: 'synced' | 'synced-review' | 'conflict' | 'blocked' | 'error';
  uploaded: number;
  downloaded: number;
  preservedConflicts: number;
  conflicts: Array<{ workspaceId: string; kind: SyncEntityKind; id: string }>;
  error?: string;
  errorCode?: CloudErrorCode;
  diagnostic?: SafeCloudDiagnostic;
}

function validProfile(value: SyncV2Profile | null): value is SyncV2Profile {
  return Boolean(value && value.format === 'panvas-sync-v2-profile' && value.schemaVersion === 2 && value.profileId && value.accountIdentifier);
}
function validCatalog(value: SyncV2Catalog | null): value is SyncV2Catalog {
  return Boolean(value && value.format === 'panvas-sync-v2-catalog' && value.schemaVersion === 2 && Number.isFinite(value.revision) && Array.isArray(value.workspaces));
}
function validManifest(value: SyncV2Manifest | null, workspaceId: string): value is SyncV2Manifest {
  return Boolean(value && value.format === 'panvas-sync-v2-manifest' && value.schemaVersion === 2 && value.workspaceId === workspaceId && Number.isFinite(value.revision) && Array.isArray(value.records)
    && value.records.every(record => record.id && record.kind && (record.tombstone ? record.hash === null : /^[a-f0-9]{64}$/.test(record.hash ?? ''))));
}

async function localRecord(entity: ScannedSyncEntity): Promise<{ entity: ScannedSyncEntity; hash: string | null; bootstrapIdentityHash: string | null }> {
  const bootstrapIdentity = !entity.tombstone && entity.bytes
    ? semanticSystemBootstrapBytes(entity.entityType, entity.entityId, entity.bytes)
    : null;
  const [hash, bootstrapIdentityHash] = await Promise.all([
    entity.tombstone ? null : entity.bytes ? sha256Bytes(entity.bytes) : null,
    bootstrapIdentity ? sha256Bytes(bootstrapIdentity) : null,
  ]);
  return { entity, hash, bootstrapIdentityHash };
}

function baselineFor(record: SyncV2Record, localHash: string | null, revision: number): SyncV2BaselineRecord {
  return { entityId: record.id, entityKind: record.kind, baseHash: record.hash, localHash, remoteHash: record.hash, remoteRevision: revision, tombstone: record.tombstone };
}

function v2Failure(stage: string, reason: string, operation: string, entityKind?: SyncEntityKind): CloudOperationError {
  return new CloudOperationError('sync', { stage, reason, operation, entityKind, retryable: false });
}

function blocked(result: SyncV2Result, reason: string): SyncV2Result {
  const shown = presentCloudError(new CloudOperationError('connection', { stage: 'profile-validation', reason, operation: 'adopt', retryable: false }));
  return { ...result, status: 'blocked', error: shown.message, errorCode: shown.code, diagnostic: shown.diagnostic };
}

export async function runCloudSyncV2(input: {
  accountIdentifier: string;
  provider: SyncV2Provider;
  source: SyncV2LocalSource;
  adapter: SyncV2LocalAdapter;
  baselines: SyncV2BaselineStore;
  conflictStore: SyncV2ConflictStore;
  onProgress?: (message: string) => void;
}): Promise<SyncV2Result> {
  const result: SyncV2Result = { status: 'error', uploaded: 0, downloaded: 0, preservedConflicts: 0, conflicts: [] };
  input.source.beginCycle?.();
  try {
    input.onProgress?.('Checking cloud…');
    const localProfile = await input.baselines.loadProfile();
    if (localProfile && localProfile.accountIdentifier !== input.accountIdentifier) return blocked(result, 'local-account-mismatch');

    const [profileRead, catalogRead] = await Promise.all([input.provider.readProfile(), input.provider.readCatalog()]);
    if (profileRead.value && !validProfile(profileRead.value)) throw v2Failure('profile-validation', 'invalid-cloud-profile', 'read-profile');
    if (catalogRead.value && !validCatalog(catalogRead.value)) throw v2Failure('catalog-validation', 'invalid-cloud-catalog', 'read-catalog');
    if (profileRead.value && profileRead.value.accountIdentifier !== input.accountIdentifier) return blocked(result, 'remote-account-mismatch');
    if (!profileRead.value && catalogRead.value && catalogRead.value.workspaces.length > 0) return blocked(result, 'remote-account-ambiguous');
    const profile = profileRead.value ?? { format: 'panvas-sync-v2-profile', schemaVersion: 2, profileId: localProfile?.profileId ?? crypto.randomUUID(), accountIdentifier: input.accountIdentifier };
    if (!profileRead.value) await input.provider.writeProfile(profile, profileRead.etag);
    if (localProfile && localProfile.profileId !== profile.profileId) return blocked(result, 'profile-id-mismatch');

    const catalog: SyncV2Catalog = catalogRead.value ?? { format: 'panvas-sync-v2-catalog', schemaVersion: 2, revision: 0, workspaces: [] };
    const localIds = (await input.source.listWorkspaceIds()).filter(id => id !== 'default');
    const remoteIds = catalog.workspaces.map(item => item.workspaceId);
    const workspaceIds = [...new Set([...localIds, ...remoteIds])].sort();
    const stagedBaselines = new Map<string, SyncV2BaselineRecord[]>();
    const nextCatalog = new Map(catalog.workspaces.map(item => [item.workspaceId, item]));
    let catalogChanged = !catalogRead.value;

    for (let workspaceIndex = 0; workspaceIndex < workspaceIds.length; workspaceIndex += 1) {
      const workspaceId = workspaceIds[workspaceIndex];
      input.onProgress?.(`Syncing workspace ${workspaceIndex + 1} of ${workspaceIds.length}…`);
      const [manifestRead, scanned] = await Promise.all([input.provider.readManifest(workspaceId), input.source.scanWorkspace(workspaceId)]);
      if (!manifestRead.value && remoteIds.includes(workspaceId)) throw v2Failure('manifest-read', 'catalog-manifest-unavailable', 'read-manifest');
      if (!manifestRead.value && localIds.includes(workspaceId) && scanned.length === 0) throw v2Failure('local-scan', 'local-workspace-unavailable', 'scan-workspace');
      if (manifestRead.value && !validManifest(manifestRead.value, workspaceId)) throw v2Failure('manifest-validation', 'invalid-manifest', 'read-manifest');
      const manifest = manifestRead.value;
      const remoteByKey = new Map((manifest?.records ?? []).map(record => [keyOf(record), record]));
      const localPairs = await Promise.all(scanned.map(localRecord));
      const localByKey = new Map(localPairs.map(pair => [keyOf(pair.entity), pair]));
      const baselineRecords = await input.baselines.loadWorkspace(workspaceId);
      const baselineByKey = new Map(baselineRecords.map(record => [`${record.entityKind}:${record.entityId}`, record]));
      const initialAdoption = localProfile === null && baselineRecords.length === 0;
      const keys = [...new Set([...localByKey.keys(), ...remoteByKey.keys()])].sort();
      const downloads: Array<{ record: SyncV2Record; bytes: Uint8Array }> = [];
      const uploads: Array<{ record: SyncV2Record; bytes: Uint8Array | null }> = [];
      const nextRecords = new Map(remoteByKey);
      const nextBaselines = new Map<string, SyncV2BaselineRecord>();

      for (const key of keys) {
        const local = localByKey.get(key);
        const remote = remoteByKey.get(key);
        const base = baselineByKey.get(key);
        if (local && !local.entity.tombstone && !local.hash) throw v2Failure('local-scan', 'local-payload-unavailable', 'hash-local', local.entity.entityType);

        if (local && !remote) {
          if (local.entity.tombstone) continue;
          uploads.push({ record: { kind: local.entity.entityType, id: local.entity.entityId, parentId: local.entity.parentId, hash: local.hash, baseHash: base?.baseHash ?? null, tombstone: false, ...(local.entity.entityType === 'asset' ? { encoding: 'asset-envelope-v1' as const } : {}) }, bytes: local.entity.bytes });
          continue;
        }
        if (!local && remote) {
          if (remote.tombstone) { nextBaselines.set(key, baselineFor(remote, null, manifest!.revision)); continue; }
          const bytes = await input.provider.getObject(remote.hash!);
          if (await sha256Bytes(bytes) !== remote.hash) throw v2Failure('object-download', 'object-integrity-failed', 'download', remote.kind);
          downloads.push({ record: remote, bytes });
          continue;
        }
        if (!local || !remote) continue;
        const localMatchesRemote = local.entity.tombstone === remote.tombstone && (remote.tombstone || local.hash === remote.hash);
        if (localMatchesRemote) { nextBaselines.set(key, baselineFor(remote, local.hash, manifest!.revision)); continue; }

        if (!base && local.bootstrapIdentityHash && !remote.tombstone) {
          const bytes = await input.provider.getObject(remote.hash!);
          if (await sha256Bytes(bytes) !== remote.hash) throw v2Failure('object-download', 'object-integrity-failed', 'download', remote.kind);
          downloads.push({ record: remote, bytes });
          continue;
        }

        if (initialAdoption && !base && !local.entity.tombstone && !remote.tombstone) {
          const bytes = await input.provider.getObject(remote.hash!);
          if (await sha256Bytes(bytes) !== remote.hash) throw v2Failure('object-download', 'object-integrity-failed', 'download', remote.kind);
          await input.conflictStore.preserve({
            conflictId: `${profile.profileId}:${workspaceId}:${key}:${local.hash}:${remote.hash}`,
            profileId: profile.profileId,
            workspaceId,
            entityKind: local.entity.entityType,
            entityId: local.entity.entityId,
            parentId: local.entity.parentId,
            localHash: local.hash!,
            remoteHash: remote.hash!,
            localBytes: local.entity.bytes!,
            createdAt: Date.now(),
            resolvedAt: null,
          });
          result.preservedConflicts += 1;
          downloads.push({ record: remote, bytes });
          continue;
        }

        const localMatchesBase = Boolean(base) && local.entity.tombstone === base!.tombstone && (local.entity.tombstone || local.hash === base!.baseHash);
        const remoteMatchesBase = Boolean(base) && remote.tombstone === base!.tombstone && (remote.tombstone || remote.hash === base!.baseHash);
        if (base && localMatchesBase && !remoteMatchesBase) {
          if (remote.tombstone) {
            if (remote.baseHash !== base.baseHash) result.conflicts.push({ workspaceId, kind: remote.kind, id: remote.id });
            else downloads.push({ record: remote, bytes: new Uint8Array() });
          } else {
            const bytes = await input.provider.getObject(remote.hash!);
            if (await sha256Bytes(bytes) !== remote.hash) throw v2Failure('object-download', 'object-integrity-failed', 'download', remote.kind);
            downloads.push({ record: remote, bytes });
          }
        } else if (base && !localMatchesBase && remoteMatchesBase) {
          const tombstoneValid = !local.entity.tombstone || base.baseHash !== null;
          if (!tombstoneValid) result.conflicts.push({ workspaceId, kind: local.entity.entityType, id: local.entity.entityId });
          else uploads.push({ record: { kind: local.entity.entityType, id: local.entity.entityId, parentId: local.entity.parentId, hash: local.hash, baseHash: base.baseHash, tombstone: local.entity.tombstone, ...(local.entity.entityType === 'asset' && !local.entity.tombstone ? { encoding: 'asset-envelope-v1' as const } : {}) }, bytes: local.entity.bytes });
        } else result.conflicts.push({ workspaceId, kind: local.entity.entityType, id: local.entity.entityId });
      }

      if (result.conflicts.some(conflict => conflict.workspaceId === workspaceId)) continue;
      input.onProgress?.(uploads.length ? 'Uploading changes…' : downloads.length ? 'Downloading changes…' : `Syncing workspace ${workspaceIndex + 1} of ${workspaceIds.length}…`);
      for (const upload of uploads) {
        if (!upload.record.tombstone) {
          const put = await input.provider.putObjectIfAbsent(upload.record.hash!, upload.bytes!);
          if (put === 'uploaded') result.uploaded += 1;
          const metadata = await input.provider.getObjectMetadata(upload.record.hash!);
          if (!metadata || metadata.size !== upload.bytes!.byteLength) throw v2Failure('object-upload', 'uploaded-object-unavailable', 'verify-upload', upload.record.kind);
        }
        nextRecords.set(keyOf(upload.record), upload.record);
      }

      const manifestChanged = uploads.length > 0 || (!manifest && scanned.some(entity => !entity.tombstone));
      let committedManifest = manifest;
      if (manifestChanged) {
        const revision = (manifest?.revision ?? 0) + 1;
        committedManifest = { format: 'panvas-sync-v2-manifest', schemaVersion: 2, workspaceId, revision, records: [...nextRecords.values()] };
      }

      if (committedManifest) {
        await mapBounded(committedManifest.records.filter(record => !record.tombstone), async record => {
          if (!(await input.provider.getObjectMetadata(record.hash!))) throw v2Failure('manifest-validation', 'manifest-object-unavailable', 'verify-object', record.kind);
        });
      }

      if (manifestChanged && committedManifest) {
        await input.provider.writeManifest(workspaceId, committedManifest, manifestRead.etag);
        nextCatalog.set(workspaceId, { workspaceId, manifestRevision: committedManifest.revision });
        catalogChanged = true;
      }

      if (committedManifest) {
        const catalogEntry = nextCatalog.get(workspaceId);
        if (!catalogEntry || catalogEntry.manifestRevision !== committedManifest.revision) {
          nextCatalog.set(workspaceId, { workspaceId, manifestRevision: committedManifest.revision });
          catalogChanged = true;
        }
      }

      for (const download of downloads.sort((a, b) => phase[a.record.kind] - phase[b.record.kind])) {
        await input.adapter.applyRecord({ workspaceId, record: download.record, bytes: download.record.tombstone ? null : download.bytes });
        result.downloaded += 1;
      }
      if (committedManifest) {
        for (const record of committedManifest.records) {
          const local = localByKey.get(keyOf(record));
          const uploaded = uploads.find(item => keyOf(item.record) === keyOf(record));
          const downloaded = downloads.find(item => keyOf(item.record) === keyOf(record));
          nextBaselines.set(keyOf(record), baselineFor(record, uploaded?.record.hash ?? (downloaded ? record.hash : record.tombstone ? null : local?.hash ?? record.hash), committedManifest.revision));
        }
        stagedBaselines.set(workspaceId, [...nextBaselines.values()]);
      }
    }

    if (result.conflicts.length) return { ...result, status: 'conflict' };
    if (catalogChanged) await input.provider.writeCatalog({ ...catalog, revision: catalog.revision + 1, workspaces: [...nextCatalog.values()].sort((a, b) => a.workspaceId.localeCompare(b.workspaceId)) }, catalogRead.etag);
    await input.baselines.saveProfile({ profileId: profile.profileId, accountIdentifier: input.accountIdentifier });
    for (const [workspaceId, records] of stagedBaselines) await input.baselines.saveWorkspace(workspaceId, records);
    const reviewRequired = await input.conflictStore.hasUnresolved(profile.profileId);
    input.onProgress?.(reviewRequired ? 'Synced - changes need review' : 'Up to date');
    return { ...result, status: reviewRequired ? 'synced-review' : 'synced' };
  } catch (error) {
    const shown = presentCloudError(error, 'sync-v2');
    return { ...result, status: 'error', error: shown.message, errorCode: shown.code, diagnostic: shown.diagnostic };
  } finally {
    input.source.endCycle?.();
  }
}
