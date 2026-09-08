/**
 * Remote manifest assembly (SYNC-0 format). Stable IDs are identity; remote
 * names are presentation only. The manifest hash is computed over canonical
 * JSON and used for integrity, never for conflict ordering (ordering uses the
 * provider etag/ifMatch).
 */
import { canonicalizeJson, sha256Hex } from './hash.ts';
import type { RecordPointer, SyncJournalEntry, SyncManifestV1 } from './types.ts';

export const SYNC_FORMAT = 'panvas-sync' as const;
export const SYNC_SCHEMA_VERSION = 1 as const;

export function buildManifestV1(input: {
  workspaceId: string;
  revision: number;
  previousRevision: number | null;
  writerDeviceId: string;
  generatedAt: string;
  records: readonly RecordPointer[];
}): SyncManifestV1 {
  return {
    format: SYNC_FORMAT,
    schemaVersion: SYNC_SCHEMA_VERSION,
    workspaceId: input.workspaceId,
    revision: input.revision,
    previousRevision: input.previousRevision,
    writerDeviceId: input.writerDeviceId,
    generatedAt: input.generatedAt,
    records: [...input.records],
  };
}

export function isKnownSyncEntityKind(kind: string): kind is SyncManifestV1['records'][number]['kind'] {
  return [
    'workspace', 'folder', 'notebook', 'notebookSection', 'notebookPage',
    'pageContent', 'pageDrawing', 'canvasFile', 'canvasScene', 'customBlock', 'asset',
  ].includes(kind);
}

export function manifestHash(manifest: SyncManifestV1): Promise<string> {
  return sha256Hex(canonicalizeJson(manifest));
}

/** Structural validation for untrusted remote manifests (schema, ids, hashes). */
export function validateRemoteManifest(value: unknown): SyncManifestV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SyncManifestV1>;
  if (candidate.format !== SYNC_FORMAT || candidate.schemaVersion !== SYNC_SCHEMA_VERSION) return null;
  if (typeof candidate.workspaceId !== 'string' || !candidate.workspaceId) return null;
  if (typeof candidate.revision !== 'number' || !Number.isFinite(candidate.revision)) return null;
  if (!Array.isArray(candidate.records)) return null;
  for (const pointer of candidate.records as RecordPointer[]) {
    if (!pointer || typeof pointer.id !== 'string' || !pointer.id) return null;
    if (!isKnownSyncEntityKind(String(pointer.kind))) return null;
    if (typeof pointer.revision !== 'number' || !Number.isFinite(pointer.revision)) return null;
    if (typeof pointer.contentHash !== 'string' || !/^[a-f0-9]{64}$|^tombstone$/.test(pointer.contentHash)) return null;
    if (pointer.encoding !== undefined && pointer.encoding !== 'asset-envelope-v1') return null;
  }
  return candidate as SyncManifestV1;
}

/** Merges locally-published pointers over the remote set (same id+kind). */
export function mergeRecords(remote: readonly RecordPointer[], published: readonly RecordPointer[]): RecordPointer[] {
  const publishedKeys = new Set(published.map(pointer => `${pointer.kind}:${pointer.id}`));
  return [...remote.filter(pointer => !publishedKeys.has(`${pointer.kind}:${pointer.id}`)), ...published];
}

export function pointerFromEntry(entry: SyncJournalEntry, parentId: string | null): RecordPointer {
  return {
    kind: entry.entityType,
    id: entry.entityId,
    parentId,
    revision: entry.localRevision,
    baseRevision: entry.baseRevision,
    contentHash: entry.contentHash ?? 'tombstone',
    tombstone: entry.tombstone,
    ...(entry.entityType === 'asset' && !entry.tombstone ? { encoding: 'asset-envelope-v1' as const } : {}),
  };
}
