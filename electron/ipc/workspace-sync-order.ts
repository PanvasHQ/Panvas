import type { SyncEntityKind } from '../../src/services/cloudsync/types.js';

const PHASE: Record<SyncEntityKind, number> = {
  workspace: 0, folder: 1, notebook: 2, notebookSection: 3,
  notebookPage: 4, canvasFile: 4, pageContent: 5, pageDrawing: 5,
  canvasScene: 5, customBlock: 6, asset: 7,
};

export interface NativeRemoteRecord {
  kind: SyncEntityKind;
  id: string;
  parentId?: string | null;
  payload: unknown;
  tombstone: boolean;
}

export class NativeRemoteRecordApplyError extends Error {
  readonly sourceError: unknown;
  readonly record: NativeRemoteRecord;

  constructor(sourceError: unknown, record: NativeRemoteRecord) {
    super(sourceError instanceof Error ? sourceError.message : 'Native remote record application failed.');
    this.name = 'NativeRemoteRecordApplyError';
    this.sourceError = sourceError;
    this.record = record;
  }
}

/** Native preflight for a workspace transaction. It accepts child-only deltas
 * only when the canonical local root has already been discovered. Otherwise a
 * valid root must be present and is moved ahead of every dependent record. */
export function prepareRemoteWorkspaceRecords(
  workspaceId: string,
  records: readonly NativeRemoteRecord[],
  hasCanonicalLocalRoot: boolean,
): NativeRemoteRecord[] {
  const ordered = [...records].sort((left, right) => PHASE[left.kind] - PHASE[right.kind]);
  if (ordered.some(record => record.kind === 'workspace' && record.tombstone)
    && ordered.some(record => record.kind !== 'workspace' && !record.tombstone)) {
    throw new Error('Remote workspace root is deleted but the batch contains live children.');
  }
  if (hasCanonicalLocalRoot || !ordered.some(record => !record.tombstone)) return ordered;

  const root = ordered.find(record => record.kind === 'workspace' && record.id === workspaceId && !record.tombstone);
  if (!root) throw new Error('Remote workspace root record is missing for local reconstruction.');
  if (!root.payload || typeof root.payload !== 'object' || Array.isArray(root.payload)) {
    throw new Error('Remote workspace root payload is invalid.');
  }
  if ((root.payload as { id?: unknown }).id !== workspaceId) {
    throw new Error('Remote workspace root identity does not match the manifest workspace.');
  }
  if ((root.payload as { deletedAt?: unknown }).deletedAt) throw new Error('Remote workspace root payload is deleted.');
  return ordered;
}
