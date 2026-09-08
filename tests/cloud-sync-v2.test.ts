import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runCloudSyncV2 } from '../src/services/cloudsync/v2/engine.ts';
import { encodeAssetEnvelope, decodeAssetEnvelope } from '../src/services/cloudsync/assetEnvelope.ts';
import { sha256Bytes } from '../src/services/cloudsync/hash.ts';
import { parsePdfAnnotationStorageId, pdfAnnotationStorageId } from '../src/lib/pdfAnnotationStorage.ts';
import { LocalSyncPayloadSource, semanticSystemBootstrapBytes, type BrowserSyncSnapshot } from '../src/services/cloudsync/payloadSource.ts';
import { SinglePendingRunner } from '../src/services/cloudsync/v2/singlePendingRunner.ts';
import { LocalStorageSyncV2BaselineStore } from '../src/services/cloudsync/v2/baselineStore.ts';
import type { ScannedSyncEntity } from '../src/services/cloudsync/engine.ts';
import type { SyncV2BaselineRecord, SyncV2BaselineStore, SyncV2Catalog, SyncV2ConflictStore, SyncV2LocalAdapter, SyncV2LocalSource, SyncV2Manifest, SyncV2MigrationConflict, SyncV2Profile, SyncV2ProfileState, SyncV2Provider, SyncV2RemoteRead } from '../src/services/cloudsync/v2/types.ts';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const key = (value: { entityType?: string; entityId?: string; kind?: string; id?: string }) => `${value.entityType ?? value.kind}:${value.entityId ?? value.id}`;

class MemoryBaselines implements SyncV2BaselineStore {
  profile: SyncV2ProfileState | null = null;
  workspaces = new Map<string, SyncV2BaselineRecord[]>();
  loadProfile() { return this.profile; }
  saveProfile(value: SyncV2ProfileState) { this.profile = value; }
  loadWorkspace(id: string) { return this.workspaces.get(id) ?? []; }
  saveWorkspace(id: string, records: SyncV2BaselineRecord[]) { this.workspaces.set(id, structuredClone(records)); }
}

class MemoryConflicts implements SyncV2ConflictStore {
  rows = new Map<string, SyncV2MigrationConflict>();
  preserve(value: SyncV2MigrationConflict) {
    if (this.rows.has(value.conflictId)) return Promise.resolve('present' as const);
    this.rows.set(value.conflictId, structuredClone(value));
    return Promise.resolve('created' as const);
  }
  hasUnresolved(profileId: string) {
    return Promise.resolve([...this.rows.values()].some(row => row.profileId === profileId && row.resolvedAt === null));
  }
}

class MemoryProvider implements SyncV2Provider {
  profile: SyncV2Profile | null = null; catalog: SyncV2Catalog | null = null;
  manifests = new Map<string, SyncV2Manifest>(); objects = new Map<string, Uint8Array>();
  uploads = 0; manifestWrites = 0; catalogWrites = 0; failCatalogOnce = false;
  readProfile(): Promise<SyncV2RemoteRead<SyncV2Profile>> { return Promise.resolve({ value: this.profile, etag: this.profile ? 'profile-1' : null }); }
  async writeProfile(value: SyncV2Profile) { this.profile = value; return { etag: 'profile-1' }; }
  readCatalog(): Promise<SyncV2RemoteRead<SyncV2Catalog>> { return Promise.resolve({ value: this.catalog, etag: this.catalog ? `catalog-${this.catalog.revision}` : null }); }
  async writeCatalog(value: SyncV2Catalog) { if (this.failCatalogOnce) { this.failCatalogOnce = false; throw new Error('interrupted'); } this.catalog = structuredClone(value); this.catalogWrites += 1; return { etag: `catalog-${value.revision}` }; }
  readManifest(id: string): Promise<SyncV2RemoteRead<SyncV2Manifest>> { const value = this.manifests.get(id) ?? null; return Promise.resolve({ value, etag: value ? `${id}-${value.revision}` : null }); }
  async writeManifest(id: string, value: SyncV2Manifest) { this.manifests.set(id, structuredClone(value)); this.manifestWrites += 1; return { etag: `${id}-${value.revision}` }; }
  async getObject(hash: string) { const value = this.objects.get(hash); if (!value) throw new Error('missing object'); return value; }
  async putObjectIfAbsent(hash: string, bytes: Uint8Array) { if (this.objects.has(hash)) return 'present' as const; this.objects.set(hash, bytes.slice()); this.uploads += 1; return 'uploaded' as const; }
  async getObjectMetadata(hash: string) { const value = this.objects.get(hash); return value ? { size: value.byteLength } : null; }
}

class Device {
  baselines = new MemoryBaselines(); conflicts = new MemoryConflicts(); entities = new Map<string, ScannedSyncEntity>();
  source: SyncV2LocalSource = { listWorkspaceIds: async () => [...new Set([...this.entities.values()].map(item => item.workspaceId))], scanWorkspace: async id => [...this.entities.values()].filter(item => item.workspaceId === id) };
  adapter: SyncV2LocalAdapter = { applyRecord: async ({ workspaceId, record, bytes }) => { this.entities.set(key(record), { entityType: record.kind, entityId: record.id, workspaceId, parentId: record.parentId, bytes, tombstone: record.tombstone, deletedAt: record.tombstone ? 1 : null }); } };
  add(entityType: ScannedSyncEntity['entityType'], entityId: string, parentId: string | null, value: unknown | Uint8Array, workspaceId = 'ws-A') { this.entities.set(`${entityType}:${entityId}`, { entityType, entityId, workspaceId, parentId, bytes: value instanceof Uint8Array ? value : encode(value), tombstone: false, deletedAt: null }); }
  edit(kind: ScannedSyncEntity['entityType'], id: string, value: unknown) { this.entities.get(`${kind}:${id}`)!.bytes = encode(value); }
  value(kind: ScannedSyncEntity['entityType'], id: string): any { return JSON.parse(new TextDecoder().decode(this.entities.get(`${kind}:${id}`)!.bytes!)); }
  asset(id: string) { return decodeAssetEnvelope(this.entities.get(`asset:${id}`)!.bytes!); }
}

function richDevice() {
  const device = new Device();
  device.add('workspace', 'ws-A', null, { id: 'ws-A' });
  device.add('folder', 'folder-1', 'ws-A', { id: 'folder-1' });
  device.add('notebook', 'nb-1', 'folder-1', { id: 'nb-1' });
  device.add('notebookSection', 'sec-1', 'nb-1', { id: 'sec-1' });
  device.add('notebookPage', 'page-1', 'sec-1', { id: 'page-1', notebookId: 'nb-1', sectionId: 'sec-1', type: 'default' });
  device.add('pageContent', 'page-1', 'page-1', { pageId: 'page-1', data: { text: 'important' } });
  device.add('pageDrawing', 'page-1', 'page-1', { pageId: 'page-1', data: { objects: [{ id: 'image-1', type: 'image', fileId: 'image-page' }], audioNotes: [{ id: 'note-1', fileId: 'audio-page' }] } });
  device.add('notebookPage', 'page-pdf', 'sec-1', { id: 'page-pdf', notebookId: 'nb-1', sectionId: 'sec-1', type: 'pdf', pdfDataId: 'pdf-notebook' });
  device.add('pageDrawing', pdfAnnotationStorageId('page-pdf', 1), 'page-pdf', { pageId: pdfAnnotationStorageId('page-pdf', 1), data: { objects: [{ id: 'ink-1', type: 'stroke' }] } });
  device.add('pageDrawing', pdfAnnotationStorageId('page-pdf', 2), 'page-pdf', { pageId: pdfAnnotationStorageId('page-pdf', 2), data: { objects: [{ id: 'ink-2', type: 'stroke' }] } });
  device.add('canvasFile', 'canvas-1', 'ws-A', { id: 'canvas-1' });
  device.add('canvasScene', 'canvas-1', 'canvas-1', { canvasFileId: 'canvas-1', elements: [{ id: 'shape-1' }], files: { embedded: { dataURL: 'data:image/png;base64,AQID' } }, customBlocks: [{ id: 'block-pdf', type: 'pdf', metadata: { pdfDataId: 'pdf-canvas' } }, { id: 'block-audio', type: 'audio', metadata: { audioFileId: 'audio-canvas' } }] });
  device.add('customBlock', 'block-pdf', 'canvas-1', { id: 'block-pdf', canvasFileId: 'canvas-1', type: 'pdf', metadata: { pdfDataId: 'pdf-canvas' } });
  device.add('customBlock', 'block-audio', 'canvas-1', { id: 'block-audio', canvasFileId: 'canvas-1', type: 'audio', metadata: { audioFileId: 'audio-canvas' } });
  device.add('asset', 'pdf-notebook', 'page-pdf', encodeAssetEnvelope({ id: 'pdf-notebook', ownerId: 'page-pdf', fileName: 'paper.pdf', mimeType: 'application/pdf', assetKind: 'pdf', createdAt: 1, userId: null }, new Uint8Array([37, 80, 68, 70, 1, 2, 3])));
  device.add('asset', 'image-page', 'page-1', encodeAssetEnvelope({ id: 'image-page', ownerId: 'page-1', fileName: 'figure.png', mimeType: 'image/png', assetKind: 'image', createdAt: 2, userId: null }, new Uint8Array([137, 80, 78, 71])));
  device.add('asset', 'audio-page', 'page-1', encodeAssetEnvelope({ id: 'audio-page', ownerId: 'page-1', fileName: 'note.webm', mimeType: 'audio/webm', assetKind: 'audio', createdAt: 3, userId: null }, new Uint8Array([26, 69, 223, 163])));
  device.add('asset', 'pdf-canvas', 'canvas-1', encodeAssetEnvelope({ id: 'pdf-canvas', ownerId: 'canvas-1', fileName: 'canvas.pdf', mimeType: 'application/pdf', assetKind: 'pdf', createdAt: 4, userId: null }, new Uint8Array([37, 80, 68, 70, 9])));
  device.add('asset', 'audio-canvas', 'canvas-1', encodeAssetEnvelope({ id: 'audio-canvas', ownerId: 'canvas-1', fileName: 'canvas.webm', mimeType: 'audio/webm', assetKind: 'audio', createdAt: 5, userId: null }, new Uint8Array([1, 2, 3, 4])));
  return device;
}

const sync = (provider: MemoryProvider, device: Device, account = 'account-A') => runCloudSyncV2({ accountIdentifier: account, provider, source: device.source, adapter: device.adapter, baselines: device.baselines, conflictStore: device.conflicts });

function systemBootstrap(timestamp: number, userId: string) {
  const device = new Device();
  const workspaceId = 'ws-system-default-v1';
  device.add('workspace', workspaceId, null, { id: workspaceId, name: 'My Workspace', createdAt: timestamp, updatedAt: timestamp, isPinned: false, syncStatus: 'local', userId, deletedAt: null, isSystem: true, systemType: 'default' }, workspaceId);
  device.add('canvasFile', 'canvas-system-welcome-v1', workspaceId, { id: 'canvas-system-welcome-v1', workspaceId, folderId: null, name: 'Welcome Canvas', createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: timestamp, order: 0, isPinned: false, syncStatus: 'local', userId, deletedAt: null, isSystem: true, systemType: 'welcome' }, workspaceId);
  device.add('canvasScene', 'canvas-system-welcome-v1', 'canvas-system-welcome-v1', { canvasFileId: 'canvas-system-welcome-v1', elements: [], appState: {}, files: {}, customBlocks: [], version: 1, updatedAt: timestamp, userId }, workspaceId);
  return device;
}

test('fresh system bootstrap reconciles remote metadata, establishes a baseline, and stays idempotent', async () => {
  const provider = new MemoryProvider();
  const remote = systemBootstrap(1, 'remote-device');
  assert.equal((await sync(provider, remote)).status, 'synced');

  const fresh = systemBootstrap(2, 'fresh-device');
  const localWorkspaceIdentity = semanticSystemBootstrapBytes('workspace', 'ws-system-default-v1', fresh.entities.get('workspace:ws-system-default-v1')!.bytes!);
  const remoteWorkspaceIdentity = semanticSystemBootstrapBytes('workspace', 'ws-system-default-v1', remote.entities.get('workspace:ws-system-default-v1')!.bytes!);
  assert.deepEqual(localWorkspaceIdentity, remoteWorkspaceIdentity, 'device-local bootstrap fields do not change semantic identity');

  const first = await sync(provider, fresh);
  assert.equal(first.status, 'synced');
  assert.equal(first.conflicts.length, 0);
  assert.equal(first.downloaded, 3);
  assert.equal(fresh.baselines.loadWorkspace('ws-system-default-v1').length, 3);
  assert.equal(fresh.value('workspace', 'ws-system-default-v1').createdAt, 1, 'canonical remote bootstrap wins');

  const uploads = provider.uploads; const downloads = first.downloaded;
  const second = await sync(provider, fresh);
  assert.equal(second.status, 'synced');
  assert.equal(second.downloaded, 0);
  assert.equal(provider.uploads, uploads);
  assert.equal(downloads, 3);
});

test('edited Welcome Canvas and normal user workspaces keep existing conflict behavior', async () => {
  const provider = new MemoryProvider(); const remote = systemBootstrap(1, 'device-a'); await sync(provider, remote);
  const browser = systemBootstrap(2, 'device-b'); await sync(provider, browser);
  browser.edit('canvasScene', 'canvas-system-welcome-v1', { canvasFileId: 'canvas-system-welcome-v1', elements: [{ id: 'local-edit' }], appState: {}, files: {}, customBlocks: [], version: 1, updatedAt: 3, userId: 'device-b' });
  remote.edit('canvasScene', 'canvas-system-welcome-v1', { canvasFileId: 'canvas-system-welcome-v1', elements: [{ id: 'remote-edit' }], appState: {}, files: {}, customBlocks: [], version: 1, updatedAt: 4, userId: 'device-a' });
  assert.equal((await sync(provider, remote)).status, 'synced');
  const welcomeConflict = await sync(provider, browser);
  assert.equal(welcomeConflict.status, 'conflict');
  assert.ok(welcomeConflict.conflicts.some(item => item.kind === 'canvasScene' && item.id === 'canvas-system-welcome-v1'));

  const userProvider = new MemoryProvider(); const a = new Device(); const b = new Device();
  a.add('workspace', 'ws-user', null, { id: 'ws-user', name: 'A', createdAt: 1, updatedAt: 1 }, 'ws-user');
  b.add('workspace', 'ws-user', null, { id: 'ws-user', name: 'B', createdAt: 2, updatedAt: 2 }, 'ws-user');
  await sync(userProvider, a);
  assert.equal((await sync(userProvider, b)).status, 'synced-review', 'old no-baseline copy is preserved and adopts remote');
  a.edit('workspace', 'ws-user', { id: 'ws-user', name: 'A2', createdAt: 1, updatedAt: 3 });
  b.edit('workspace', 'ws-user', { id: 'ws-user', name: 'B2', createdAt: 2, updatedAt: 4 });
  await sync(userProvider, a);
  const userConflict = await sync(userProvider, b);
  assert.equal(userConflict.status, 'conflict');
  assert.deepEqual(userConflict.conflicts.map(item => `${item.kind}:${item.id}`), ['workspace:ws-user']);
});

test('V2 reconstructs the complete Electron hierarchy and exact binary assets on a fresh browser', async () => {
  const provider = new MemoryProvider(); const electron = richDevice();
  assert.equal((await sync(provider, electron)).status, 'synced');
  const browser = new Device();
  assert.equal((await sync(provider, browser)).status, 'synced');
  assert.deepEqual([...browser.entities.keys()].sort(), [...electron.entities.keys()].sort());
  assert.equal(browser.entities.get('pageDrawing:page-pdf_pdf_1')?.parentId, 'page-pdf');
  assert.equal(browser.entities.get('pageDrawing:page-pdf_pdf_2')?.parentId, 'page-pdf');
  assert.equal(browser.value('notebookPage', 'page-pdf').pdfDataId, 'pdf-notebook');
  assert.equal(browser.value('canvasScene', 'canvas-1').files.embedded.dataURL, 'data:image/png;base64,AQID');
  const asset = browser.asset('pdf-notebook');
  assert.equal(asset?.metadata.mimeType, 'application/pdf');
  assert.deepEqual([...asset!.bytes], [37, 80, 68, 70, 1, 2, 3]);
  assert.equal(browser.asset('image-page')?.metadata.assetKind, 'image');
  assert.equal(browser.asset('audio-page')?.metadata.assetKind, 'audio');
  assert.equal(browser.asset('pdf-canvas')?.metadata.ownerId, 'canvas-1');
  assert.equal(browser.asset('audio-canvas')?.metadata.mimeType, 'audio/webm');
});

test('fresh browser edits round-trip to Electron without changing stable identities', async () => {
  const provider = new MemoryProvider(); const electron = richDevice(); const browser = new Device();
  await sync(provider, electron); await sync(provider, browser);
  browser.edit('pageContent', 'page-1', { pageId: 'page-1', data: { text: 'browser edit' } });
  browser.edit('pageDrawing', 'page-pdf_pdf_2', { pageId: 'page-pdf_pdf_2', data: { objects: [{ id: 'browser-ink', type: 'stroke' }] } });
  await sync(provider, browser); await sync(provider, electron);
  assert.match(new TextDecoder().decode(electron.entities.get('pageContent:page-1')!.bytes!), /browser edit/);
  assert.match(new TextDecoder().decode(electron.entities.get('pageDrawing:page-pdf_pdf_2')!.bytes!), /browser-ink/);
  assert.equal(electron.entities.get('pageDrawing:page-pdf_pdf_2')?.parentId, 'page-pdf');
  assert.equal((await sync(provider, electron)).status, 'synced');
});

test('stale incomplete browser absence cannot delete richer Electron entities', async () => {
  const provider = new MemoryProvider(); const electron = richDevice(); await sync(provider, electron);
  const browser = new Device(); browser.add('workspace', 'ws-A', null, { id: 'ws-A' });
  const result = await sync(provider, browser);
  assert.equal(result.status, 'synced');
  for (const id of electron.entities.keys()) assert.ok(browser.entities.has(id), `${id} survives and downloads`);
  assert.equal(provider.manifests.get('ws-A')!.records.length, electron.entities.size);
});

test('different-entity edits form a union while same-entity edits conflict', async () => {
  const provider = new MemoryProvider(); const a = richDevice(); await sync(provider, a);
  const b = new Device(); await sync(provider, b);
  a.edit('canvasScene', 'canvas-1', { elements: [{ id: 'from-a' }] });
  b.edit('pageContent', 'page-1', { text: 'from-b' });
  assert.equal((await sync(provider, a)).status, 'synced');
  assert.equal((await sync(provider, b)).status, 'synced');
  assert.equal((await sync(provider, a)).status, 'synced');
  assert.match(new TextDecoder().decode(a.entities.get('pageContent:page-1')!.bytes!), /from-b/);
  assert.match(new TextDecoder().decode(b.entities.get('canvasScene:canvas-1')!.bytes!), /from-a/);
  a.edit('pageContent', 'page-1', { text: 'offline-a' }); b.edit('pageContent', 'page-1', { text: 'offline-b' });
  await sync(provider, a);
  const conflict = await sync(provider, b);
  assert.equal(conflict.status, 'conflict');
  assert.match(new TextDecoder().decode(b.entities.get('pageContent:page-1')!.bytes!), /offline-b/);
});

test('only a tombstone with a shared base deletes; mere absence downloads or republishes', async () => {
  const provider = new MemoryProvider(); const a = richDevice(); await sync(provider, a);
  const b = new Device(); await sync(provider, b);
  const page = a.entities.get('notebookPage:page-1')!; page.bytes = null; page.tombstone = true; page.deletedAt = 2;
  assert.equal((await sync(provider, a)).status, 'synced');
  assert.equal((await sync(provider, b)).status, 'synced');
  assert.equal(b.entities.get('notebookPage:page-1')?.tombstone, true);

  b.entities.delete('pageContent:page-1');
  assert.equal((await sync(provider, b)).status, 'synced');
  assert.ok(b.entities.has('pageContent:page-1'), 'local absence is download, not deletion');
  provider.manifests.get('ws-A')!.records = provider.manifests.get('ws-A')!.records.filter(record => !(record.kind === 'canvasScene' && record.id === 'canvas-1'));
  assert.equal((await sync(provider, a)).status, 'synced');
  assert.ok(provider.manifests.get('ws-A')!.records.some(record => record.kind === 'canvasScene' && record.id === 'canvas-1'), 'remote absence is republished, not deletion');
});

test('idle sync is cheap, incomplete objects fail, and interrupted publication retries safely', async () => {
  const provider = new MemoryProvider(); const device = richDevice(); await sync(provider, device);
  const uploads = provider.uploads, writes = provider.manifestWrites, catalogs = provider.catalogWrites;
  assert.equal((await sync(provider, device)).status, 'synced');
  assert.equal(provider.uploads, uploads); assert.equal(provider.manifestWrites, writes); assert.equal(provider.catalogWrites, catalogs);

  const broken = new Device(); provider.objects.delete(provider.manifests.get('ws-A')!.records.find(record => record.kind === 'asset')!.hash!);
  assert.equal((await sync(provider, broken)).status, 'error');
  assert.equal(broken.baselines.loadWorkspace('ws-A').length, 0);

  const retryProvider = new MemoryProvider(); retryProvider.failCatalogOnce = true; const retryDevice = richDevice();
  assert.equal((await sync(retryProvider, retryDevice)).status, 'error');
  assert.equal(retryDevice.baselines.loadWorkspace('ws-A').length, 0, 'baseline never advances before catalog commit');
  assert.equal((await sync(retryProvider, retryDevice)).status, 'synced');
  assert.equal(retryProvider.manifestWrites, 1, 'retry reuses the already-published manifest');
  assert.deepEqual(retryProvider.catalog?.workspaces.map(item => item.workspaceId), ['ws-A'], 'retry repairs the missing catalog publication');
});

test('V2 blocks a different Google account without migration or remote mutation', async () => {
  const provider = new MemoryProvider(); const device = richDevice(); await sync(provider, device, 'account-A');
  const manifests = JSON.stringify([...provider.manifests]); const uploads = provider.uploads;
  const blocked = await sync(provider, device, 'account-B');
  assert.equal(blocked.status, 'blocked');
  assert.equal(JSON.stringify([...provider.manifests]), manifests); assert.equal(provider.uploads, uploads);
});

test('uploaded object hash is exact before manifest publication', async () => {
  const provider = new MemoryProvider(); const device = richDevice(); await sync(provider, device);
  for (const record of provider.manifests.get('ws-A')!.records.filter(record => !record.tombstone)) {
    assert.equal(await sha256Bytes(provider.objects.get(record.hash!)!), record.hash);
  }
});

test('all required objects are verified before a replacement manifest is published', async () => {
  const provider = new MemoryProvider(); const device = richDevice(); await sync(provider, device);
  const writes = provider.manifestWrites;
  const missing = provider.manifests.get('ws-A')!.records.find(record => record.kind === 'asset')!;
  provider.objects.delete(missing.hash!);
  device.edit('pageContent', 'page-1', { pageId: 'page-1', data: { text: 'new local edit' } });
  assert.equal((await sync(provider, device)).status, 'error');
  assert.equal(provider.manifestWrites, writes, 'manifest is not published while any referenced object is missing');
});

test('old no-baseline same-ID data is preserved once, remote becomes canonical, and retry is idempotent', async () => {
  const provider = new MemoryProvider();
  const remote = new Device(); remote.add('workspace', 'ws-old', null, { id: 'ws-old', name: 'remote canonical' }, 'ws-old');
  assert.equal((await sync(provider, remote)).status, 'synced');

  const stale = new Device(); stale.add('workspace', 'ws-old', null, { id: 'ws-old', name: 'preserve me' }, 'ws-old');
  const first = await sync(provider, stale);
  assert.equal(first.status, 'synced-review');
  assert.equal(first.preservedConflicts, 1);
  assert.equal(stale.conflicts.rows.size, 1);
  assert.equal(stale.value('workspace', 'ws-old').name, 'remote canonical');
  assert.equal(stale.baselines.loadWorkspace('ws-old').length, 1);

  const second = await sync(provider, stale);
  assert.equal(second.status, 'synced-review', 'unresolved preserved data remains reviewable');
  assert.equal(second.preservedConflicts, 0);
  assert.equal(second.uploaded, 0); assert.equal(second.downloaded, 0);
  assert.equal(stale.conflicts.rows.size, 1, 'the preservation record is idempotent');
});

test('old browser with full localStorage commits V2 baselines durably and finishes in review', async () => {
  const primary = {
    getItem: (_key: string) => null,
    setItem: (_key: string, _value: string) => { throw new DOMException('Storage quota exceeded.', 'QuotaExceededError'); },
  };
  const durableValues = new Map<string, string>();
  const durable = {
    getItem: async (key: string) => durableValues.get(key) ?? null,
    setItem: async (key: string, value: string) => { durableValues.set(key, value); },
  };
  const baselines = new LocalStorageSyncV2BaselineStore(primary, durable);
  const provider = new MemoryProvider();
  const remote = new Device();
  remote.add('workspace', 'ws-old-browser', null, { id: 'ws-old-browser', name: 'remote canonical' }, 'ws-old-browser');
  remote.add('notebookPage', 'page-old-browser', 'section-old-browser', { id: 'page-old-browser' }, 'ws-old-browser');
  await sync(provider, remote);

  const oldBrowser = new Device();
  oldBrowser.add('workspace', 'ws-old-browser', null, { id: 'ws-old-browser', name: 'preserved local divergence' }, 'ws-old-browser');
  const run = () => runCloudSyncV2({ accountIdentifier: 'account-A', provider, source: oldBrowser.source, adapter: oldBrowser.adapter, baselines, conflictStore: oldBrowser.conflicts });
  const first = await run();
  assert.equal(first.status, 'synced-review');
  assert.equal(first.downloaded, 2, 'remote records still reconstruct');
  assert.equal((await baselines.loadWorkspace('ws-old-browser')).length, 2, 'baseline commits outside full localStorage');
  assert.equal(oldBrowser.conflicts.rows.size, 1, 'local divergence is preserved once');

  const second = await run();
  assert.equal(second.status, 'synced-review');
  assert.equal(second.downloaded, 0);
  assert.equal(second.preservedConflicts, 0);
  assert.equal(oldBrowser.conflicts.rows.size, 1, 'second sync does not recreate the migration record');

  const storeSource = readFileSync(new URL('../src/stores/cloudSyncStore.ts', import.meta.url), 'utf8');
  assert.match(storeSource, /finalStatus === 'synced' \|\| finalStatus === 'synced-review'\) \? Date\.now\(\) : null/);
  assert.match(storeSource, /finalStatus === 'synced-review' \? publicCloudMessage\('review'\)/);
});

test('old no-baseline local-only and remote-only entities converge as a union', async () => {
  const provider = new MemoryProvider();
  const remote = new Device();
  remote.add('workspace', 'ws-union', null, { id: 'ws-union' }, 'ws-union');
  remote.add('folder', 'remote-folder', 'ws-union', { id: 'remote-folder' }, 'ws-union');
  await sync(provider, remote);

  const old = new Device();
  old.add('workspace', 'ws-union', null, { id: 'ws-union' }, 'ws-union');
  old.add('notebook', 'local-notebook', 'ws-union', { id: 'local-notebook' }, 'ws-union');
  const result = await sync(provider, old);
  assert.equal(result.status, 'synced');
  assert.ok(old.entities.has('folder:remote-folder'));
  assert.ok(provider.manifests.get('ws-union')!.records.some(record => record.kind === 'notebook' && record.id === 'local-notebook'));
});

test('remote V2 data without an account profile is ambiguous and cannot be adopted', async () => {
  const provider = new MemoryProvider();
  provider.catalog = { format: 'panvas-sync-v2-catalog', schemaVersion: 2, revision: 1, workspaces: [{ workspaceId: 'ws-private', manifestRevision: 1 }] };
  const device = new Device();
  const result = await sync(provider, device);
  assert.equal(result.status, 'blocked');
  assert.equal(provider.profile, null);
  assert.equal(provider.uploads, 0);
});

test('Auto Sync requests coalesce into one serial pending rerun', async () => {
  const runner = new SinglePendingRunner();
  let runs = 0, active = 0, maxActive = 0, release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = runner.request(async () => {
    runs += 1; active += 1; maxActive = Math.max(maxActive, active);
    if (runs === 1) await gate;
    active -= 1;
  });
  const second = runner.request(async () => { throw new Error('the active callback owns the coalesced rerun'); });
  const third = runner.request(async () => { throw new Error('only one pending rerun is retained'); });
  assert.equal(runner.hasPending, true);
  release();
  await Promise.all([first, second, third]);
  assert.equal(runs, 2);
  assert.equal(maxActive, 1);
  assert.equal(runner.hasPending, false);
});

test('browser V2 reads one Dexie snapshot for all workspaces in a cycle', async () => {
  let reads = 0;
  const snapshot = {
    workspaces: [{ id: 'ws-1' }, { id: 'ws-2' }], folders: [], notebooks: [], sections: [], pages: [], contents: [], drawings: [], canvases: [], scenes: [], blocks: [], pdfs: [], media: [],
  } as unknown as BrowserSyncSnapshot;
  const source = new LocalSyncPayloadSource(async () => { reads += 1; return snapshot; });
  source.beginCycle();
  assert.deepEqual(await source.listWorkspaceIds(), ['ws-1', 'ws-2']);
  await source.scanWorkspace('ws-1'); await source.scanWorkspace('ws-2');
  source.endCycle();
  assert.equal(reads, 1);
});

test('V2 public errors do not expose workspace IDs or provider details', async () => {
  const provider = new MemoryProvider();
  provider.profile = { format: 'panvas-sync-v2-profile', schemaVersion: 2, profileId: 'profile-safe', accountIdentifier: 'account-A' };
  provider.catalog = { format: 'panvas-sync-v2-catalog', schemaVersion: 2, revision: 1, workspaces: [{ workspaceId: 'secret-workspace-id', manifestRevision: 1 }] };
  const result = await sync(provider, new Device());
  assert.equal(result.status, 'error');
  assert.doesNotMatch(result.error ?? '', /secret-workspace-id|catalog-manifest-unavailable|read-manifest/);
  const store = readFileSync(new URL('../src/stores/cloudSyncStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /lastError:\s*v2\.error/);
});

test('virtual PDF identities parse once and V2 routing returns before the V1 state machine', () => {
  assert.deepEqual(parsePdfAnnotationStorageId('page-with_pdf_marker_pdf_12'), { ownerPageId: 'page-with_pdf_marker', sourcePage: 12 });
  assert.equal(parsePdfAnnotationStorageId('page-1_pdf_0'), null);
  const store = readFileSync(new URL('../src/stores/cloudSyncStore.ts', import.meta.url), 'utf8');
  const start = store.indexOf('if (CLOUD_SYNC_V2_ENABLED) {', store.indexOf('triggerSync: async workspaceId =>'));
  const end = store.indexOf('let diagnosticWorkspaceId', start);
  const v2Branch = store.slice(start, end);
  assert.match(v2Branch, /runCloudSyncV2/);
  assert.match(v2Branch, /return;/);
  assert.doesNotMatch(v2Branch, /runSyncCycle|reconcileWorkspaceBindings|loadSyncJournalStore/);
  const localChanges = readFileSync(new URL('../src/services/cloudsync/recordLocalChange.ts', import.meta.url), 'utf8');
  assert.ok(localChanges.indexOf("VITE_PANVAS_SYNC_V2 === 'true'") < localChanges.indexOf('appendJournalEntry({'), 'V2 exits before the V1 journal append');
});
