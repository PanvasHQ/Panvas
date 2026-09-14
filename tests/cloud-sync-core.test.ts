import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonicalizeJson, hashCanonical, sha256Hex } from '../src/services/cloudsync/hash.ts';
import { coalesceWithPending, createJournalEntry, isAcknowledgedByManifest, journalToRecordPointer, markAttempt, nextAttemptDelayMs, MAX_JOURNAL_ATTEMPTS } from '../src/services/cloudsync/journal.ts';
import { conflictCopyName, decideConflict, mergeIndependentMetadata } from '../src/services/cloudsync/conflict.ts';
import { purgeEligibleRoots, trashCountdown, TRASH_RETENTION_DAYS, retentionDecision } from '../src/services/cloudsync/trash.ts';
import { buildManifestV1, manifestHash, validateRemoteManifest, mergeRecords } from '../src/services/cloudsync/manifest.ts';
import { ProviderConflictError, runSyncCycle, type SyncJournalStore } from '../src/services/cloudsync/engine.ts';
import type { CloudSyncProvider, RemoteManifestRead, SyncJournalEntry, SyncManifestV1 } from '../src/services/cloudsync/types.ts';
import { LocalSyncPayloadSource } from '../src/services/cloudsync/payloadSource.ts';

function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

const DAY = 86_400_000;

// ---- Hashing / canonical serialization (browser+Electron parity core) ----

test('SHA-256 and canonical JSON are deterministic across platforms', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(canonicalizeJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } }), '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}');
  const record = { entityId: 'nb-1', name: 'Physics', updatedAt: 42 };
  assert.equal(await hashCanonical(record), await hashCanonical({ updatedAt: 42, name: 'Physics', entityId: 'nb-1' }), 'key order must not change the hash');
});

// ---- Journal: creation, revisions, coalescing ----

test('journal entries carry identity, monotonic revision, and tombstone state', () => {
  const entry = createJournalEntry({
    entityType: 'notebook', entityId: 'nb-1', workspaceId: 'ws-1', operation: 'update',
    currentLocalRevision: 4, contentHash: 'a'.repeat(64), baseRevision: 4, now: 100, entryId: 'sj-1',
  });
  assert.equal(entry.localRevision, 5);
  assert.equal(entry.tombstone, false);
  assert.equal(entry.state, 'pending');
  const deletion = createJournalEntry({
    entityType: 'notebook', entityId: 'nb-1', workspaceId: 'ws-1', operation: 'delete',
    currentLocalRevision: 5, contentHash: null, baseRevision: 5, now: 200, entryId: 'sj-2', deletedAt: 200,
  });
  assert.equal(deletion.tombstone, true);
  assert.equal(deletion.deletedAt, 200);
});

test('pending entries coalesce; synced history is never rewritten', () => {
  const create = createJournalEntry({ entityType: 'canvasScene', entityId: 'c-1', workspaceId: 'ws-1', operation: 'create', currentLocalRevision: 0, contentHash: 'h1', baseRevision: null, now: 1, entryId: 'j1' });
  const update = createJournalEntry({ entityType: 'canvasScene', entityId: 'c-1', workspaceId: 'ws-1', operation: 'update', currentLocalRevision: 1, contentHash: 'h2', baseRevision: null, now: 2, entryId: 'j2' });
  const coalesced = coalesceWithPending(update, create);
  assert.equal(coalesced.operation, 'create', 'remote never saw the entity → still a create');

  const pendingUpdate = { ...create, operation: 'update' as const };
  const deletion = createJournalEntry({ entityType: 'canvasScene', entityId: 'c-1', workspaceId: 'ws-1', operation: 'delete', currentLocalRevision: 2, contentHash: null, baseRevision: null, now: 3, entryId: 'j3', deletedAt: 3 });
  assert.equal(coalesceWithPending(deletion, pendingUpdate).operation, 'delete');

  const pendingDelete = { ...create, operation: 'delete' as const, tombstone: true };
  const restore = createJournalEntry({ entityType: 'canvasScene', entityId: 'c-1', workspaceId: 'ws-1', operation: 'restore', currentLocalRevision: 2, contentHash: 'h1', baseRevision: null, now: 4, entryId: 'j4' });
  assert.equal(coalesceWithPending(restore, pendingDelete).operation, 'restore');

  const syncedEntry = { ...create, state: 'synced' as const };
  assert.equal(coalesceWithPending(update, syncedEntry), update, 'synced history must never be coalesced away');
});

test('retry backoff is bounded, exponential, and exhausts into a visible error', () => {
  assert.ok(nextAttemptDelayMs(0)! >= 1_700 && nextAttemptDelayMs(0)! <= 2_300);
  assert.ok(nextAttemptDelayMs(6)! <= 10 * 60_000);
  assert.equal(nextAttemptDelayMs(MAX_JOURNAL_ATTEMPTS), null, 'no aggressive infinite retries');
  const entry = createJournalEntry({ entityType: 'pageContent', entityId: 'p-1', workspaceId: 'ws-1', operation: 'update', currentLocalRevision: 1, contentHash: 'h', baseRevision: 1, now: 0, entryId: 'j' });
  const exhausted = Array.from({ length: MAX_JOURNAL_ATTEMPTS }, (_, index) => index).reduce(current => markAttempt(current, 'provider-error', 0, () => 0), entry);
  assert.equal(exhausted.state, 'error');
  assert.equal(exhausted.lastErrorClass, 'provider-error');
});

test('manifest acknowledgment requires exact hash and revision match', () => {
  const entry = createJournalEntry({ entityType: 'canvasFile', entityId: 'c-9', workspaceId: 'ws-1', operation: 'update', currentLocalRevision: 3, contentHash: 'h'.repeat(64), baseRevision: 2, now: 0, entryId: 'j' });
  const pointer = journalToRecordPointer(entry, null);
  assert.equal(isAcknowledgedByManifest(entry, [pointer]), true);
  assert.equal(isAcknowledgedByManifest(entry, [{ ...pointer, revision: 2 }]), false, 'stale remote revision cannot ack');
  assert.equal(isAcknowledgedByManifest(entry, [{ ...pointer, contentHash: 'x'.repeat(64) }]), false, 'different content cannot ack');
  const tombstoned = { ...entry, tombstone: true };
  assert.equal(isAcknowledgedByManifest(tombstoned, [journalToRecordPointer(tombstoned, null)]), true);
});

// ---- Conflict policy ----

test('deterministic conflict policy: identical hashes coalesce, stale-base edits replace', () => {
  const remote = { revision: 5, baseRevision: 4, contentHash: 'h1', tombstone: false };
  assert.deepEqual(decideConflict({ baseRevision: 5, contentHash: 'h1', tombstone: false }, remote), { kind: 'coalesce' });
  assert.deepEqual(decideConflict({ baseRevision: 5, contentHash: 'h2', tombstone: false }, remote), { kind: 'replace-base' });
  assert.deepEqual(decideConflict({ baseRevision: null, contentHash: 'h9', tombstone: false }, null), { kind: 'publish-local' });
  assert.deepEqual(
    decideConflict({ baseRevision: null, contentHash: 'unknown-local', tombstone: false }, remote),
    { kind: 'conflict', reason: 'concurrent-edit-edit' },
    'an unknown base must never replace an existing remote head',
  );
});

test('delete vs offline edit is always a visible conflict — never silent destruction', () => {
  const remoteTombstone = { revision: 6, baseRevision: 5, contentHash: 'tombstone', tombstone: true };
  assert.deepEqual(
    decideConflict({ baseRevision: 4, contentHash: 'h2', tombstone: false }, remoteTombstone),
    { kind: 'conflict', reason: 'delete-vs-edit' },
  );
  // Concurrent deletion of a remotely-edited record also conflicts.
  const remoteEdit = { revision: 6, baseRevision: 5, contentHash: 'h2', tombstone: false };
  assert.deepEqual(
    decideConflict({ baseRevision: 4, contentHash: null, tombstone: true }, remoteEdit),
    { kind: 'conflict', reason: 'edit-vs-delete' },
  );
  // A deletion based on the current head wins cleanly.
  assert.deepEqual(
    decideConflict({ baseRevision: 6, contentHash: null, tombstone: true }, remoteEdit),
    { kind: 'tombstone-wins' },
  );
  assert.deepEqual(
    decideConflict({ baseRevision: 3, contentHash: 'h2', tombstone: false }, { revision: 6, baseRevision: 5, contentHash: 'h1', tombstone: false }),
    { kind: 'conflict', reason: 'concurrent-edit-edit' },
  );
});

test('conflict copies are device-scoped and bounded', () => {
  assert.equal(conflictCopyName('Physics Notes', 'Laptop'), 'Physics Notes (Conflict — Laptop)');
  const long = conflictCopyName('X'.repeat(200), 'Tablet');
  assert.ok(long.length <= 120);
  assert.ok(long.endsWith('(Conflict — Tablet)'));
});

test('independent metadata changes merge; simultaneous edits surface as conflicts', () => {
  const localBase = { isPinned: false, name: 'Same', order: 1 };
  const merged = mergeIndependentMetadata(
    { isPinned: true, name: 'Same', order: 1 },
    { isPinned: false, name: 'Same', order: 1 },
    localBase,
  );
  assert.deepEqual(merged.merged, { isPinned: true, name: 'Same', order: 1 });
  assert.deepEqual(merged.conflictingKeys, []);
  const clash = mergeIndependentMetadata(
    { isPinned: true, name: 'Local Name', order: 1 },
    { isPinned: false, name: 'Remote Name', order: 1 },
    localBase,
  );
  assert.equal(clash.merged.name, 'Remote Name', 'shared head keeps remote; local survives in the sidecar');
  assert.deepEqual(clash.conflictingKeys, ['name']);
});

// ---- 30-day Trash lifecycle ----

test('trash countdown shows user-visible retention and purge eligibility', () => {
  const now = 1_000 * DAY;

  // Newly deleted item (0 ms elapsed): 30 days remaining
  assert.deepEqual(trashCountdown(now, now), { daysRemaining: 30, purgeEligible: false, label: 'Deletes permanently in 30 days' });

  // 3 days elapsed: 27 days remaining
  assert.deepEqual(trashCountdown(now - 3 * DAY, now), { daysRemaining: 27, purgeEligible: false, label: 'Deletes permanently in 27 days' });

  // 12 days elapsed: 18 days remaining
  assert.deepEqual(trashCountdown(now - 12 * DAY, now), { daysRemaining: 18, purgeEligible: false, label: 'Deletes permanently in 18 days' });

  // 28 days elapsed: 2 days remaining
  assert.deepEqual(trashCountdown(now - 28 * DAY, now), { daysRemaining: 2, purgeEligible: false, label: 'Deletes permanently in 2 days' });

  // 29 days elapsed: 1 day remaining => tomorrow
  assert.deepEqual(trashCountdown(now - 29 * DAY, now), { daysRemaining: 1, purgeEligible: false, label: 'Deletes permanently tomorrow' });

  // 29.5 days elapsed (<24h remaining) => today
  assert.deepEqual(trashCountdown(now - 29.5 * DAY, now), { daysRemaining: 0, purgeEligible: false, label: 'Deletes permanently today' });

  // 30 days elapsed: exact purge threshold
  assert.deepEqual(trashCountdown(now - 30 * DAY, now), { daysRemaining: 0, purgeEligible: true, label: 'Deletes permanently today' });

  // 31 days elapsed: past purge threshold
  assert.deepEqual(trashCountdown(now - 31 * DAY, now), { daysRemaining: 0, purgeEligible: true, label: 'Deletes permanently today' });

  // Missing/invalid deletedAt fallback
  assert.deepEqual(trashCountdown(null, now), { daysRemaining: 0, purgeEligible: false, label: 'Deletion date unavailable' });
  assert.deepEqual(trashCountdown(undefined, now), { daysRemaining: 0, purgeEligible: false, label: 'Deletion date unavailable' });
  assert.deepEqual(trashCountdown(0, now), { daysRemaining: 0, purgeEligible: false, label: 'Deletion date unavailable' });

  assert.equal(TRASH_RETENTION_DAYS, 30);
  const roots = purgeEligibleRoots(
    [
      { id: 'old', deletedAt: now - 31 * DAY },
      { id: 'exact', deletedAt: now - 30 * DAY },
      { id: 'fresh', deletedAt: now - 3 * DAY },
      { id: 'active', deletedAt: null },
    ],
    now,
  );
  assert.deepEqual(roots, ['old', 'exact']);
  // Tombstones outlive the payload purge (offline devices cannot resurrect).
  assert.deepEqual(retentionDecision(now), { purgePayloadAfterDays: 30, tombstoneRetention: 'until-all-devices-acknowledge' });
});

// ---- Manifest + engine (fake provider adapters, zero network) ----

interface FakeStoreState { entries: SyncJournalEntry[] }

function makeStore(state: FakeStoreState, workspaceId: string): SyncJournalStore & { state: FakeStoreState } {
  return {
    state,
    async listPending(ws: string, now: number) {
      return state.entries.filter(entry => entry.workspaceId === ws && entry.state === 'pending' && (entry.nextAttemptAt === null || entry.nextAttemptAt <= now));
    },
    async upsert(entry: SyncJournalEntry) {
      const index = state.entries.findIndex(candidate => candidate.entryId === entry.entryId);
      if (index >= 0) state.entries[index] = entry; else state.entries.push(entry);
    },
    async latestByEntity(ws: string) {
      const map = new Map<string, SyncJournalEntry>();
      for (const entry of state.entries.filter(candidate => candidate.workspaceId === ws)) {
        map.set(`${entry.entityType}:${entry.entityId}`, entry);
      }
      return map;
    },
  };
}

function entry(partial: Partial<SyncJournalEntry> & { entityId: string; workspaceId?: string }): SyncJournalEntry {
  return {
    entryId: `sj-${partial.entityId}`, entityType: 'canvasFile', entityId: partial.entityId,
    workspaceId: partial.workspaceId ?? 'ws-1', operation: 'update', localRevision: 5,
    contentHash: 'h-local', baseRevision: 5, updatedAt: 0, deletedAt: null, tombstone: false,
    state: 'pending', attempts: 0, nextAttemptAt: null, lastErrorClass: null, payloadRef: partial.entityId,
    ...partial,
  };
}

interface FakeProviderState {
  manifest: SyncManifestV1 | null;
  etag: string;
  objects: Map<string, Uint8Array>;
  failWritesWithProviderConflict?: boolean;
}

function makeProvider(state: FakeProviderState): CloudSyncProvider & { written: SyncManifestV1[]; uploads: string[] } {
  return {
    id: 'onedrive',
    supportsResumableUpload: false,
    written: [],
    uploads: [],
    async connect() { return { provider: 'onedrive', accountIdentifier: 'acc-1', connectedAt: 0 }; },
    async disconnect() {},
    async getAccountInfo() { return null; },
    async ensureAppRoot() { return 'root'; },
    async readManifest(): Promise<RemoteManifestRead> {
      return { manifest: state.manifest, etag: state.etag };
    },
    async writeManifest(_workspaceId: string, manifest: SyncManifestV1) {
      if (state.failWritesWithProviderConflict) throw new ProviderConflictError();
      state.manifest = manifest;
      state.etag = `etag-${manifest.revision}`;
      this.written.push(manifest);
      return { etag: state.etag };
    },
    async getObject(_ws: string, hash: string) { return state.objects.get(hash) ?? new Uint8Array(); },
    async putObjectIfAbsent(_ws: string, upload: { hash: string; bytes: Uint8Array }) {
      this.uploads.push(upload.hash);
      state.objects.set(upload.hash, upload.bytes);
    },
    async deleteObject() {},
    async moveObject() {},
    async getMetadata(_ws: string, hash: string) { const bytes = state.objects.get(hash); return bytes ? { size: bytes.byteLength } : null; },
  };
}

const DEVICE = { workspaceId: 'ws-1', deviceId: 'device-A', now: 1_000 };

test('sync cycle publishes payloads before the manifest, acknowledges the conditional write, and does not download its own publish', async () => {
  const state: FakeStoreState = { entries: [entry({ entityId: 'c-1', contentHash: 'h'.repeat(64) })] };
  const store = makeStore(state, 'ws-1');
  const provider = makeProvider({ manifest: null, etag: null, objects: new Map() });
  const uploadOrder: string[] = [];
  const result = await runSyncCycle({
    ...DEVICE,
    journalStore: store,
    provider,
    payloadSource: {
      async loadPayload(e) { uploadOrder.push('payload'); return new Uint8Array([1]); },
      async parentOf() { return null; },
    },
    deviceState: { lastSeenRevision: 0 },
  });

  assert.equal(uploadOrder[0], 'payload', 'object upload must precede the manifest publish');
  assert.equal(result.manifestPublished, true);
  assert.equal(result.acknowledged, 1);
  assert.deepEqual(result.recordsForDownload, [], 'freshly acknowledged same-device records must not be scheduled for local re-apply');
  assert.match(provider.uploads[0], /^[a-f0-9]{64}$/);
  assert.equal(provider.uploads[0], provider.written[0]?.records[0].contentHash, 'manifest must reference the hash of the uploaded bytes');
  assert.deepEqual(provider.written[0]?.records.map(r => r.id), ['c-1']);
  assert.equal(state.entries[0].state, 'synced');
  assert.equal(provider.written[0]?.previousRevision, null);
  assert.equal(provider.written[0]?.writerDeviceId, 'deviceId-A' in DEVICE ? (DEVICE as { deviceId: string }).deviceId : 'device-A');
  const hashA = await manifestHash(provider.written[0]);
  const hashB = await manifestHash(provider.written[0]);
  assert.equal(hashA, hashB, 'manifest hashing is canonical and stable');
});

test('identical remote hashes coalesce into local acks without uploading', async () => {
  const hash = 'a'.repeat(64);
  const state: FakeStoreState = { entries: [entry({ entityId: 'c-1', contentHash: hash })] };
  const store = makeStore(state, 'ws-1');
  const provider = makeProvider({
    manifest: buildManifestV1({ workspaceId: 'ws-1', revision: 5, previousRevision: 4, writerDeviceId: 'device-B', generatedAt: '0', records: [{ kind: 'canvasFile', id: 'c-1', parentId: null, revision: 5, baseRevision: 5, contentHash: hash, tombstone: false }] }),
    etag: 'e1', objects: new Map(),
  });
  const result = await runSyncCycle({
    ...DEVICE, journalStore: store, provider,
    payloadSource: { async loadPayload() { throw new Error('must not upload'); }, async parentOf() { return null; } },
    deviceState: { lastSeenRevision: 5 },
  });
  assert.equal(result.acknowledged, 1);
  assert.equal(result.published, 0);
  assert.equal(provider.uploads.length, 0);
});

test('concurrent edit/edit becomes a visible conflict and never discards local content', async () => {
  const state: FakeStoreState = { entries: [entry({ entityId: 'c-1', contentHash: 'b'.repeat(64), baseRevision: 3 })] };
  const store = makeStore(state, 'ws-1');
  const provider = makeProvider({
    manifest: buildManifestV1({ workspaceId: 'ws-1', revision: 9, previousRevision: 8, writerDeviceId: 'device-B', generatedAt: '0', records: [{ kind: 'canvasFile', id: 'c-1', parentId: null, revision: 9, baseRevision: 8, contentHash: 'a'.repeat(64), tombstone: false }] }),
    etag: 'e2', objects: new Map(),
  });
  const result = await runSyncCycle({
    ...DEVICE, journalStore: store, provider,
    payloadSource: { async loadPayload() { return new Uint8Array([1]); }, async parentOf() { return null; } },
    deviceState: { lastSeenRevision: 9 },
  });
  assert.deepEqual(result.conflicts, [{ entityId: 'c-1', reason: 'concurrent-edit-edit' }]);
  assert.equal(result.published, 0);
  assert.equal(state.entries[0].state, 'conflict', 'local edit stays intact and visible as a conflict');
});

test('workspace isolation: entries from other workspaces are never touched', async () => {
  const state: FakeStoreState = {
    entries: [
      entry({ entityId: 'c-other', workspaceId: 'ws-OTHER', contentHash: 'h'.repeat(64) }),
      entry({ entityId: 'c-mine', workspaceId: 'ws-1', contentHash: 'h'.repeat(64) }),
    ],
  };
  const store = makeStore(state, 'ws-1');
  const provider = makeProvider({ manifest: null, etag: null, objects: new Map() });
  await runSyncCycle({
    ...DEVICE, journalStore: store, provider,
    payloadSource: { async loadPayload() { return new Uint8Array([1]); }, async parentOf() { return null; } },
    deviceState: { lastSeenRevision: 0 },
  });
  assert.equal(provider.written[0]?.workspaceId, 'ws-1');
  assert.equal(state.entries.find(e => e.entityId === 'c-other')?.state, 'pending', 'other workspace journal untouched');
  const otherPointer = provider.written[0]?.records.find(r => r.id === 'c-other');
  assert.equal(otherPointer, undefined, 'no cross-workspace leakage into the manifest');
});

test('stale ifMatch writes reject as provider conflict and entries remain pending for repull', async () => {
  const state: FakeStoreState = { entries: [entry({ entityId: 'c-1', contentHash: 'h'.repeat(64) })] };
  const store = makeStore(state, 'ws-1');
  const provider = makeProvider({ manifest: null, etag: 'stale', objects: new Map(), failWritesWithProviderConflict: true });
  const result = await runSyncCycle({
    ...DEVICE, journalStore: store, provider,
    payloadSource: { async loadPayload() { return new Uint8Array([1]); }, async parentOf() { return null; } },
    deviceState: { lastSeenRevision: 0 },
  });
  assert.equal(result.needsRepull, true);
  assert.equal(result.manifestPublished, false);
  assert.equal(state.entries[0].state, 'pending', 'provider conflict never deletes or corrupts journal state');
});

test('untrusted remote manifests are quarantined, never published over', async () => {
  const state: FakeStoreState = { entries: [entry({ entityId: 'c-1', contentHash: 'h'.repeat(64) })] };
  const store = makeStore(state, 'ws-1');
  const provider = makeProvider({ manifest: { format: 'panvas-sync', schemaVersion: 1, workspaceId: 'ws-1', revision: 1, previousRevision: null, writerDeviceId: 'x', generatedAt: '', records: [{ kind: 'not-a-kind' as never, id: '', parentId: null, revision: 1, baseRevision: null, contentHash: 'nothex', tombstone: false }] }, etag: 'e', objects: new Map() });
  const result = await runSyncCycle({
    ...DEVICE, journalStore: store, provider,
    payloadSource: { async loadPayload() { return new Uint8Array([1]); }, async parentOf() { return null; } },
    deviceState: { lastSeenRevision: 0 },
  });
  assert.equal(result.needsRepull, true);
  assert.equal(provider.written.length, 0);
  assert.equal(validateRemoteManifest({ format: 'bogus' }), null);
});

test('manifest records merge without dropping remote entities', () => {
  const remote = [{ kind: 'notebook' as const, id: 'nb-1', parentId: null, revision: 2, baseRevision: 1, contentHash: 'a'.repeat(64), tombstone: false }];
  const published = [{ kind: 'canvasFile' as const, id: 'c-1', parentId: null, revision: 5, baseRevision: 5, contentHash: 'b'.repeat(64), tombstone: false }];
  const replaced = [{ kind: 'canvasFile' as const, id: 'c-1', parentId: null, revision: 6, baseRevision: 5, contentHash: 'c'.repeat(64), tombstone: false }];
  const merged = mergeRecords(remote, published);
  assert.equal(merged.length, 2);
  assert.deepEqual(mergeRecords([...remote, published[0]], replaced).map(r => r.id).sort(), ['c-1', 'nb-1']);
  assert.equal(mergeRecords([...remote, published[0]], replaced).find(r => r.id === 'c-1')?.revision, 6);
});

test('empty-remote bootstrap publishes pre-existing notebook content, then preserves updates, restore, and idempotency', async () => {
  const state: FakeStoreState = { entries: [] };
  const store = makeStore(state, 'ws-existing');
  const provider = makeProvider({ manifest: null, etag: null, objects: new Map() });
  const values = new Map([
    ['workspace:ws-existing', { id: 'ws-existing', name: 'Existing workspace' }],
    ['notebook:nb-1', { id: 'nb-1', workspaceId: 'ws-existing', name: 'Notebook' }],
    ['notebookSection:sec-1', { id: 'sec-1', notebookId: 'nb-1', name: 'Section' }],
    ['notebookPage:page-1', { id: 'page-1', notebookId: 'nb-1', sectionId: 'sec-1', title: 'Page' }],
    ['pageContent:page-1', { pageId: 'page-1', data: { type: 'doc', content: [{ type: 'text', text: 'real text' }] } }],
    ['pageDrawing:page-1', { pageId: 'page-1', data: { strokes: [{ id: 'stroke-1', points: [[1, 2], [3, 4]] }] } }],
  ]);
  const source = {
    async scanWorkspace() {
      const rows = [
        ['workspace', 'ws-existing', null], ['notebook', 'nb-1', 'ws-existing'],
        ['notebookSection', 'sec-1', 'nb-1'], ['notebookPage', 'page-1', 'sec-1'],
        ['pageContent', 'page-1', 'page-1'], ['pageDrawing', 'page-1', 'page-1'],
      ] as const;
      return rows.map(([entityType, entityId, parentId]) => ({
        entityType, entityId, workspaceId: 'ws-existing', parentId,
        bytes: new TextEncoder().encode(canonicalizeJson(values.get(`${entityType}:${entityId}`))),
        tombstone: false, deletedAt: null,
      }));
    },
    async loadPayload(e: SyncJournalEntry) {
      const value = values.get(`${e.entityType}:${e.entityId}`);
      return value ? new TextEncoder().encode(canonicalizeJson(value)) : null;
    },
    async parentOf(e: SyncJournalEntry) {
      return (await this.scanWorkspace()).find(row => row.entityType === e.entityType && row.entityId === e.entityId)?.parentId ?? null;
    },
  };
  const deviceState = { lastSeenRevision: 0 };
  const first = await runSyncCycle({ workspaceId: 'ws-existing', deviceId: 'device-A', journalStore: store, provider, payloadSource: source, deviceState, now: 1_000 });
  assert.equal(first.localEntitiesScanned, 6);
  assert.equal(first.objectsUploaded, 6);
  assert.equal(first.manifestPublished, true);
  assert.equal(first.manifestEntries, 6);
  assert.deepEqual(new Set(provider.written[0].records.map(row => `${row.kind}:${row.id}`)), new Set(values.keys()));
  assert.ok(state.entries.every(item => item.state === 'synced'));

  values.set('pageContent:page-1', { pageId: 'page-1', data: { type: 'doc', content: [{ type: 'text', text: 'edited text' }] } });
  values.set('notebookPage:page-2', { id: 'page-2', notebookId: 'nb-1', sectionId: 'sec-1', title: 'Second page' });
  state.entries.push(
    createJournalEntry({ entityType: 'pageContent', entityId: 'page-1', workspaceId: 'ws-existing', operation: 'update', currentLocalRevision: 1, contentHash: 'stale-journal-hash', baseRevision: 1, now: 2_000, entryId: 'edit-page-1' }),
    createJournalEntry({ entityType: 'notebookPage', entityId: 'page-2', workspaceId: 'ws-existing', operation: 'create', currentLocalRevision: 0, contentHash: 'stale-journal-hash', baseRevision: null, now: 2_000, entryId: 'create-page-2' }),
  );
  const second = await runSyncCycle({ workspaceId: 'ws-existing', deviceId: 'device-A', journalStore: store, provider, payloadSource: source, deviceState, now: 2_000 });
  assert.equal(second.objectsUploaded, 2);
  assert.equal(second.manifestPublished, true);
  assert.equal(provider.written.at(-1)?.records.filter(row => row.kind === 'notebookPage' && row.id === 'page-2').length, 1);
  assert.equal(provider.written.at(-1)?.records.filter(row => row.kind === 'pageContent' && row.id === 'page-1').length, 1);

  state.entries.push(createJournalEntry({ entityType: 'notebookPage', entityId: 'page-2', workspaceId: 'ws-existing', operation: 'delete', currentLocalRevision: 1, contentHash: null, baseRevision: 1, now: 2_500, entryId: 'delete-page-2', deletedAt: 2_500 }));
  const deleted = await runSyncCycle({ workspaceId: 'ws-existing', deviceId: 'device-A', journalStore: store, provider, payloadSource: source, deviceState, now: 2_500 });
  assert.equal(deleted.manifestPublished, true);
  assert.equal(provider.written.at(-1)?.records.find(row => row.kind === 'notebookPage' && row.id === 'page-2')?.tombstone, true);

  state.entries.push(createJournalEntry({ entityType: 'notebookPage', entityId: 'page-2', workspaceId: 'ws-existing', operation: 'restore', currentLocalRevision: 2, contentHash: 'stale-journal-hash', baseRevision: 2, now: 2_750, entryId: 'restore-page-2' }));
  const restored = await runSyncCycle({ workspaceId: 'ws-existing', deviceId: 'device-A', journalStore: store, provider, payloadSource: source, deviceState, now: 2_750 });
  assert.equal(restored.manifestPublished, true);
  assert.equal(provider.written.at(-1)?.records.find(row => row.kind === 'notebookPage' && row.id === 'page-2')?.tombstone, false);
  assert.equal(provider.written.at(-1)?.records.filter(row => row.kind === 'notebookPage' && row.id === 'page-2').length, 1);

  const writesBefore = provider.written.length;
  const uploadsBefore = provider.uploads.length;
  const third = await runSyncCycle({ workspaceId: 'ws-existing', deviceId: 'device-A', journalStore: store, provider, payloadSource: source, deviceState, now: 3_000 });
  assert.equal(third.objectsUploaded, 0);
  assert.equal(third.manifestPublished, false);
  assert.equal(provider.written.length, writesBefore);
  assert.equal(provider.uploads.length, uploadsBefore);
});

test('empty remote with no canonical entities cannot report a successful sync', async () => {
  const state: FakeStoreState = { entries: [] };
  const emptyManifest = buildManifestV1({ workspaceId: 'missing', revision: 1, previousRevision: null, writerDeviceId: 'old-device', generatedAt: '0', records: [] });
  const result = await runSyncCycle({
    workspaceId: 'missing', deviceId: 'device-A', journalStore: makeStore(state, 'missing'),
    provider: makeProvider({ manifest: emptyManifest, etag: 'empty-etag', objects: new Map() }),
    payloadSource: { async scanWorkspace() { return []; }, async loadPayload() { return null; }, async parentOf() { return null; } },
    deviceState: { lastSeenRevision: 0 }, now: 1_000,
  });
  assert.equal(result.manifestPublished, false);
  assert.deepEqual(result.errors, [{ entityId: 'missing', stage: 'bootstrap-scan', errorClass: 'initial-scan-empty' }]);
});

test('valid workspace with no child content bootstraps as a successful one-record workspace', async () => {
  const state: FakeStoreState = { entries: [] };
  const store = makeStore(state, 'ws-empty');
  const provider = makeProvider({ manifest: null, etag: null, objects: new Map() });
  const bytes = new TextEncoder().encode(JSON.stringify({ id: 'ws-empty', name: 'Empty workspace' }));
  const result = await runSyncCycle({
    workspaceId: 'ws-empty', deviceId: 'device-empty', journalStore: store, provider,
    payloadSource: {
      async scanWorkspace() { return [{ entityType: 'workspace' as const, entityId: 'ws-empty', workspaceId: 'ws-empty', parentId: null, bytes, tombstone: false, deletedAt: null }]; },
      async loadPayload() { return bytes; },
      async parentOf() { return null; },
    },
    deviceState: { lastSeenRevision: 0 }, now: 2_000,
  });
  assert.equal(result.upToDate, true);
  assert.equal(result.errors.length, 0);
  assert.deepEqual(provider.written[0]?.records.map(pointer => `${pointer.kind}:${pointer.id}`), ['workspace:ws-empty']);
});

test('existing remote manifests reconcile locally persisted metadata missing from the journal', async () => {
  const sectionBytes = new TextEncoder().encode(JSON.stringify({ id: 'sec-1', notebookId: 'nb-1', name: 'Section 1' }));
  const state: FakeStoreState = { entries: [createJournalEntry({
    entityType: 'workspace', entityId: 'ws-reconcile', workspaceId: 'ws-reconcile', operation: 'create',
    currentLocalRevision: 0, contentHash: await sha256Hex('workspace'), baseRevision: null, now: 1, entryId: 'workspace-baseline',
  })] };
  state.entries[0] = { ...state.entries[0], state: 'synced' };
  const store = makeStore(state, 'ws-reconcile');
  const provider = makeProvider({
    manifest: buildManifestV1({ workspaceId: 'ws-reconcile', revision: 1, previousRevision: null, writerDeviceId: 'device-B', generatedAt: '0', records: [{ kind: 'workspace', id: 'ws-reconcile', parentId: null, revision: 1, baseRevision: null, contentHash: await sha256Hex('workspace'), tombstone: false }] }),
    etag: 'etag-1', objects: new Map(),
  });
  const result = await runSyncCycle({
    ...DEVICE, workspaceId: 'ws-reconcile', journalStore: store, provider,
    payloadSource: {
      async scanWorkspace() { return [
        { entityType: 'workspace' as const, entityId: 'ws-reconcile', workspaceId: 'ws-reconcile', parentId: null, bytes: new TextEncoder().encode('workspace'), tombstone: false, deletedAt: null },
        { entityType: 'notebookSection' as const, entityId: 'sec-1', workspaceId: 'ws-reconcile', parentId: 'nb-1', bytes: sectionBytes, tombstone: false, deletedAt: null },
      ]; },
      async loadPayload(entry: SyncJournalEntry) { return entry.entityId === 'sec-1' ? sectionBytes : new TextEncoder().encode('workspace'); },
      async parentOf() { return 'nb-1'; },
    },
    deviceState: { lastSeenRevision: 1 }, now: 2_000,
  });
  assert.equal(result.manifestPublished, true);
  assert.ok(provider.written.at(-1)?.records.some(pointer => pointer.kind === 'notebookSection' && pointer.id === 'sec-1'));
});

test('Electron payload scan reads filesystem-backed page and canvas payloads through canonical IPC capabilities', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const calls: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { panvas: {
    workspace: { getAll: async () => [{ id: 'ws-electron', name: 'Workspace', deletedAt: null }] },
    folder: { getAll: async () => [] },
    notebook: {
      getAll: async () => [{ id: 'nb-electron', workspaceId: 'ws-electron', folderId: null, deletedAt: null }],
      loadPage: async (_workspaceId: string, _notebookId: string, pageId: string) => { calls.push(`loadPage:${pageId}`); return { type: 'doc', content: [{ type: 'text', text: `filesystem text ${pageId}` }] }; },
      loadDrawing: async (_workspaceId: string, _notebookId: string, pageId: string) => { calls.push(`loadDrawing:${pageId}`); return { strokes: [{ id: `ink-${pageId}` }] }; },
    },
    notebookSection: { getAll: async () => [{ id: 'sec-electron', notebookId: 'nb-electron', deletedAt: null }] },
    notebookPage: { getAll: async () => [
      { id: 'page-electron', notebookId: 'nb-electron', sectionId: 'sec-electron', deletedAt: null },
      { id: 'page-electron-2', notebookId: 'nb-electron', sectionId: 'sec-electron', deletedAt: null },
    ] },
    canvasFile: { getAll: async () => [{ id: 'canvas-electron', workspaceId: 'ws-electron', folderId: null, notebookId: null, deletedAt: null }] },
    canvas: { load: async () => { calls.push('canvas.load'); return { canvasFileId: 'canvas-electron', elements: [{ id: 'shape' }] }; } },
  } } });
  try {
    const source = new LocalSyncPayloadSource();
    const scanned = await source.scanWorkspace('ws-electron');
    assert.ok(scanned.some(item => item.entityType === 'pageContent' && item.entityId === 'page-electron' && item.bytes?.byteLength));
    assert.ok(scanned.some(item => item.entityType === 'pageDrawing' && item.entityId === 'page-electron' && item.bytes?.byteLength));
    assert.ok(scanned.some(item => item.entityType === 'pageContent' && item.entityId === 'page-electron-2' && item.bytes?.byteLength));
    assert.ok(scanned.some(item => item.entityType === 'pageDrawing' && item.entityId === 'page-electron-2' && item.bytes?.byteLength));
    assert.ok(scanned.some(item => item.entityType === 'canvasScene' && item.entityId === 'canvas-electron' && item.bytes?.byteLength));
    assert.deepEqual(calls.sort(), ['canvas.load', 'loadDrawing:page-electron', 'loadDrawing:page-electron-2', 'loadPage:page-electron', 'loadPage:page-electron-2']);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  }
});

test('Electron payload scan publishes a deleted workspace root from Trash', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { panvas: {
    workspace: { getAll: async () => [] },
    trash: { getAll: async () => ({
      workspaces: [{ id: 'ws-deleted', name: 'Deleted workspace', deletedAt: 123 }],
      folders: [], canvasFiles: [], notebooks: [], sections: [], pages: [],
    }) },
  } } });
  try {
    const source = new LocalSyncPayloadSource();
    const scanned = await source.scanWorkspace('ws-deleted');
    assert.equal(scanned.length, 1);
    assert.equal(scanned[0]?.entityType, 'workspace');
    assert.equal(scanned[0]?.entityId, 'ws-deleted');
    assert.equal(scanned[0]?.tombstone, true);
    assert.equal(scanned[0]?.bytes, null);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  }
});

// ---- Wiring contracts: local-save-first journaling + trash lifecycle ----

test('local mutations journal through the detached recorder; trash sweeps through permanent delete', async () => {
  const store = await read('../src/stores/workspaceStore.ts');
  assert.match(store, /function journalChange\(change: LocalChangeRecord\): void/);
  assert.match(store, /recordLocalChangeDetached/);
  for (const wired of [
    /entityType: 'workspace', entityId: workspace\.id, workspaceId: workspace\.id, operation: 'create'/,
    /entityType: 'canvasFile', entityId: id, workspaceId: wsId, operation: 'delete', deletedAt: Date\.now\(\)/,
    /entityType: 'notebook', entityId: id, workspaceId: wsId, operation: 'delete', deletedAt: Date\.now\(\)/,
    /entityType: restoredKind, entityId: id, workspaceId: wsId \?\? id, operation: 'restore'/,
    /entityType: SyncEntityKind = type === 'canvas' \? 'canvasFile' : type === 'section' \? 'notebookSection' : type === 'page' \? 'notebookPage' : type/,
    /void get\(\)\.sweepExpiredTrash\(\)/,
  ]) {
    assert.match(store, wired);
  }
  const repo = await read('../src/repositories/CanvasRepository.ts');
  assert.match(repo, /entityType: 'canvasScene'/, 'canvas scene saves journal through the local-save-first path');
  const schema = await read('../src/database/schema.ts');
  assert.match(schema, /this\.version\(6\)/);
  assert.match(schema, /syncJournal: 'entryId, entityId, entityType, workspaceId, state, updatedAt'/);

  // Deleted-by-ancestor semantics preserved (restore never resurrects a
  // directly-deleted child).
  const trashModule = await read('../electron/ipc/workspace-trash.ts');
  assert.match(trashModule, /deletedByAncestorId/);
});

test('security contract: renderer stays token-free and scopes stay least-privilege', async () => {
  const types = await read('../src/services/cloudsync/types.ts');
  assert.match(types, /interface CloudTokenStore/);
  assert.match(types, /drive\.file/);
  assert.ok(!types.includes('https://www.googleapis.com/auth/drive\''), 'full-drive scope must not be requested');
  assert.match(types, /Files\.ReadWrite\.AppFolder/);
  const cloudStore = await read('../src/stores/cloudSyncStore.ts');
  assert.match(cloudSyncStoreGuard(cloudStore), /googledrive|coming in the next phase|adapters are not wired/i);
  const panel = await read('../src/components/library/CloudSyncPanel.tsx');
  assert.match(panel, /coming later|coming in the next phase/i);
  assert.match(panel, /works fully offline without an account/);
  assert.match(panel, /your own/);
  // No network stack in the Phase 1 core.
  const engine = await read('../src/services/cloudsync/engine.ts');
  assert.ok(!/fetch\(|XMLHttpRequest|GraphClient|drive\.google/.test(engine));
});

function cloudSyncStoreGuard(source: string): string {
  return source;
}
