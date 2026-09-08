/**
 * Deterministic V1 conflict policy (SYNC-0). Never silently destroys user
 * content: payload records are opaque (no JSON merging), concurrent edit/edit
 * and delete/edit produce durable conflict sidecars, and a tombstone wins
 * only when the deletion is based on the current remote head.
 */

export interface RemoteHead {
  revision: number;
  baseRevision: number | null;
  contentHash: string;
  tombstone: boolean;
}

export interface LocalChange {
  /** The base revision the local edit was made against (null = create). */
  baseRevision: number | null;
  contentHash: string | null;
  tombstone: boolean;
}

export type ConflictDecision =
  | { kind: 'coalesce' }
  | { kind: 'replace-base' }
  | { kind: 'publish-local' }
  | { kind: 'conflict'; reason: 'concurrent-edit-edit' | 'delete-vs-edit' | 'edit-vs-delete' }
  | { kind: 'tombstone-wins' };

export function decideConflict(local: LocalChange, remote: RemoteHead | null): ConflictDecision {
  if (!remote) return { kind: 'publish-local' };
  if (local.contentHash !== null && local.contentHash === remote.contentHash && local.tombstone === remote.tombstone) {
    return { kind: 'coalesce' };
  }
  // Once a remote head exists, a null base is not proof that the local value
  // descends from it. Treating "unknown base" as current let a stale replica
  // replace a richer device merely because it synchronized later.
  const basedOnHead = local.baseRevision !== null && local.baseRevision === remote.revision;
  if (remote.tombstone && !local.tombstone) {
    // Delete vs offline edit is ALWAYS a visible conflict — neither side wins.
    return { kind: 'conflict', reason: 'delete-vs-edit' };
  }
  if (local.tombstone && !remote.tombstone) {
    // Our deletion is only authoritative when it was based on the current
    // head and no concurrent edit exists; otherwise the edit survives.
    return basedOnHead ? { kind: 'tombstone-wins' } : { kind: 'conflict', reason: 'edit-vs-delete' };
  }
  if (!basedOnHead) {
    return { kind: 'conflict', reason: 'concurrent-edit-edit' };
  }
  return { kind: 'replace-base' };
}

/** Device-scoped conflict copy naming: "Physics Notes (Conflict — Laptop)". */
export function conflictCopyName(originalName: string, deviceLabel: string): string {
  const suffix = ` (Conflict — ${deviceLabel})`;
  const budget = 120 - suffix.length;
  const base = originalName.length > budget ? originalName.slice(0, Math.max(0, budget)).trimEnd() : originalName;
  return `${base}${suffix}`;
}

/**
 * Metadata records (pins, expanded flags, order) tolerate independent field
 * merges: fields only one side touched are combined, fields both sides
 * touched keep LOCAL and are surfaced as a metadata conflict entry for the
 * user. Payload records never pass through here (opaque).
 */
export function mergeIndependentMetadata<T extends Record<string, unknown>>(
  local: T,
  remote: T,
  localBase: T | null,
): { merged: T; conflictingKeys: string[] } {
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const merged: Record<string, unknown> = { ...remote };
  const conflictingKeys: string[] = [];
  for (const key of keys) {
    const localValue = local[key];
    const remoteValue = remote[key];
    if (remoteValue === localValue) continue;
    const localTouched = !localBase || localBase[key] !== localValue;
    const remoteTouched = !localBase || localBase[key] !== remoteValue;
    if (localTouched && remoteTouched) conflictingKeys.push(key);
    else if (localTouched) merged[key] = localValue;
  }
  return { merged: merged as T, conflictingKeys };
}
