/**
 * Pure journal logic: entry creation/coalescing, monotonic revisions,
 * bounded backoff, state transitions, and manifest acknowledgment. No I/O.
 */
import type { JournalOperation, JournalState, RecordPointer, SyncJournalEntry, SyncEntityKind } from './types.ts';

export const MAX_JOURNAL_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 10 * 60_000;

export interface JournalInput {
  entityType: SyncEntityKind;
  entityId: string;
  workspaceId: string;
  operation: JournalOperation;
  /** Latest known local revision for the entity (0 when none exists). */
  currentLocalRevision: number;
  contentHash: string | null;
  baseRevision: number | null;
  deletedAt?: number | null;
  payloadRef?: string | null;
  now: number;
  entryId: string;
}

export function createJournalEntry(input: JournalInput): SyncJournalEntry {
  const tombstone = input.operation === 'delete';
  return {
    entryId: input.entryId,
    entityType: input.entityType,
    entityId: input.entityId,
    workspaceId: input.workspaceId,
    operation: input.operation,
    localRevision: input.currentLocalRevision + 1,
    contentHash: input.contentHash,
    baseRevision: input.baseRevision,
    updatedAt: input.now,
    deletedAt: tombstone ? input.deletedAt ?? input.now : null,
    tombstone,
    state: 'pending',
    attempts: 0,
    nextAttemptAt: null,
    lastErrorClass: null,
    payloadRef: input.payloadRef ?? null,
  };
}

/**
 * Coalescing: a new pending entry supersedes an older PENDING entry for the
 * same entity. create followed by update stays 'create' (remote never saw the
 * entity); update followed by delete collapses to 'delete'; delete followed
 * by restore becomes 'restore' against the last synced revision. Synced
 * entries are history and are never coalesced away.
 */
export function coalesceWithPending(
  incoming: SyncJournalEntry,
  pending: SyncJournalEntry | undefined,
): SyncJournalEntry {
  if (!pending || pending.state !== 'pending') return incoming;
  if (incoming.operation === 'delete') {
    return { ...incoming, localRevision: Math.max(incoming.localRevision, pending.localRevision) };
  }
  if (incoming.operation === 'restore' && pending.operation === 'delete') {
    return { ...incoming, operation: 'restore' };
  }
  const operation = pending.operation === 'create' ? 'create' : incoming.operation;
  return { ...incoming, operation, baseRevision: pending.baseRevision };
}

/** Bounded exponential backoff with jitter; null when retries are exhausted. */
export function nextAttemptDelayMs(attempts: number, jitter: (fraction: number) => number = Math.random): number | null {
  if (attempts >= MAX_JOURNAL_ATTEMPTS) return null;
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempts);
  return Math.round(exponential * (0.85 + 0.3 * jitter(1)));
}

export function markAttempt(entry: SyncJournalEntry, errorClass: string, now: number, jitter?: (fraction: number) => number): SyncJournalEntry {
  const attempts = entry.attempts + 1;
  const delay = nextAttemptDelayMs(attempts, jitter);
  return {
    ...entry,
    attempts,
    state: delay === null ? 'error' : 'pending',
    nextAttemptAt: delay === null ? null : now + delay,
    lastErrorClass: errorClass,
  };
}

/** Manifest read-back acknowledgment: only exact hash+revision matches ack. */
export function isAcknowledgedByManifest(entry: SyncJournalEntry, pointers: readonly RecordPointer[]): boolean {
  const pointer = pointers.find(candidate => candidate.id === entry.entityId && candidate.kind === entry.entityType);
  if (!pointer) return false;
  if (entry.tombstone) return pointer.tombstone && pointer.revision >= entry.localRevision;
  return !pointer.tombstone && pointer.contentHash === entry.contentHash && pointer.revision >= entry.localRevision;
}

export function transitionState(entry: SyncJournalEntry, state: JournalState, now: number): SyncJournalEntry {
  return { ...entry, state, updatedAt: now, nextAttemptAt: state === 'pending' ? entry.nextAttemptAt : null };
}

/** A crashed cycle can leave `syncing`, while older retry caps leave `error`
 * forever excluded from listPending. Re-arm transport metadata only; all
 * identity/content/conflict fields remain byte-for-byte represented. */
export function recoverRetryMetadata(entry: SyncJournalEntry): SyncJournalEntry {
  if (entry.state !== 'syncing' && entry.state !== 'error') return entry;
  return {
    ...entry,
    state: 'pending',
    attempts: 0,
    nextAttemptAt: null,
    // The engine needs this deterministic evidence to distinguish an orphaned
    // upload from a transient provider failure after a canonical rescan.
    lastErrorClass: entry.lastErrorClass === 'payload-missing' ? 'payload-missing' : null,
  };
}

export function journalToRecordPointer(entry: SyncJournalEntry, parentId: string | null): RecordPointer {
  return {
    kind: entry.entityType,
    id: entry.entityId,
    parentId,
    revision: entry.localRevision,
    baseRevision: entry.baseRevision,
    contentHash: entry.contentHash ?? 'tombstone',
    tombstone: entry.tombstone,
  };
}
