import { applyRemoteChanges, type RemoteRecordLocalAdapter } from './applyRemoteChanges.ts';
import { firstMissingManifestObject, runSyncCycle, type SyncEntryError, type SyncJournalStore, type SyncPayloadSource } from './engine.ts';
import { sha256Bytes } from './hash.ts';
import { validateRemoteManifest } from './manifest.ts';
import type { CloudSyncProvider, RecordPointer, SyncJournalEntry } from './types.ts';

const entityKey = (entry: Pick<SyncJournalEntry, 'entityType' | 'entityId'>) => `${entry.entityType}:${entry.entityId}`;

/** Account migration deliberately starts without ancestry from the old cloud
 * account. Writes stay isolated until the new account has acknowledged the
 * complete workspace, so a failed attempt cannot corrupt the old binding's
 * retry/baseline metadata. */
export class AccountMigrationJournal implements SyncJournalStore {
  private readonly rows = new Map<string, SyncJournalEntry>();

  constructor(initial: readonly SyncJournalEntry[] = []) {
    for (const entry of initial) this.rows.set(entry.entryId, entry);
  }

  async listPending(workspaceId: string, now: number): Promise<SyncJournalEntry[]> {
    return [...this.rows.values()].filter(entry => entry.workspaceId === workspaceId
      && (entry.state === 'pending' || entry.state === 'syncing')
      && (entry.nextAttemptAt === null || entry.nextAttemptAt <= now));
  }

  async upsert(entry: SyncJournalEntry): Promise<void> { this.rows.set(entry.entryId, entry); }

  async latestByEntity(workspaceId: string): Promise<Map<string, SyncJournalEntry>> {
    const latest = new Map<string, SyncJournalEntry>();
    for (const entry of this.rows.values()) {
      if (entry.workspaceId !== workspaceId || entry.state === 'superseded') continue;
      const key = entityKey(entry);
      const current = latest.get(key);
      if (!current || entry.localRevision > current.localRevision) latest.set(key, entry);
    }
    return latest;
  }

  async listUnresolved(workspaceId: string): Promise<SyncJournalEntry[]> {
    return [...this.rows.values()].filter(entry => entry.workspaceId === workspaceId
      && (entry.state === 'pending' || entry.state === 'syncing' || entry.state === 'conflict' || entry.state === 'error'));
  }

  entries(): SyncJournalEntry[] { return [...this.rows.values()].map(entry => ({ ...entry })); }
}

function remoteBaseline(workspaceId: string, pointer: RecordPointer, now: number): SyncJournalEntry {
  return {
    entryId: `migration-remote:${workspaceId}:${pointer.kind}:${pointer.id}:${pointer.revision}`,
    entityType: pointer.kind, entityId: pointer.id, workspaceId,
    operation: pointer.tombstone ? 'delete' : 'create', localRevision: pointer.revision,
    contentHash: pointer.tombstone ? null : pointer.contentHash, baseRevision: pointer.baseRevision,
    updatedAt: now, deletedAt: pointer.tombstone ? now : null, tombstone: pointer.tombstone,
    state: 'synced', attempts: 0, nextAttemptAt: null, lastErrorClass: null,
    payloadRef: pointer.tombstone ? null : pointer.id,
  };
}

export interface AccountWorkspaceMigrationResult {
  status: 'synced' | 'conflict' | 'error';
  remoteRevision: number;
  journalEntries: SyncJournalEntry[];
  firstError?: SyncEntryError;
}

/** Runs the existing safe sync/reconciliation rules against the newly selected
 * account without importing any ancestry from the old account. The caller may
 * commit `journalEntries` and move the binding only when status is `synced`. */
export async function migrateWorkspaceToGoogleAccount(input: {
  workspaceId: string;
  deviceId: string;
  provider: CloudSyncProvider;
  payloadSource: SyncPayloadSource;
  localAdapter?: RemoteRecordLocalAdapter;
  now: number;
  onProgress?: Parameters<typeof runSyncCycle>[0]['onProgress'];
}): Promise<AccountWorkspaceMigrationResult> {
  // A prior explicit attempt can publish successfully and then crash before
  // the local binding commit. Its manifest writer is durable transaction
  // evidence: resume from that remote head, while a different writer keeps the
  // normal unknown-ancestry conflict protection.
  const priorRead = await input.provider.readManifest(input.workspaceId);
  const priorManifest = priorRead.manifest ? validateRemoteManifest(priorRead.manifest) : null;
  const resume = priorManifest?.workspaceId === input.workspaceId
    && priorManifest.writerDeviceId === input.deviceId
    ? priorManifest.records.map(pointer => remoteBaseline(input.workspaceId, pointer, input.now))
    : [];
  const journal = new AccountMigrationJournal(resume);
  const deviceState = { lastSeenRevision: 0 };
  const cycle = await runSyncCycle({
    workspaceId: input.workspaceId,
    deviceId: input.deviceId,
    journalStore: journal,
    provider: input.provider,
    payloadSource: input.payloadSource,
    deviceState,
    now: input.now,
    objectConcurrency: 4,
    verifyObjectsBeforeManifest: true,
    onProgress: input.onProgress,
  });

  if (cycle.conflicts.length > 0) {
    return { status: 'conflict', remoteRevision: deviceState.lastSeenRevision, journalEntries: journal.entries() };
  }
  const intrinsicError = cycle.errors.find(error => error.stage !== 'retry-backoff');
  if (intrinsicError) {
    return { status: 'error', remoteRevision: deviceState.lastSeenRevision, journalEntries: journal.entries(), firstError: intrinsicError };
  }

  let applyError: SyncEntryError | undefined;
  if (cycle.recordsForDownload.length > 0) {
    const applied = await applyRemoteChanges({
      workspaceId: input.workspaceId,
      records: cycle.recordsForDownload,
      provider: input.provider,
      journalStore: journal,
      localAdapter: input.localAdapter,
      now: input.now,
    });
    applyError = applied.firstError;
    if (applied.errors > 0) {
      return { status: 'error', remoteRevision: deviceState.lastSeenRevision, journalEntries: journal.entries(), firstError: applyError };
    }
  }

  const unresolved = await journal.listUnresolved(input.workspaceId);
  if (unresolved.some(entry => entry.state === 'conflict')) {
    return { status: 'conflict', remoteRevision: deviceState.lastSeenRevision, journalEntries: journal.entries() };
  }
  if (unresolved.length > 0 || !cycle.upToDate) {
    return {
      status: 'error', remoteRevision: deviceState.lastSeenRevision, journalEntries: journal.entries(),
      firstError: applyError ?? cycle.errors[0],
    };
  }

  const verifiedRead = await input.provider.readManifest(input.workspaceId);
  const verifiedManifest = verifiedRead.manifest ? validateRemoteManifest(verifiedRead.manifest) : null;
  if (!verifiedManifest || verifiedManifest.workspaceId !== input.workspaceId) {
    return {
      status: 'error', remoteRevision: deviceState.lastSeenRevision, journalEntries: journal.entries(),
      firstError: { entityId: input.workspaceId, entityType: 'workspace', stage: 'migration-verification', errorClass: 'provider-error', providerReason: 'manifest-unavailable', retryable: true },
    };
  }
  const canonical = input.payloadSource.scanWorkspace ? await input.payloadSource.scanWorkspace(input.workspaceId) : [];
  for (const entity of canonical) {
    const pointer = verifiedManifest.records.find(candidate => candidate.kind === entity.entityType && candidate.id === entity.entityId);
    const hash = entity.tombstone ? null : entity.bytes ? await sha256Bytes(entity.bytes) : null;
    if (!pointer || pointer.tombstone !== entity.tombstone || pointer.parentId !== entity.parentId
      || (!entity.tombstone && (!hash || pointer.contentHash !== hash))) {
      return {
        status: 'error', remoteRevision: verifiedManifest.revision, journalEntries: journal.entries(),
        firstError: { entityId: entity.entityId, entityType: entity.entityType, stage: 'migration-verification', errorClass: hash || entity.tombstone ? 'provider-error' : 'payload-missing', providerReason: 'canonical-record-unverified', retryable: false },
      };
    }
  }
  const missingObject = await firstMissingManifestObject(input.provider, input.workspaceId, verifiedManifest.records);
  if (missingObject) {
    return {
      status: 'error', remoteRevision: verifiedManifest.revision, journalEntries: journal.entries(),
      firstError: { entityId: missingObject.id, entityType: missingObject.kind, stage: 'migration-verification', errorClass: 'provider-error', providerReason: 'remote-object-missing', retryable: true },
    };
  }

  return { status: 'synced', remoteRevision: verifiedManifest.revision, journalEntries: journal.entries() };
}
