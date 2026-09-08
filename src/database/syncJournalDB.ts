/**
 * Dexie-backed sync journal store. Works identically in Electron and browser
 * (Dexie is already the shared domain database for blocks/assets/legacy
 * data), so ONE sync domain engine serves both platforms. Main-process
 * journal ownership migrates to the atomic write queue when the first real
 * provider adapter moves credentials into OS-protected storage (Phase 2+).
 */
import { db } from './schema';
import { generateId } from '../lib/utils/id';
import type { SyncJournalEntry, SyncEntityKind, JournalOperation } from '@/services/cloudsync/types';
import { coalesceWithPending, createJournalEntry, recoverRetryMetadata, type JournalInput } from '@/services/cloudsync/journal';
import type { SyncJournalStore } from '@/services/cloudsync/engine';

export async function latestEntryForEntity(workspaceId: string, entityType: SyncEntityKind, entityId: string): Promise<SyncJournalEntry | undefined> {
  const entries = await db.syncJournal.where('entityId').equals(entityId)
    .filter(entry => entry.workspaceId === workspaceId && entry.entityType === entityType && entry.state !== 'superseded')
    .toArray();
  return entries.sort((left, right) => right.localRevision - left.localRevision)[0];
}

export async function appendJournalEntry(input: Omit<JournalInput, 'entryId' | 'currentLocalRevision'> & { entryId?: string }): Promise<SyncJournalEntry> {
  const latest = await latestEntryForEntity(input.workspaceId, input.entityType, input.entityId);
  const entry = createJournalEntry({
    ...input,
    entryId: input.entryId ?? generateId('sj'),
    currentLocalRevision: latest?.localRevision ?? 0,
    baseRevision: input.baseRevision ?? (latest && latest.state === 'synced' ? latest.localRevision : null),
  });
  const pendingEntries = await db.syncJournal
    .where('entityId').equals(input.entityId)
    .filter(candidate => candidate.workspaceId === input.workspaceId && candidate.entityType === input.entityType && (candidate.state === 'pending' || candidate.state === 'syncing'))
    .toArray();
  const oldestPending = pendingEntries.sort((left, right) => left.localRevision - right.localRevision)[0];
  const coalesced = { ...coalesceWithPending(entry, oldestPending), entryId: oldestPending?.entryId ?? entry.entryId };
  await db.transaction('rw', db.syncJournal, async () => {
    if (pendingEntries.length > 1) await db.syncJournal.bulkDelete(pendingEntries.slice(1).map(item => item.entryId));
    await db.syncJournal.put(coalesced);
  });
  return coalesced;
}

/** Dexie adapter for the engine's abstract store. */
export const dexieSyncJournalStore: SyncJournalStore = {
  async listPending(workspaceId: string, now: number): Promise<SyncJournalEntry[]> {
    const entries = await db.syncJournal
      .where('workspaceId').equals(workspaceId)
      .filter(candidate => (candidate.state === 'pending' || candidate.state === 'syncing') && (candidate.nextAttemptAt === null || candidate.nextAttemptAt <= now))
      .toArray();
    return entries.sort((left, right) => left.updatedAt - right.updatedAt);
  },

  async upsert(entry: SyncJournalEntry): Promise<void> {
    await db.syncJournal.put(entry);
  },

  async latestByEntity(workspaceId: string): Promise<Map<string, SyncJournalEntry>> {
    const entries = await db.syncJournal.where('workspaceId').equals(workspaceId)
      .filter(entry => entry.state !== 'superseded')
      .toArray();
    const latest = new Map<string, SyncJournalEntry>();
    for (const entry of entries) {
      const key = `${entry.entityType}:${entry.entityId}`;
      const existing = latest.get(key);
      if (!existing || entry.localRevision > existing.localRevision) latest.set(key, entry);
    }
    return latest;
  },

  async listUnresolved(workspaceId: string): Promise<SyncJournalEntry[]> {
    return db.syncJournal.where('workspaceId').equals(workspaceId)
      .filter(entry => entry.state === 'pending' || entry.state === 'syncing' || entry.state === 'conflict' || entry.state === 'error')
      .toArray();
  },
};

/** Recover retry metadata left by interrupted/older browser builds. Content,
 * IDs, revisions, tombstones, and conflicts are deliberately preserved. */
export async function recoverStaleJournalMetadata(workspaceId: string): Promise<number> {
  const entries = await db.syncJournal.where('workspaceId').equals(workspaceId).toArray();
  const recoverable = entries.filter(entry => entry.state === 'syncing' || entry.state === 'error');
  if (!recoverable.length) return 0;
  await db.transaction('rw', db.syncJournal, async () => {
    for (const entry of recoverable) {
      await db.syncJournal.put(recoverRetryMetadata(entry));
    }
  });
  return recoverable.length;
}

/** Commit account-migration baselines for one explicitly selected workspace.
 * Previous account metadata is retained as superseded history and can be
 * restored if the subsequent binding write fails. User content is untouched. */
export async function commitMigratedWorkspaceJournal(
  workspaceId: string,
  entries: readonly SyncJournalEntry[],
  now = Date.now(),
): Promise<SyncJournalEntry[]> {
  const previous = await db.syncJournal.where('workspaceId').equals(workspaceId).toArray();
  await db.transaction('rw', db.syncJournal, async () => {
    for (const entry of previous) {
      await db.syncJournal.put({ ...entry, state: 'superseded', updatedAt: now, nextAttemptAt: null });
    }
    if (entries.length > 0) await db.syncJournal.bulkPut(entries.map(entry => ({ ...entry, workspaceId })));
  });
  return previous;
}

export async function restoreWorkspaceJournalSnapshot(workspaceId: string, entries: readonly SyncJournalEntry[]): Promise<void> {
  await db.transaction('rw', db.syncJournal, async () => {
    await db.syncJournal.where('workspaceId').equals(workspaceId).delete();
    if (entries.length > 0) await db.syncJournal.bulkPut(entries.map(entry => ({ ...entry, workspaceId })));
  });
}

export async function countPendingJournalEntries(workspaceId?: string): Promise<number> {
  const collection = workspaceId
    ? db.syncJournal.where('workspaceId').equals(workspaceId)
    : db.syncJournal.toCollection();
  const entries = await collection.filter(entry => entry.state === 'pending' || entry.state === 'error' || entry.state === 'conflict').toArray();
  return entries.length;
}

export type { SyncEntityKind, JournalOperation };
