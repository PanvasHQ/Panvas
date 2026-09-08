import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import { applyDevelopmentBrowserCsp } from '../src/config/browserCsp.ts';
import { normalizeSupabaseUrl, resolveSupabaseConfiguration } from '../src/services/supabase/config.ts';

test('development CSP permits only the eval capability required by the local dependency bundle', async () => {
  const source = await readFile('index.html', 'utf8');
  const development = applyDevelopmentBrowserCsp(source, true);
  const production = applyDevelopmentBrowserCsp(source, false);

  assert.match(development, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(production, /'unsafe-eval'/);
  assert.match(production, /script-src 'self'/);
  assert.match(production, /script-src[^;]*https:\/\/accounts\.google\.com\/gsi\/client/);
  assert.match(production, /frame-src https:\/\/accounts\.google\.com\/gsi\//);
  for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.match(development, new RegExp(directive));
    assert.match(production, new RegExp(directive));
  }
});

test('Supabase construction is opt-in and validates the complete project root', () => {
  const valid = { cloudEnabled: true, url: 'https://project-id.supabase.co', anonKey: 'public-anon-key' };
  assert.equal(resolveSupabaseConfiguration({ ...valid, cloudEnabled: false }).enabled, false);
  assert.equal(resolveSupabaseConfiguration({ ...valid, anonKey: '' }).enabled, false);
  assert.equal(resolveSupabaseConfiguration({ ...valid, url: 'https://project-id.supabase.co.evil.example' }).enabled, false);
  assert.equal(resolveSupabaseConfiguration({ ...valid, url: 'http://project-id.supabase.co' }).enabled, false);
  assert.equal(resolveSupabaseConfiguration(valid).enabled, true);
  assert.equal(normalizeSupabaseUrl(' https://project-id.supabase.co/auth/v1/ '), 'https://project-id.supabase.co');
});

test('browser bootstrap degrades locally before React and never assumes Electron capabilities', async () => {
  const [entry, bootstrap, client, authStore, boundary, html] = await Promise.all([
    readFile('src/main.tsx', 'utf8'),
    readFile('src/bootstrap.tsx', 'utf8'),
    readFile('src/services/supabase/client.ts', 'utf8'),
    readFile('src/stores/authStore.ts', 'utf8'),
    readFile('src/components/ui/ErrorBoundary.tsx', 'utf8'),
    readFile('index.html', 'utf8'),
  ]);

  assert.match(entry, /import\('\.\/bootstrap'\)/);
  assert.match(entry, /\.catch\(showBootstrapFailure\)/);
  assert.match(entry, /Panvas could not start/);
  assert.match(html, /panvas-bootstrap-fallback/);
  assert.match(bootstrap, /window\.panvas\?\.settings\?\.setTheme/);
  assert.doesNotMatch(bootstrap, /window\.panvas\.(?!\?)/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(client, /cloudEnabled: CLOUD_SYNC_ENABLED/);
  assert.match(client, /autoRefreshToken: false/);
  assert.match(authStore, /if \(authInitialization\) return authInitialization/);
  assert.match(authStore, /continuing in local-only mode/);
});

test('Vite forces Zustand and the application onto one React runtime', async () => {
  const [config, manifest, lock] = await Promise.all([
    readFile('vite.config.ts', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('package-lock.json', 'utf8'),
  ]);
  assert.match(config, /dedupe:\s*\['react', 'react-dom'\]/);
  const dependencies = JSON.parse(manifest).dependencies;
  assert.equal(dependencies.react, dependencies['react-dom']);
  assert.match(lock, /"node_modules\/zustand"/);
});

test('cloud status surfaces agree on conflicts/account migration and connected Google Drive suppresses the local-mode prompt', async () => {
  const [indicator, panel, guard, store] = await Promise.all([
    readFile('src/components/ui/SyncIndicator.tsx', 'utf8'),
    readFile('src/components/library/CloudSyncPanel.tsx', 'utf8'),
    readFile('src/components/auth/AuthGuard.tsx', 'utf8'),
    readFile('src/stores/cloudSyncStore.ts', 'utf8'),
  ]);
  assert.match(indicator, /gdStatus === 'conflict'/, 'the global header must not render a conflict as Synced');
  assert.match(indicator, /gdStatus === 'account-migration-required'/, 'the global header must not render an account migration as Synced');
  assert.match(panel, /gdStatus === 'conflict'/, 'the card must render the same conflict state');
  assert.match(panel, /Move sync to this Google account/, 'the card must expose one explicit account migration action');
  assert.match(panel, /window\.confirm/, 'moving sync to another account requires explicit confirmation');
  assert.match(guard, /!isAuthenticated && !googleDriveConnection/, 'Google Drive auth is sufficient to suppress the unrelated local-mode prompt');
  assert.match(store, /unresolvedAfterApply/, 'account finalization must use post-apply journal state');
  assert.match(store, /finalizeAccountSync/, 'lastSynced and provider status share one final decision');
  assert.match(store, /accountMigrationWorkspaceIds/, 'foreign-account workspace bindings must be detected');
  assert.match(store, /moveSyncToCurrentGoogleAccount/, 'account migration must be an explicit store action');
  assert.match(store, /commitMigratedWorkspaceJournal[\s\S]*moveWorkspaceBinding/, 'new-account journal state and binding move only after migration succeeds');
  assert.doesNotMatch(store, /migrateDiscoveredWorkspaceBinding/, 'remote discovery must not silently rebind a foreign-account workspace');
});

test('ordinary Vite environment constructs no Supabase client and coalesces auth bootstrap', async () => {
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;
  const memory = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
  };
  (globalThis as any).localStorage = localStorage;
  (globalThis as any).window = { localStorage };
  const envDir = await mkdtemp(path.join(tmpdir(), 'panvas-vite-test-'));
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    // Keep this test independent from developer-local .env values.
    envDir,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    resolve: { alias: { '@': path.resolve('src') } },
  });
  try {
    const [{ supabase }, { authService }, { useAuthStore }] = await Promise.all([
      server.ssrLoadModule('/src/services/supabase/client.ts'),
      server.ssrLoadModule('/src/services/auth/AuthService.ts'),
      server.ssrLoadModule('/src/stores/authStore.ts'),
    ]);
    assert.equal(supabase, null, 'cloud-disabled web bootstrap has no remote auth client');

    let sessionReads = 0;
    let subscriptions = 0;
    const service = authService as any;
    const originalGetSession = service.getSession;
    const originalOnAuthStateChange = service.onAuthStateChange;
    Object.defineProperty(service, 'isConfigured', { configurable: true, value: true });
    service.getSession = async () => { sessionReads += 1; return null; };
    service.onAuthStateChange = () => { subscriptions += 1; return () => {}; };
    try {
      const first = useAuthStore.getState().initAuth();
      const second = useAuthStore.getState().initAuth();
      assert.equal(first, second, 'StrictMode replay shares one initialization promise');
      await Promise.all([first, second]);
      assert.equal(sessionReads, 1);
      assert.equal(subscriptions, 1);
      assert.equal(useAuthStore.getState().isLoading, false);
    } finally {
      service.getSession = originalGetSession;
      service.onAuthStateChange = originalOnAuthStateChange;
      delete service.isConfigured;
    }
  } finally {
    await server.close();
    await rm(envDir, { recursive: true, force: true });
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
    if (originalLocalStorage === undefined) delete (globalThis as any).localStorage;
    else (globalThis as any).localStorage = originalLocalStorage;
  }
});
