import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

// Isolated real IndexedDB + production scanner/adapter/baseline/archive stores.
// Only the external Drive provider is replaced; no real account is contacted.
test('returning-device browser storage end-to-end', { timeout: 120_000 }, async t => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const server = await createServer({ root, configFile: false, envFile: false, appType: 'custom',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'isolated-sync-fixture', configureServer(s) {
      s.middlewares.use((req, res, next) => {
        if (req.url !== '/') return next();
        res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Sync test</title>');
      });
    } }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    for (const scenario of ['recover', 'simultaneous-edit', 'edit-during-download', 'apply-failure']) {
      await t.test(scenario, async () => {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await page.goto(server.resolvedUrls.local[0]);
          const result = await page.evaluate(async scenario => {
            const { db } = await import('/src/database/schema.ts');
            const { runCloudSyncV2 } = await import('/src/services/cloudsync/v2/engine.ts');
            const { syncV2LocalSource: source, syncV2LocalAdapter: adapter } = await import('/src/services/cloudsync/v2/localAdapter.ts');
            const { LocalStorageSyncV2BaselineStore } = await import('/src/services/cloudsync/v2/baselineStore.ts');
            const { dexieSyncV2ConflictStore: conflictStore } = await import('/src/services/cloudsync/v2/conflictStore.ts');
            const { setCurrentBrowserUserIdReader } = await import('/src/services/cloudsync/payloadSource.ts');
            const { sha256Bytes } = await import('/src/services/cloudsync/hash.ts');
            const { encodeAssetEnvelope } = await import('/src/services/cloudsync/assetEnvelope.ts');
            const { default: Dexie } = await import('/node_modules/dexie/dist/dexie.mjs');
            const check = (ok, message) => { if (!ok) throw new Error(message); };
            const encode = value => new TextEncoder().encode(JSON.stringify(value));
            const baselines = new LocalStorageSyncV2BaselineStore();
            // The recovery scenario mirrors a browser that has Google Drive
            // OAuth but no optional Panvas/Supabase app session. Its local
            // rows can still contain a stale ownership stamp from an older
            // browser session, so recovery must rely on the verified Drive
            // namespace rather than requiring an app user ID.
            setCurrentBrowserUserIdReader(() => scenario === 'recover' ? null : 'fixture-browser-owner');
            const manifests = new Map(), objects = new Map();
            const profile = { format: 'panvas-sync-v2-profile', schemaVersion: 2, profileId: 'fixture-profile', accountIdentifier: 'fixture-account' };
            let catalog = { format: 'panvas-sync-v2-catalog', schemaVersion: 2, revision: 1, workspaces: [] };
            let writes = 0;
            const provider = {
              readProfile: async () => ({ value: profile, etag: 'profile' }),
              writeProfile: async () => { throw new Error('must not replace verified account'); },
              readCatalog: async () => ({ value: catalog, etag: String(catalog.revision) }),
              writeCatalog: async value => { catalog = value; writes++; return { etag: String(value.revision) }; },
              readManifest: async id => ({ value: manifests.get(id), etag: String(manifests.get(id)?.revision) }),
              writeManifest: async (id, value) => { manifests.set(id, value); writes++; return { etag: String(value.revision) }; },
              getObject: async hash => { check(objects.has(hash), 'object missing'); return objects.get(hash).slice(); },
              getObjectMetadata: async hash => objects.has(hash) ? { size: objects.get(hash).length } : null,
              putObjectIfAbsent: async (hash, bytes) => { if (objects.has(hash)) return 'present'; objects.set(hash, bytes.slice()); writes++; return 'uploaded'; },
            };
            const record = async (kind, id, parentId, value, baseHash = null) => {
              const bytes = value instanceof Uint8Array ? value : encode(value);
              const hash = await sha256Bytes(bytes); objects.set(hash, bytes);
              return { kind, id, parentId, hash, baseHash, tombstone: false, ...(kind === 'asset' ? { encoding: 'asset-envelope-v1' } : {}) };
            };
            for (let i = 1; i <= 14; i++) {
              const ws = `ws-${String(i).padStart(2, '0')}`, nb = `nb-${i}`, sec = `sec-${i}`, pg = `page-${i}`;
              const rows = [
                await record('workspace', ws, null, { id: ws, name: ws, updatedAt: 1 }),
                await record('folder', `folder-${i}`, ws, { id: `folder-${i}`, workspaceId: ws, name: 'Folder', updatedAt: 1 }),
                await record('notebook', nb, `folder-${i}`, { id: nb, workspaceId: ws, folderId: `folder-${i}`, name: 'Notebook', updatedAt: 1 }),
                await record('notebookSection', sec, nb, { id: sec, notebookId: nb, name: 'Section', updatedAt: 1 }),
                await record('notebookPage', pg, sec, { id: pg, notebookId: nb, sectionId: sec, name: 'Page', updatedAt: 1 }),
                await record('pageContent', pg, pg, { pageId: pg, notebookId: nb, workspaceId: ws, data: { text: 'old text' }, version: 1 }),
                await record('pageDrawing', pg, pg, { pageId: pg, notebookId: nb, workspaceId: ws, data: { objects: [] }, version: 1 }),
              ];
              for (const r of rows) await adapter.applyRecord({ workspaceId: ws, record: r, bytes: objects.get(r.hash) });
              // Exactly the returning-device case: records exist, but only the
              // root baseline committed during the previous incomplete sync.
              await baselines.saveWorkspace(ws, [{ entityKind: 'workspace', entityId: ws, baseHash: rows[0].hash, localHash: rows[0].hash, remoteHash: rows[0].hash, remoteRevision: 1, tombstone: false }]);
              await db.notebooks.update(nb, { isExpanded: true, lastOpenedAt: 100, updatedAt: 100 });
              rows[5] = await record('pageContent', pg, pg, { pageId: pg, notebookId: nb, workspaceId: ws, data: { text: `desktop text ${i}` }, version: 2 }, rows[5].hash);
              rows[6] = await record('pageDrawing', pg, pg, { pageId: pg, notebookId: nb, workspaceId: ws, data: { objects: [{ id: `ink-${i}`, type: 'stroke' }] }, version: 2 }, rows[6].hash);
              rows.push(await record('notebookPage', `pdfpage-${i}`, sec, { id: `pdfpage-${i}`, notebookId: nb, sectionId: sec, type: 'pdf', pdfDataId: `pdf-${i}` }));
              rows.push(await record('pageDrawing', `pdfpage-${i}_pdf_1`, `pdfpage-${i}`, { pageId: `pdfpage-${i}_pdf_1`, notebookId: nb, workspaceId: ws, data: { objects: [{ id: 'annotation' }] }, version: 1 }));
              rows.push(await record('canvasFile', `canvas-${i}`, ws, { id: `canvas-${i}`, workspaceId: ws, name: 'Desktop canvas' }));
              rows.push(await record('canvasScene', `canvas-${i}`, `canvas-${i}`, { canvasFileId: `canvas-${i}`, elements: [{ id: 'shape' }], files: {}, version: 1 }));
              rows.push(await record('customBlock', `block-${i}`, `canvas-${i}`, { id: `block-${i}`, canvasFileId: `canvas-${i}`, type: 'text', content: 'Desktop block' }));
              for (const [kind, mime] of [['pdf', 'application/pdf'], ['image', 'image/png'], ['audio', 'audio/webm']]) {
                const id = `${kind}-${i}`;
                rows.push(await record('asset', id, `pdfpage-${i}`, encodeAssetEnvelope({ id, ownerId: `pdfpage-${i}`, fileName: id, mimeType: mime, assetKind: kind, createdAt: 1, userId: null }, new Uint8Array([i, 2, 3, 4]))));
              }
              // One returning workspace also exercises a stale non-null auth
              // stamp. Its remote root changed after the old browser baseline;
              // recovery must use the verified cloud copy and re-stamp it.
              if (scenario === 'recover' && i === 3) {
                rows[0] = await record('workspace', ws, null, { id: ws, name: `${ws} from desktop`, updatedAt: 2 }, rows[0].hash);
              }
              // The apply-failure case must remain a genuine two-sided edit,
              // not merely an owner mismatch. Give the asset an old baseline,
              // then publish a different remote head and inject a local edit.
              if (scenario === 'apply-failure' && i === 2) {
                const assetIndex = rows.findIndex(item => item.kind === 'asset' && item.id === 'audio-2');
                const oldAsset = rows[assetIndex];
                rows[assetIndex] = await record('asset', 'audio-2', `page-${i}`, encodeAssetEnvelope({ id: 'audio-2', ownerId: `page-${i}`, fileName: 'audio-2', mimeType: 'audio/webm', assetKind: 'audio', createdAt: 1, userId: null }, new Uint8Array([7, 8, 9, 10])), oldAsset.hash);
                await baselines.saveWorkspace(ws, [
                  { entityKind: 'workspace', entityId: ws, baseHash: rows[0].hash, localHash: rows[0].hash, remoteHash: rows[0].hash, remoteRevision: 1, tombstone: false },
                  { entityKind: 'asset', entityId: 'audio-2', baseHash: oldAsset.hash, localHash: oldAsset.hash, remoteHash: oldAsset.hash, remoteRevision: 1, tombstone: false },
                ]);
              }
              manifests.set(ws, { format: 'panvas-sync-v2-manifest', schemaVersion: 2, workspaceId: ws, revision: 2, records: rows });
              catalog.workspaces.push({ workspaceId: ws, manifestRevision: 2 });
            }
            // Simulate the real returning-browser failure: these rows were
            // created before (or outside) Panvas authentication and carry
            // local ownership stamps that are not a reliable Drive identity.
            await db.transaction('rw', db.tables, async () => {
              for (const table of [db.workspaces, db.folders, db.notebooks, db.notebookSections, db.notebookPages, db.notebookPageContents, db.notebookPageDrawings, db.canvasFiles, db.canvasData, db.customBlocks, db.pdfFiles, db.imageFiles]) {
                for (const row of await table.toArray()) { row.userId = null; await table.put(row); }
              }
            });
            if (scenario === 'recover') await db.workspaces.update('ws-03', { userId: 'legacy-owner' });
            await baselines.saveProfile({ profileId: profile.profileId, accountIdentifier: profile.accountIdentifier });
            if (scenario === 'simultaneous-edit') await db.notebookPageContents.update('page-2', { data: { text: 'unsynced local work' } });
            let injected = false;
            const guarded = scenario === 'edit-during-download' ? { ...adapter, async applyWorkspace(input) {
              if (!injected && input.workspaceId === 'ws-02') { injected = true; await db.notebookPageContents.update('page-2', { data: { text: 'typed during sync' } }); }
              return adapter.applyWorkspace(input);
            } } : adapter;
            if (scenario === 'apply-failure') {
              // Existing asset owned by another local user must never be taken
              // over. The preceding page updates in this workspace must roll back.
              check((await baselines.loadWorkspace('ws-02')).length === 2, 'asset baseline missing');
              await db.imageFiles.put({ id: 'audio-2', canvasFileId: 'page-2', userId: 'other-owner', data: new Uint8Array([99]).buffer, fileName: 'private', mimeType: 'audio/webm', createdAt: 1 });
              const debugScan = await source.scanWorkspaceIncludingUnowned('ws-02');
              const debugAsset = debugScan.find(item => item.entityType === 'asset' && item.entityId === 'audio-2');
              check(Boolean(debugAsset?.ownership === 'foreign-recovery'), `asset ownership ${debugAsset?.ownership}`);
              check(Boolean(debugAsset?.bytes), 'asset bytes missing');
            }
            const progress = [];
            const run = () => runCloudSyncV2({ accountIdentifier: profile.accountIdentifier, provider, source, adapter: guarded, baselines, conflictStore, onProgress: value => progress.push(value) });
            const first = await run();
            if (scenario !== 'recover') {
              check(first.errorCode === 'conflict', JSON.stringify(first));
              check(first.diagnostic.workspaceId === 'ws-02', 'diagnostic workspace');
              check(first.diagnostic.entityId === (scenario === 'apply-failure' ? 'audio-2' : 'page-2'), 'diagnostic entity');
              check(!JSON.stringify(first.diagnostic).match(/fixture-account|fixture-browser-owner|old text|unsynced local work/), 'diagnostic leaked account/content');
              const expected = scenario === 'simultaneous-edit' ? 'unsynced local work' : scenario === 'edit-during-download' ? 'typed during sync' : 'old text';
              check((await db.notebookPageContents.get('page-2')).data.text === expected, 'local work overwritten / transaction did not roll back');
              if (scenario === 'apply-failure') check(!await db.notebookPages.get('pdfpage-2'), 'failed workspace retained partial hierarchy');
              check(writes === 0, 'conflict mutated Drive');
              check((await baselines.loadWorkspace('ws-01')).length === manifests.get('ws-01').records.length, 'later failure lost successful workspace baseline');
              return { scenario, status: first.status, diagnostic: first.diagnostic };
            }
            check(first.status === 'synced', JSON.stringify(first));
            check(progress.some(value => value.includes('14 of 14')), 'did not visit all 14');
            for (let i = 1; i <= 14; i++) {
              check((await db.notebookPageContents.get(`page-${i}`)).data.text === `desktop text ${i}`, 'missing page content');
              check((await db.notebookPageDrawings.get(`page-${i}`)).data.objects[0].id === `ink-${i}`, 'missing drawing');
              check((await db.notebookPageDrawings.get(`pdfpage-${i}_pdf_1`)).data.objects[0].id === 'annotation', 'missing PDF annotation');
              check((await db.canvasData.get(`canvas-${i}`)).elements[0].id === 'shape', 'missing canvas scene');
              check((await db.customBlocks.get(`block-${i}`)).content === 'Desktop block', 'missing custom block');
              for (const kind of ['pdf', 'image', 'audio']) {
                const row = await (kind === 'pdf' ? db.pdfFiles : db.imageFiles).get(`${kind}-${i}`);
                check(new Uint8Array(row.data).join(',') === `${i},2,3,4`, 'asset bytes missing');
              }
              const ws = `ws-${String(i).padStart(2, '0')}`;
              check((await baselines.loadWorkspace(ws)).length === manifests.get(ws).records.length, 'incomplete rebuilt baseline');
            }
            check((await db.workspaces.get('ws-03')).name === 'ws-03 from desktop', 'stale owner root was not recovered');
            const archive = new Dexie('panvas-sync-v2'); await archive.open();
            const saved = await archive.table('conflicts').toArray(); archive.close();
            check(saved.length === 29 && saved.every(row => row.localBytes.byteLength > 0 && row.resolvedAt !== null), 'missing local recovery archive');
            const second = await run();
            check(second.status === 'synced' && second.uploaded === 0 && second.downloaded === 0, JSON.stringify(second));
            check(writes === 0, 'clean returning browser must not rewrite Drive');
            return { scenario, status: first.status, workspaces: 14, archives: saved.length, retry: second.status };
          }, scenario);
          assert.equal(result.scenario, scenario);
          if (scenario === 'recover') assert.equal(result.status, 'synced');
        } finally { await context.close(); }
      });
    }
  } finally { await browser?.close(); await server.close(); }
});

// Regression for the production local-record-apply crash class. Historical
// V2 objects can contain direct page payloads, `id`-only canvas scenes, and
// `canvasId` custom blocks. The same batch must remain atomic when a later
// record is malformed.
test('historical local-record-apply normalizes known legacy records atomically', { timeout: 60_000 }, async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const server = await createServer({ root, configFile: false, envFile: false, appType: 'custom',
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [{ name: 'legacy-apply-fixture', configureServer(s) {
      s.middlewares.use((req, res, next) => { if (req.url !== '/') return next(); res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Sync test</title>'); });
    } }],
  });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(server.resolvedUrls.local[0]);
      const result = await page.evaluate(async () => {
        const { db } = await import('/src/database/schema.ts');
        const { setCurrentBrowserUserIdReader, LocalSyncPayloadSource } = await import('/src/services/cloudsync/payloadSource.ts');
        const { syncV2LocalAdapter } = await import('/src/services/cloudsync/v2/localAdapter.ts');
        const { CloudOperationError } = await import('/src/services/cloudsync/errors.ts');
        setCurrentBrowserUserIdReader(() => null);
        const ws = 'ws-legacy-regression', nb = 'nb-legacy-regression', sec = 'sec-legacy-regression', pageId = 'page-legacy-regression', canvas = 'canvas-legacy-regression';
        await db.transaction('rw', db.tables, async () => {
          await db.workspaces.put({ id: ws, name: 'Legacy', userId: null, syncStatus: 'synced', deletedAt: null });
          await db.notebooks.put({ id: nb, workspaceId: ws, folderId: null, name: 'Notebook', userId: null, deletedAt: null });
          await db.notebookSections.put({ id: sec, notebookId: nb, name: 'Section', userId: null, deletedAt: null });
          await db.notebookPages.put({ id: pageId, notebookId: nb, sectionId: sec, title: 'Page', userId: null, deletedAt: null });
          await db.canvasFiles.put({ id: canvas, workspaceId: ws, folderId: null, name: 'Canvas', userId: null, deletedAt: null });
          await db.canvasData.put({ canvasFileId: canvas, elements: [], appState: {}, files: {}, customBlocks: [], version: 1, userId: null });
        });
        const source = new LocalSyncPayloadSource();
        source.beginCycle();
        const expected = await source.scanWorkspaceIncludingUnowned(ws);
        const bytes = value => new TextEncoder().encode(JSON.stringify(value));
        const pointer = (kind, id, parentId) => ({ kind, id, parentId, hash: 'a'.repeat(64), baseHash: null, tombstone: false });
        await syncV2LocalAdapter.applyWorkspace({ workspaceId: ws, expected, downloads: [
          { record: pointer('pageContent', pageId, pageId), bytes: bytes({ text: 'legacy direct page content' }) },
          { record: pointer('canvasScene', canvas, canvas), bytes: bytes({ id: canvas, elements: [{ id: 'legacy-shape' }], files: {}, appState: {}, version: 1 }) },
          { record: pointer('customBlock', 'block-legacy-regression', canvas), bytes: bytes({ blockId: 'block-legacy-regression', canvasId: canvas, type: 'markdown', content: 'legacy block' }) },
        ] });
        const content = await db.notebookPageContents.get(pageId);
        const scene = await db.canvasData.get(canvas);
        const block = await db.customBlocks.get('block-legacy-regression');
        const expectedAfter = await new LocalSyncPayloadSource().scanWorkspaceIncludingUnowned(ws);
        let rollbackDiagnostic = null;
        try {
          await syncV2LocalAdapter.applyWorkspace({ workspaceId: ws, expected: expectedAfter, downloads: [
            { record: pointer('pageContent', pageId, pageId), bytes: bytes({ text: 'must roll back' }) },
            { record: pointer('pageDrawing', pageId, pageId), bytes: bytes({ pageId: 'wrong-page', data: { objects: [] } }) },
          ] });
        } catch (error) {
          if (!(error instanceof CloudOperationError)) throw error;
          rollbackDiagnostic = error.diagnostic;
        }
        const afterRollback = await db.notebookPageContents.get(pageId);
        return {
          content: content?.data?.text,
          scene: scene?.elements?.[0]?.id,
          block: block?.canvasFileId,
          rollback: afterRollback?.data?.text,
          diagnostic: rollbackDiagnostic,
        };
      });
      assert.deepEqual(result, {
        content: 'legacy direct page content',
        scene: 'legacy-shape',
        block: 'canvas-legacy-regression',
        rollback: 'legacy direct page content',
        diagnostic: {
          provider: 'googledrive', stage: 'browser-record-apply', status: undefined, reason: 'payload-identity-mismatch',
          workspaceId: 'ws-legacy-regression', entityKind: 'pageDrawing', entityId: 'page-legacy-regression',
          parentId: 'page-legacy-regression', schemaVersion: '2', operation: 'apply', errorMessage: 'payload-identity-mismatch', throwingFunction: 'applyBrowserRecord', retryable: false,
        },
      });
    } finally { await context.close(); }
  } finally { await browser?.close(); await server.close(); }
});
