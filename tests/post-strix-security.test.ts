import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { GoogleAuthService } from '../electron/ipc/google-auth-service.ts';
import { LocalSyncPayloadSource, setCurrentBrowserUserIdReader, type BrowserSyncSnapshot } from '../src/services/cloudsync/payloadSource.ts';

test('OAuth callback validates state before accepting provider errors', async () => {
  const source = await readFile('electron/ipc/google-auth-service.ts', 'utf8');
  const stateCheck = source.indexOf("const incomingState = reqUrl.searchParams.get('state');");
  const errorBranch = source.indexOf("const errorParam = reqUrl.searchParams.get('error');");
  assert.ok(stateCheck >= 0 && errorBranch > stateCheck, 'provider errors must be state-bound');
});

test('Google userinfo requires a non-empty string identity', async () => {
  for (const user of [{ permissionId: '   ' }, { permissionId: 42 }, {}]) {
    const service = new GoogleAuthService({
      fetchFn: async () => new Response(JSON.stringify({ user }), { status: 200 }),
    });
    await assert.rejects(
      service.fetchUserInfo('synthetic-access-token'),
      (error: any) => error?.reason === 'userinfo_identity_missing',
    );
  }

  const service = new GoogleAuthService({
    fetchFn: async () => new Response(JSON.stringify({ user: { permissionId: '  account-a  ' } }), { status: 200 }),
  });
  assert.equal((await service.fetchUserInfo('synthetic-access-token')).id, 'account-a');
});

test('token refresh and disconnect are serialized with disconnect winning persistence', async () => {
  const service = new GoogleAuthService({ clientId: 'synthetic-client', fetchFn: async () => new Response(null, { status: 200 }) });
  let persisted = true;
  let refreshStarted!: () => void;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>(resolve => { releaseRefresh = resolve; });
  const started = new Promise<void>(resolve => { refreshStarted = resolve; });
  const stored = () => ({ accessToken: 'old', refreshToken: 'refresh', expiresAt: 0, accountIdentifier: 'account-a', connectedAt: 1 });

  (service as any).readStoredTokens = async () => stored();
  (service as any).refreshAccessToken = async () => {
    refreshStarted();
    await refreshGate;
    return { access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600 };
  };
  (service as any).saveTokens = async () => { persisted = true; };
  (service as any).deleteTokens = async () => { persisted = false; };

  const refresh = service.getValidAccessToken();
  await started;
  const disconnect = service.disconnect();
  let disconnectFinished = false;
  void disconnect.then(() => { disconnectFinished = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(disconnectFinished, false, 'disconnect must wait for an in-flight refresh');
  releaseRefresh();
  await Promise.all([refresh, disconnect]);
  assert.equal(persisted, false, 'disconnect must not be undone by the older refresh');
});

test('account-scoped default IDs never reassign the fixed IDs across users', async () => {
  const schema = await readFile('src/database/schema.ts', 'utf8');
  assert.match(schema, /generateId\('ws'\)/);
  assert.match(schema, /generateId\('canvas'\)/);
  assert.doesNotMatch(schema, /db\.workspaces\.update\(defaultWorkspaceId/);
  assert.doesNotMatch(schema, /db\.canvasFiles\.update\(defaultCanvasId/);
});

test('browser Cloud Sync discovery and scan exclude another account', async () => {
  setCurrentBrowserUserIdReader(() => 'account-b');
  try {
    const snapshot = {
      workspaces: [
        { id: 'ws-a', userId: 'account-a', deletedAt: null },
        { id: 'ws-b', userId: 'account-b', deletedAt: null },
      ],
      folders: [], notebooks: [], sections: [], pages: [], contents: [], drawings: [],
      canvases: [{ id: 'canvas-a', workspaceId: 'ws-a', userId: 'account-a', deletedAt: null }],
      scenes: [{ canvasFileId: 'canvas-a', userId: 'account-a' }],
      blocks: [{ id: 'block-a', canvasFileId: 'canvas-a', userId: 'account-a' }],
      pdfs: [{ id: 'pdf-a', canvasFileId: 'canvas-a', userId: 'account-a', data: new ArrayBuffer(0) }],
      media: [],
    } as unknown as BrowserSyncSnapshot;
    const source = new LocalSyncPayloadSource(async () => snapshot);
    source.beginCycle();
    assert.deepEqual(await source.listWorkspaceIds(), ['ws-b']);
    assert.deepEqual(await source.scanWorkspace('ws-a'), []);
    assert.deepEqual((await source.scanWorkspace('ws-b')).map(item => item.entityId), ['ws-b']);
    source.endCycle();
  } finally {
    setCurrentBrowserUserIdReader(() => null);
  }
});

test('filesystem import and export validate every identifier used in a path', async () => {
  const workspaceService = await readFile('electron/ipc/WorkspaceService.ts', 'utf8');
  const migrationImporter = await readFile('electron/ipc/migration-import.ts', 'utf8');
  assert.match(workspaceService, /SAFE_SYNC_FILE_ID\.test\(String\(canvas\.id\)\)/);
  assert.match(workspaceService, /SAFE_SYNC_FILE_ID\.test\(String\(id\)\)/);
  assert.match(workspaceService, /SAFE_SYNC_FILE_ID\.test\(String\(page\.notebookId\)\)/);
  assert.match(migrationImporter, /SAFE_ID\.test\(String\(canvas\.canvasFileId\)\)/);
  assert.match(migrationImporter, /SAFE_ID\.test\(String\(asset\.id\)\)/);
});

test('cached browser payloads cannot cross users or workspace IDs', async () => {
  let userId = 'account-a';
  setCurrentBrowserUserIdReader(() => userId);
  try {
    const snapshot = { workspaces: [{ id: 'ws-a', userId: 'account-a' }], folders: [], notebooks: [], sections: [], pages: [], contents: [], drawings: [], canvases: [], scenes: [], blocks: [], pdfs: [], media: [] } as unknown as BrowserSyncSnapshot;
    const source = new LocalSyncPayloadSource(async () => snapshot);
    await source.scanWorkspace('ws-a');
    const entry = { entityType: 'workspace', entityId: 'ws-a', workspaceId: 'ws-a' } as any;
    assert.ok(await source.loadPayload(entry));
    assert.equal(await source.loadPayload({ ...entry, workspaceId: 'ws-other' }), null);
    userId = 'account-b';
    assert.equal(await source.loadPayload(entry), null);
    assert.equal(await source.parentOf(entry), null);
    assert.deepEqual(await source.scanWorkspace('ws-a'), []);
  } finally { setCurrentBrowserUserIdReader(() => null); }
});
