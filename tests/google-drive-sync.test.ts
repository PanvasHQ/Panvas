import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { generateCodeChallenge, generateRandomString } from '../src/services/cloudsync/pkce.ts';
import { GoogleDriveSyncProvider, AuthExpiredError, GoogleDriveApiError } from '../src/services/cloudsync/googleDriveProvider.ts';
import { GoogleAuthDiagnosticError, GoogleAuthService } from '../electron/ipc/google-auth-service.ts';
import { ProviderConflictError, runSyncCycle, type SyncJournalStore, type SyncPayloadSource, type DeviceManifestState } from '../src/services/cloudsync/engine.ts';
import type { ObjectUpload, RecordPointer, SyncJournalEntry, SyncManifestV1 } from '../src/services/cloudsync/types.ts';
import { applyRemoteChanges } from '../src/services/cloudsync/applyRemoteChanges.ts';
import { migrateWorkspaceToGoogleAccount } from '../src/services/cloudsync/accountMigration.ts';
import { buildManifestV1, validateRemoteManifest } from '../src/services/cloudsync/manifest.ts';
import { db } from '../src/database/schema.ts';

// ---- In-Memory Fake Google Drive API v3 Transport ----

interface FakeDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  content?: Uint8Array;
  size?: number;
  md5Checksum?: string;
  version?: string;
  modifiedTime?: string;
  trashed?: boolean;
}

function createFakeDriveTransport() {
  const files = new Map<string, FakeDriveFile>();
  let nextId = 1;
  let simulatedAuthExpired = false;
  let simulatedCustomResponse: { status: number; body: string } | null = null;

  const fakeFetch: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const url = new URL(urlStr);
    const method = init?.method?.toUpperCase() || 'GET';
    const authHeader = new Headers(init?.headers).get('Authorization');
    const isResumableChunkPut = url.pathname.includes('/files') && url.searchParams.get('uploadType') === 'resumable' && method === 'PUT';

    if (simulatedCustomResponse) {
      return new Response(simulatedCustomResponse.body, {
        status: simulatedCustomResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isResumableChunkPut && (simulatedAuthExpired || !authHeader || authHeader === 'Bearer invalid')) {
      return new Response(JSON.stringify({ error: { code: 401, message: 'Invalid Credentials', errors: [{ reason: 'authError' }] } }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /files?q=...
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const matchedFiles: FakeDriveFile[] = [];

      for (const file of files.values()) {
        if (file.trashed) continue;
        let match = true;

        const nameMatch = /name\s*=\s*'([^']+)'/.exec(q);
        if (nameMatch && file.name !== nameMatch[1]) match = false;

        const parentMatch = /'([^']+)'\s*in\s*parents/.exec(q);
        if (parentMatch) {
          const expectedParent = parentMatch[1];
          if (expectedParent === 'root') {
            if (file.parents.length > 0 && !file.parents.includes('root')) match = false;
          } else {
            if (!file.parents.includes(expectedParent)) match = false;
          }
        }

        const mimeMatch = /mimeType\s*=\s*'([^']+)'/.exec(q);
        if (mimeMatch && file.mimeType !== mimeMatch[1]) match = false;

        if (match) matchedFiles.push(file);
      }

      return new Response(JSON.stringify({ files: matchedFiles }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /files (Create folder or metadata)
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const id = `fake-file-${nextId++}`;
      const newFile: FakeDriveFile = {
        id,
        name: body.name,
        mimeType: body.mimeType || 'application/octet-stream',
        parents: body.parents || [],
        size: 0,
        version: '1',
        modifiedTime: new Date().toISOString(),
      };
      files.set(id, newFile);
      return new Response(JSON.stringify(newFile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /upload/drive/v3/files?uploadType=multipart
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'multipart' && method === 'POST') {
      const rawBody = init?.body as Uint8Array;
      const bodyStr = new TextDecoder().decode(rawBody);

      const boundaryLine = bodyStr.split('\r\n')[0];
      const parts = bodyStr.split(boundaryLine).filter(p => p.trim() && p.trim() !== '--');

      const metadataPart = parts[0] || '';
      const contentPart = parts[1] || '';

      const jsonStart = metadataPart.indexOf('{');
      const jsonEnd = metadataPart.lastIndexOf('}') + 1;
      const metadata = JSON.parse(metadataPart.substring(jsonStart, jsonEnd));

      const contentHeaderEnd = contentPart.indexOf('\r\n\r\n');
      const actualContentStr = contentHeaderEnd >= 0 ? contentPart.substring(contentHeaderEnd + 4).replace(/\r\n$/, '') : contentPart;
      const contentBytes = new TextEncoder().encode(actualContentStr);

      const id = `fake-file-${nextId++}`;
      const newFile: FakeDriveFile = {
        id,
        name: metadata.name,
        mimeType: metadata.mimeType || 'application/octet-stream',
        parents: metadata.parents || [],
        content: contentBytes,
        size: contentBytes.byteLength,
        md5Checksum: `hash-${id}`,
        version: '1',
        modifiedTime: new Date().toISOString(),
      };
      files.set(id, newFile);
      return new Response(JSON.stringify(newFile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // POST /upload/drive/v3/files?uploadType=resumable (Initiate resumable session)
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'resumable' && method === 'POST') {
      const body = JSON.parse((init?.body as string) || '{}');
      const id = `fake-file-${nextId++}`;
      const sessionUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${id}`;

      files.set(id, {
        id,
        name: body.name,
        mimeType: 'application/octet-stream',
        parents: body.parents || [],
        size: 0,
      });

      return new Response(null, {
        status: 200,
        headers: { Location: sessionUrl },
      });
    }

    // PUT /upload/drive/v3/files?uploadType=resumable&upload_id=... (Upload chunks)
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'resumable' && method === 'PUT') {
      const id = url.searchParams.get('upload_id')!;
      const file = files.get(id);
      if (!file) return new Response('Not Found', { status: 404 });

      const content = init?.body as Uint8Array;
      file.content = content;
      file.size = content.byteLength;
      file.md5Checksum = `hash-${id}`;
      file.version = '1';
      file.modifiedTime = new Date().toISOString();

      return new Response(JSON.stringify(file), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PATCH /upload/drive/v3/files/:id?uploadType=media (Update content)
    if (url.pathname.startsWith('/upload/drive/v3/files/') && method === 'PATCH') {
      const id = url.pathname.split('/').pop()!;
      const file = files.get(id);
      if (!file) return new Response('Not Found', { status: 404 });

      const contentStr = init?.body as string;
      file.content = new TextEncoder().encode(contentStr);
      file.version = String(Number(file.version || '1') + 1);
      file.md5Checksum = `hash-v${file.version}-${id}`;
      file.modifiedTime = new Date().toISOString();

      return new Response(JSON.stringify(file), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /files/:id?alt=media (Download content)
    if (url.pathname.startsWith('/drive/v3/files/') && method === 'GET' && url.searchParams.get('alt') === 'media') {
      const id = url.pathname.split('/').pop()!;
      const file = files.get(id);
      if (!file || !file.content) return new Response('Not Found', { status: 404 });

      return new Response(file.content as any, {
        status: 200,
        headers: { 'Content-Type': file.mimeType },
      });
    }

    // GET /files/:id?fields=... (Metadata)
    if (url.pathname.startsWith('/drive/v3/files/') && method === 'GET') {
      const id = url.pathname.split('/').pop()!;
      const file = files.get(id);
      if (!file) return new Response('Not Found', { status: 404 });
      return new Response(JSON.stringify(file), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // DELETE /files/:id
    if (url.pathname.startsWith('/drive/v3/files/') && method === 'DELETE') {
      const id = url.pathname.split('/').pop()!;
      files.delete(id);
      return new Response(null, { status: 204 });
    }

    // PATCH /files/:id (Rename)
    if (url.pathname.startsWith('/drive/v3/files/') && method === 'PATCH') {
      const id = url.pathname.split('/').pop()!;
      const file = files.get(id);
      if (!file) return new Response('Not Found', { status: 404 });

      const body = JSON.parse((init?.body as string) || '{}');
      if (body.name) file.name = body.name;

      return new Response(JSON.stringify(file), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  };

  return {
    fetchFn: fakeFetch,
    files,
    setAuthExpired: (val: boolean) => {
      simulatedAuthExpired = val;
    },
    setCustomResponse: (resp: { status: number; body: string } | null) => {
      simulatedCustomResponse = resp;
    },
  };
}

// ---- Unit Tests ----

test('Google OAuth PKCE verifier and challenge generation conforms to S256', () => {
  const verifier1 = generateRandomString(48);
  const challenge1 = generateCodeChallenge(verifier1);
  assert.equal(typeof verifier1, 'string');
  assert.ok(verifier1.length >= 43 && verifier1.length <= 128);
  assert.equal(typeof challenge1, 'string');
  assert.equal(challenge1.length, 43); // Base64URL-encoded SHA-256 is always 43 chars

  // Known test vector for SHA-256 S256 PKCE (RFC 7636)
  const testVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  assert.equal(generateCodeChallenge(testVerifier), expectedChallenge);
});

test('GoogleAuthService includes client_secret in token exchange when configured', async () => {
  let capturedBody = '';
  const fakeFetch: typeof fetch = async (_url, init) => {
    capturedBody = init?.body as string;
    return new Response(
      JSON.stringify({
        access_token: 'fake-access-token-123',
        refresh_token: 'fake-refresh-token-456',
        expires_in: 3600,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const authService = new GoogleAuthService({ fetchFn: fakeFetch });

  const result = await authService.exchangeCodeForTokens({
    clientId: 'test-client-id.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-test-secret-value-789',
    code: 'test-auth-code-abc',
    codeVerifier: 'test-verifier-xyz-123456789012345678901234567890',
    redirectUri: 'http://127.0.0.1:54321/oauth2callback',
  });

  assert.equal(result.access_token, 'fake-access-token-123');
  assert.equal(result.refresh_token, 'fake-refresh-token-456');

  // Verify parameters in URLSearchParams
  const params = new URLSearchParams(capturedBody);
  assert.equal(params.get('client_id'), 'test-client-id.apps.googleusercontent.com');
  assert.equal(params.get('client_secret'), 'GOCSPX-test-secret-value-789');
  assert.equal(params.get('code'), 'test-auth-code-abc');
  assert.equal(params.get('code_verifier'), 'test-verifier-xyz-123456789012345678901234567890');
  assert.equal(params.get('grant_type'), 'authorization_code');
  assert.equal(params.get('redirect_uri'), 'http://127.0.0.1:54321/oauth2callback');
});

test('GoogleAuthService includes client_secret in token refresh when configured', async () => {
  let capturedBody = '';
  const fakeFetch: typeof fetch = async (_url, init) => {
    capturedBody = init?.body as string;
    return new Response(
      JSON.stringify({
        access_token: 'fake-refreshed-token-999',
        expires_in: 3600,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const authService = new GoogleAuthService({ fetchFn: fakeFetch });

  const result = await authService.refreshAccessToken(
    'test-client-id.apps.googleusercontent.com',
    'fake-refresh-token-456',
    'GOCSPX-test-secret-value-789',
  );

  assert.equal(result.access_token, 'fake-refreshed-token-999');

  const params = new URLSearchParams(capturedBody);
  assert.equal(params.get('client_id'), 'test-client-id.apps.googleusercontent.com');
  assert.equal(params.get('client_secret'), 'GOCSPX-test-secret-value-789');
  assert.equal(params.get('refresh_token'), 'fake-refresh-token-456');
  assert.equal(params.get('grant_type'), 'refresh_token');
});

test('GoogleAuthService keeps missing client configuration in structured developer diagnostics', async () => {
  const authService = new GoogleAuthService();
  await assert.rejects(
    async () => {
      await authService.startAuthFlow('');
    },
    (err: Error) => {
      assert.ok(err instanceof GoogleAuthDiagnosticError);
      assert.equal((err as GoogleAuthDiagnosticError).stage, 'configuration');
      assert.equal((err as GoogleAuthDiagnosticError).reason, 'missing_client_id');
      assert.doesNotMatch(err.message, /PANVAS_GOOGLE_CLIENT_ID/);
      return true;
    },
  );
});

test('security contract: client_secret is not exposed in preload, renderer, or types', async () => {
  const preload = await fs.readFile(new URL('../electron/preload.ts', import.meta.url), 'utf8');
  assert.ok(!preload.includes('client_secret'), 'client_secret must not exist in preload.ts');
  assert.ok(!preload.includes('clientSecret'), 'clientSecret must not exist in preload.ts');

  const electronTypes = await fs.readFile(new URL('../src/types/electron.d.ts', import.meta.url), 'utf8');
  assert.ok(!electronTypes.includes('client_secret'), 'client_secret must not exist in electron.d.ts');
  assert.ok(!electronTypes.includes('clientSecret'), 'clientSecret must not exist in electron.d.ts');

  const store = await fs.readFile(new URL('../src/stores/cloudSyncStore.ts', import.meta.url), 'utf8');
  assert.ok(!store.includes('client_secret') && !store.includes('clientSecret'), 'client secret must not exist in store');

  const handlers = await fs.readFile(new URL('../electron/ipc/cloudsync-handlers.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(`${preload}\n${electronTypes}`, /getValidAccessToken|cloudsync:getValidAccessToken/, 'OAuth access tokens must not cross preload');
  assert.doesNotMatch(handlers, /ipcMain\.handle\(['"]cloudsync:getValidAccessToken/, 'main must not expose an access-token IPC method');
  assert.match(handlers, /cloudsync:drive:readManifest/);
  assert.match(handlers, /cloudsync:drive:putObjectIfAbsent/);
  assert.doesNotMatch(handlers, /requestUrl|requestHeaders|authenticatedFetch/, 'Drive IPC must not accept arbitrary authenticated requests');
});

test('Electron renderer provider delegates to the narrow Drive bridge without requesting a token', async () => {
  const previousWindow = (globalThis as any).window;
  const calls: string[] = [];
  const ok = <T>(value: T) => Promise.resolve({ success: true as const, value });
  (globalThis as any).window = { panvas: { cloudsync: { drive: {
    ensureAppRoot: () => { calls.push('root'); return ok('root-id'); },
    listRemoteWorkspaces: () => { calls.push('list'); return ok([]); },
    readManifest: () => ok({ manifest: null, etag: null }),
    writeManifest: () => ok({ etag: 'etag' }),
    getObject: () => ok(new Uint8Array()),
    putObjectIfAbsent: () => { calls.push('put'); return ok('uploaded' as const); },
    deleteObject: () => ok(true), moveObject: () => ok(true), getMetadata: () => ok(null),
  } } } };
  try {
    let tokenReads = 0;
    const provider = new GoogleDriveSyncProvider({ tokenProvider: async () => { tokenReads += 1; return 'must-not-be-read'; } });
    assert.equal(await provider.ensureAppRoot(), 'root-id');
    assert.deepEqual(await provider.listRemoteWorkspaces(), []);
    assert.equal(await provider.putObjectIfAbsent('ws-safe', { hash: 'a'.repeat(64), bytes: new Uint8Array([1]) }), 'uploaded');
    assert.deepEqual(calls, ['root', 'list', 'put']);
    assert.equal(tokenReads, 0);
    (globalThis as any).window.panvas.cloudsync.drive.writeManifest = () => Promise.resolve({
      success: false as const, errorCode: 'conflict',
      diagnostic: { provider: 'googledrive', stage: 'manifest-publication', reason: 'etag-mismatch', retryable: true },
    });
    const manifest = buildManifestV1({ workspaceId: 'ws-safe', revision: 2, previousRevision: 1, writerDeviceId: 'renderer', generatedAt: '2026-08-30T00:00:00.000Z', records: [] });
    await assert.rejects(() => provider.writeManifest('ws-safe', manifest, 'old-etag'), ProviderConflictError);
  } finally {
    if (previousWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = previousWindow;
  }
});

test('Electron auth never falls back to plaintext token storage when safeStorage is unavailable', async () => {
  const authService = await fs.readFile(new URL('../electron/ipc/google-auth-service.ts', import.meta.url), 'utf8');
  assert.match(authService, /secure_storage_unavailable/);
  assert.doesNotMatch(authService, /payload\s*=\s*Buffer\.from\(json/);
  assert.match(authService, /if \(!electron\?\.safeStorage\?\.isEncryptionAvailable/);
});

test('GoogleDriveSyncProvider creates Panvas root, objects, and workspaces folders using parent IDs', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  const rootId = await provider.ensureAppRoot();
  assert.ok(rootId.startsWith('fake-file-'));

  // Ensure 'Panvas', 'objects', and 'workspaces' folders exist in fake storage
  const createdFiles = Array.from(fake.files.values());
  const panvasFolder = createdFiles.find(f => f.name === 'Panvas');
  const objectsFolder = createdFiles.find(f => f.name === 'objects');
  const workspacesFolder = createdFiles.find(f => f.name === 'workspaces');

  assert.ok(panvasFolder);
  // Root folder has no parent (or empty array) in v3
  assert.deepEqual(panvasFolder.parents, []);
  assert.ok(objectsFolder);
  assert.ok(workspacesFolder);
  // Subfolders have rootFolderId in parents
  assert.deepEqual(objectsFolder.parents, [panvasFolder.id]);
  assert.deepEqual(workspacesFolder.parents, [panvasFolder.id]);
});

test('GoogleDriveSyncProvider discovers only real Panvas workspace IDs and ignores legacy default', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({ tokenProvider: async () => 'test-valid-token', fetchFn: fake.fetchFn });
  await provider.ensureAppRoot();
  const all = Array.from(fake.files.values());
  const workspaces = all.find(file => file.name === 'workspaces')!;
  const objects = all.find(file => file.name === 'objects')!;
  const workspaceId = 'ws-discovery';
  const workspaceHash = 'd'.repeat(64);
  fake.files.set('folder-valid', { id: 'folder-valid', name: workspaceId, mimeType: 'application/vnd.google-apps.folder', parents: [workspaces.id] });
  fake.files.set('folder-valid-duplicate', { id: 'folder-valid-duplicate', name: workspaceId, mimeType: 'application/vnd.google-apps.folder', parents: [workspaces.id] });
  fake.files.set('folder-default', { id: 'folder-default', name: 'default', mimeType: 'application/vnd.google-apps.folder', parents: [workspaces.id] });
  fake.files.set('folder-unrelated', { id: 'folder-unrelated', name: 'personal-files', mimeType: 'application/vnd.google-apps.folder', parents: [workspaces.id] });
  fake.files.set('object-workspace', { id: 'object-workspace', name: workspaceHash, mimeType: 'application/octet-stream', parents: [objects.id], content: new TextEncoder().encode(JSON.stringify({ id: workspaceId, name: 'Research' })) });
  const manifest: SyncManifestV1 = { format: 'panvas-sync', schemaVersion: 1, workspaceId, revision: 7, previousRevision: 6, writerDeviceId: 'device-a', generatedAt: '2026-08-30T00:00:00.000Z', records: [{ kind: 'workspace', id: workspaceId, parentId: null, revision: 1, baseRevision: null, contentHash: workspaceHash, tombstone: false }] };
  fake.files.set('manifest-valid', { id: 'manifest-valid', name: 'manifest.json', mimeType: 'application/json', parents: ['folder-valid'], content: new TextEncoder().encode(JSON.stringify(manifest)), version: '7' });

  provider.resetRequestMetrics();
  const discovered = await provider.listRemoteWorkspaces();
  assert.deepEqual(discovered, [{ workspaceId, name: workspaceId, revision: 0, generatedAt: '', recordCount: 0 }]);
  assert.equal(provider.getRequestMetrics().requests, 1, 'discovery lists workspace folders without downloading every manifest and workspace object');
  await assert.rejects(() => provider.readManifest('default'), /not a canonical sync target/);
});

test('GoogleDriveSyncProvider first sync when no manifest exists returns null and allows initial write', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  // 1. Initial read on empty workspace returns null manifest and null etag
  const initialRead = await provider.readManifest('ws-brand-new');
  assert.equal(initialRead.manifest, null);
  assert.equal(initialRead.etag, null);

  // 2. Initial write with ifMatch: null creates the manifest
  const validHash = 'c'.repeat(64);
  const newManifest: SyncManifestV1 = {
    format: 'panvas-sync',
    schemaVersion: 1,
    workspaceId: 'ws-brand-new',
    revision: 1,
    previousRevision: null,
    writerDeviceId: 'device-test-1',
    generatedAt: new Date().toISOString(),
    records: [{ kind: 'notebook', id: 'nb-1', parentId: null, revision: 1, baseRevision: null, contentHash: validHash, tombstone: false }],
  };

  const writeRes = await provider.writeManifest('ws-brand-new', newManifest, null);
  assert.ok(writeRes.etag);

  // 3. Read back returns the newly created manifest
  const readBack = await provider.readManifest('ws-brand-new');
  assert.equal(readBack.etag, writeRes.etag);
  assert.equal(readBack.manifest?.records.length, 1);
});

test('GoogleDriveSyncProvider writes and reads manifest optimistically with etags', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  const validHash = 'a'.repeat(64);
  const manifest: SyncManifestV1 = {
    format: 'panvas-sync',
    schemaVersion: 1,
    workspaceId: 'ws-123',
    revision: 1,
    previousRevision: null,
    writerDeviceId: 'device-1',
    generatedAt: new Date().toISOString(),
    records: [
      { kind: 'notebook', id: 'nb-1', parentId: null, revision: 1, baseRevision: null, contentHash: validHash, tombstone: false },
    ],
  };

  // 1. Initial write (no existing manifest)
  const writeRes = await provider.writeManifest('ws-123', manifest, null);
  assert.ok(writeRes.etag);

  // 2. Read back
  const readRes = await provider.readManifest('ws-123');
  assert.equal(readRes.etag, writeRes.etag);
  assert.deepEqual(readRes.manifest?.records, manifest.records);

  // 3. Update manifest with valid ifMatch
  const updatedManifest: SyncManifestV1 = {
    ...manifest,
    revision: 2,
    previousRevision: 1,
  };
  const updateRes = await provider.writeManifest('ws-123', updatedManifest, writeRes.etag);
  assert.notEqual(updateRes.etag, writeRes.etag);

  // 4. Stale ifMatch throws ProviderConflictError
  await assert.rejects(
    async () => {
      await provider.writeManifest('ws-123', updatedManifest, 'stale-etag-999');
    },
    (err: any) => err instanceof ProviderConflictError,
  );
});

test('GoogleDriveSyncProvider surfaces sanitized diagnostics on 403 permission error', async () => {
  const fake = createFakeDriveTransport();
  fake.setCustomResponse({
    status: 403,
    body: JSON.stringify({
      error: {
        code: 403,
        message: 'The user does not have sufficient permissions for this file.',
        errors: [{ reason: 'insufficientPermissions' }],
      },
    }),
  });

  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  await assert.rejects(
    async () => {
      await provider.ensureAppRoot();
    },
    (err: Error) => {
      assert.ok(err instanceof GoogleDriveApiError);
      assert.equal((err as GoogleDriveApiError).status, 403);
      assert.equal((err as GoogleDriveApiError).reason, 'insufficientPermissions');
      assert.ok(err.message.includes('403 insufficientPermissions'));
      return true;
    },
  );
});

test('GoogleDriveSyncProvider surfaces sanitized diagnostics on 400 invalid argument', async () => {
  const fake = createFakeDriveTransport();
  fake.setCustomResponse({
    status: 400,
    body: JSON.stringify({
      error: {
        code: 400,
        message: 'Invalid Value',
        errors: [{ reason: 'invalidArgument' }],
      },
    }),
  });

  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  await assert.rejects(
    async () => {
      await provider.ensureAppRoot();
    },
    (err: Error) => {
      assert.ok(err instanceof GoogleDriveApiError);
      assert.equal((err as GoogleDriveApiError).status, 400);
      assert.equal((err as GoogleDriveApiError).reason, 'invalidArgument');
      return true;
    },
  );
});

test('GoogleDriveSyncProvider stores and retrieves content-addressed objects idempotently', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  const content = new TextEncoder().encode('Hello Panvas Google Drive Sync');
  const upload: ObjectUpload = {
    hash: 'sha256-content-abc-123',
    bytes: content,
  };

  // Upload object
  await provider.putObjectIfAbsent('ws-123', upload);

  // Download object
  const downloaded = await provider.getObject('ws-123', 'sha256-content-abc-123');
  assert.ok(downloaded.byteLength > 0);

  // Second put is an idempotent no-op
  const fileCountBefore = fake.files.size;
  await provider.putObjectIfAbsent('ws-123', upload);
  assert.equal(fake.files.size, fileCountBefore);
});

test('GoogleDriveSyncProvider batches object existence discovery for a 30-object upload', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({ tokenProvider: async () => 'test-valid-token', fetchFn: fake.fetchFn });
  await provider.ensureAppRoot();
  provider.resetRequestMetrics();
  const uploads = Array.from({ length: 30 }, (_, index) => ({
    hash: index.toString(16).padStart(64, '0'),
    bytes: new TextEncoder().encode(`object-${index}`),
  }));
  await Promise.all(uploads.map(upload => provider.putObjectIfAbsent('ws-batch', upload)));
  assert.equal(provider.getRequestMetrics().requests, 31, 'one shared object index plus one upload request per new object');
  const beforeIdle = provider.getRequestMetrics().requests;
  await Promise.all(uploads.map(upload => provider.putObjectIfAbsent('ws-batch', upload)));
  assert.equal(provider.getRequestMetrics().requests, beforeIdle, 'known unchanged objects require no additional Drive calls');
});

test('GoogleDriveSyncProvider uses resumable upload for large payloads (>= 5MB)', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  // 5MB buffer
  const largeBytes = new Uint8Array(5 * 1024 * 1024);
  largeBytes.fill(42);

  const upload: ObjectUpload = {
    hash: 'large-pdf-blob-5mb',
    bytes: largeBytes,
  };

  await provider.putObjectIfAbsent('ws-123', upload);

  const file = Array.from(fake.files.values()).find(f => f.name === 'large-pdf-blob-5mb');
  assert.ok(file);
  assert.equal(file.size, 5 * 1024 * 1024);
});

test('GoogleDriveSyncProvider throws AuthExpiredError on 401 Unauthorized', async () => {
  const fake = createFakeDriveTransport();
  fake.setAuthExpired(true);

  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  await assert.rejects(
    async () => {
      await provider.ensureAppRoot();
    },
    (err: any) => err instanceof AuthExpiredError,
  );
});

test('GoogleDriveSyncProvider refreshes once after 401 and retries the failed Drive operation', async () => {
  const fake = createFakeDriveTransport();
  fake.setAuthExpired(true);
  let refreshes = 0;
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'locally-unexpired-but-rejected',
    tokenRefresher: async () => { refreshes += 1; fake.setAuthExpired(false); return 'refreshed-token'; },
    fetchFn: fake.fetchFn,
  });
  await provider.ensureAppRoot();
  assert.equal(refreshes, 1);
  assert.ok(provider.getRequestMetrics().retries >= 1);
});

test('expired preflight token and concurrent 401s share one refresh', async () => {
  const fake = createFakeDriveTransport();
  let refreshes = 0;
  let currentToken: string | null = null;
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => currentToken,
    tokenRefresher: async () => { refreshes += 1; currentToken = 'renewed-token'; return currentToken; },
    fetchFn: fake.fetchFn,
  });
  await provider.ensureAppRoot();
  assert.equal(refreshes, 1, 'an expired memory-only browser token reauthorizes before the request');

  fake.setAuthExpired(true);
  const concurrent = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'locally-valid-token',
    tokenRefresher: async () => {
      refreshes += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      fake.setAuthExpired(false);
      return 'renewed-token';
    },
    fetchFn: fake.fetchFn,
  });
  await concurrent.ensureAppRoot();
  fake.setAuthExpired(true);
  const before = refreshes;
  await Promise.all([concurrent.listRemoteWorkspaces(), concurrent.listRemoteWorkspaces(), concurrent.listRemoteWorkspaces()]);
  assert.equal(refreshes - before, 1);
});

test('long account migration refreshes on workspace three and continues', async () => {
  const fake = createFakeDriveTransport();
  let refreshes = 0;
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'current-token',
    tokenRefresher: async () => { refreshes += 1; fake.setAuthExpired(false); return 'refreshed-token'; },
    fetchFn: fake.fetchFn,
  });
  const sourceFor = (workspaceId: string): SyncPayloadSource => {
    const bytes = new TextEncoder().encode(JSON.stringify({ id: workspaceId, name: workspaceId }));
    return {
      async scanWorkspace() { return [{ entityType: 'workspace', entityId: workspaceId, workspaceId, parentId: null, bytes, tombstone: false, deletedAt: null }]; },
      async loadPayload() { return bytes; },
      async parentOf() { return null; },
    };
  };
  for (const [index, workspaceId] of ['ws-one', 'ws-two', 'ws-three', 'ws-four'].entries()) {
    if (index === 2) fake.setAuthExpired(true);
    const result = await migrateWorkspaceToGoogleAccount({
      workspaceId, deviceId: 'migration-device', provider,
      payloadSource: sourceFor(workspaceId), now: 10 + index,
    });
    assert.equal(result.status, 'synced', `${workspaceId} migrates after bounded auth recovery`);
  }
  assert.equal(refreshes, 1);
  assert.deepEqual((await provider.listRemoteWorkspaces()).map(item => item.workspaceId).sort(), ['ws-four', 'ws-one', 'ws-three', 'ws-two'].sort());
});

test('Electron Drive provider wires forced main-process refresh without exposing tokens to preload', async () => {
  const [handlers, preload] = await Promise.all([
    fs.readFile(new URL('../electron/ipc/cloudsync-handlers.ts', import.meta.url), 'utf8'),
    fs.readFile(new URL('../electron/preload.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(handlers, /tokenRefresher: \(\) => googleAuthService\.forceRefreshAccessToken\(\)/);
  assert.doesNotMatch(preload, /accessToken|refreshToken|forceRefreshAccessToken/);
});

test('GoogleDriveSyncProvider disconnect clears folder cache and resets state', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  await provider.ensureAppRoot();
  await provider.disconnect();
  // Safe to call again
  await provider.disconnect();
});

test('runSyncCycle publishes local changes to Google Drive and handles remote sync', async () => {
  const fake = createFakeDriveTransport();
  const provider = new GoogleDriveSyncProvider({
    tokenProvider: async () => 'test-valid-token',
    fetchFn: fake.fetchFn,
  });

  const validHash = 'b'.repeat(64);
  const journalEntries: SyncJournalEntry[] = [
    {
      entryId: 'entry-1',
      entityType: 'notebook',
      entityId: 'nb-local-1',
      workspaceId: 'ws-test',
      operation: 'create',
      localRevision: 1,
      contentHash: validHash,
      baseRevision: null,
      updatedAt: 1000,
      deletedAt: null,
      tombstone: false,
      state: 'pending',
      attempts: 0,
      nextAttemptAt: null,
      lastErrorClass: null,
      payloadRef: 'nb-local-1',
    },
  ];

  const fakeJournalStore: SyncJournalStore = {
    async listPending(ws: string) {
      return journalEntries.filter(e => e.workspaceId === ws && e.state === 'pending');
    },
    async upsert(entry: SyncJournalEntry) {
      const idx = journalEntries.findIndex(e => e.entryId === entry.entryId);
      if (idx >= 0) journalEntries[idx] = entry;
      else journalEntries.push(entry);
    },
    async latestByEntity(ws: string) {
      const map = new Map<string, SyncJournalEntry>();
      for (const e of journalEntries.filter(candidate => candidate.workspaceId === ws)) {
        map.set(`${e.entityType}:${e.entityId}`, e);
      }
      return map;
    },
  };

  const fakePayloadSource: SyncPayloadSource = {
    async loadPayload(entry: SyncJournalEntry) {
      return new TextEncoder().encode(JSON.stringify({ id: entry.entityId, title: 'Notebook Title' }));
    },
    async parentOf() {
      return null;
    },
  };

  const deviceState: DeviceManifestState = { lastSeenRevision: 0 };

  const result = await runSyncCycle({
    workspaceId: 'ws-test',
    deviceId: 'test-device-1',
    journalStore: fakeJournalStore,
    provider,
    payloadSource: fakePayloadSource,
    deviceState,
    now: 2000,
  });

  assert.equal(result.published, 1);
  assert.equal(result.manifestPublished, true);
  assert.equal(journalEntries[0].state, 'synced');

  const idle = await runSyncCycle({
    workspaceId: 'ws-test', deviceId: 'test-device-1', journalStore: fakeJournalStore,
    provider, payloadSource: fakePayloadSource, deviceState, now: 3000,
  });
  assert.equal(idle.upToDate, true);
  assert.equal(idle.providerRequests.requests, 2, 'idle sync performs only manifest metadata and content reads');
  assert.equal(idle.objectsUploaded, 0);
  assert.equal(idle.manifestPublished, false);

  // Verify remote manifest now has nb-local-1
  const remote = await provider.readManifest('ws-test');
  assert.ok(remote.manifest);
  assert.equal(remote.manifest.records.length, 1);
  assert.equal(remote.manifest.records[0].id, 'nb-local-1');
});
