import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('HARDEN-007 exposes an explicit, persisted storage-root chooser without relocation', async () => {
  const [service, handlers, preload, types, settings] = await Promise.all([
    readFile('electron/ipc/WorkspaceService.ts', 'utf8'),
    readFile('electron/ipc/domain-handlers.ts', 'utf8'),
    readFile('electron/preload.ts', 'utf8'),
    readFile('src/types/electron.d.ts', 'utf8'),
    readFile('src/components/settings/sections/WorkspaceSection.tsx', 'utf8'),
  ]);
  assert.match(service, /setStorageRoot\(candidate: string\)/);
  assert.match(service, /assertStorageRootAvailable\(\)/);
  assert.match(service, /writeGlobalSettings\(next\)/);
  assert.match(service, /workspaceRegistry\.values\(\)/);
  assert.match(service, /workspaceLocations: Object\.fromEntries/);
  assert.doesNotMatch(service, /copyFile|rename\([^)]*workspace/i, 'changing the root must not move existing workspaces');
  assert.match(handlers, /registerHandler\('storage:chooseRoot'/);
  assert.match(handlers, /registerHandler\('storage:setRoot'/);
  assert.match(handlers, /workspaceService\.setStorageRoot\(result\.filePaths\[0\]\)/);
  assert.match(preload, /chooseRoot: \(\) => ipcRenderer\.invoke\('storage:chooseRoot'\)/);
  assert.match(types, /chooseRoot: \(\) => Promise/);
  assert.match(settings, /Panvas Storage Location/);
  assert.match(settings, /The selected folder is unavailable or not writable/);
});

test('HARDEN-007 write queue retries cloud-sync locks a bounded number of times', async () => {
  const queue = await readFile('electron/ipc/write-queue.ts', 'utf8');
  assert.match(queue, /let retries = 10/);
  assert.match(queue, /Math\.min\(1000, delay \+ jitter\)/);
  assert.match(queue, /previous target remains untouched/);
  assert.match(queue, /fsPromises\.rm\(tempPath, \{ force: true \}\)/);
});

test('HARDEN-011 uses one bounded desktop metadata snapshot and keeps browser fallback', async () => {
  const [service, handlers, preload, types, store, app] = await Promise.all([
    readFile('electron/ipc/WorkspaceService.ts', 'utf8'),
    readFile('electron/ipc/domain-handlers.ts', 'utf8'),
    readFile('electron/preload.ts', 'utf8'),
    readFile('src/types/electron.d.ts', 'utf8'),
    readFile('src/stores/workspaceStore.ts', 'utf8'),
    readFile('src/app/App.tsx', 'utf8'),
  ]);
  const snapshotStart = service.indexOf('async getStartupSnapshot()');
  const snapshotEnd = service.indexOf('// Binary assets', snapshotStart);
  assert.ok(snapshotStart >= 0 && snapshotEnd > snapshotStart);
  const snapshot = service.slice(snapshotStart, snapshotEnd);
  assert.doesNotMatch(snapshot, /readFile|\.bin|\.content|\.drawing|loadPage|loadDrawing/);
  assert.match(snapshot, /MAX_STARTUP_ITEMS/);
  assert.match(handlers, /registerHandler\('workspace:getStartupSnapshot'/);
  assert.match(preload, /getSnapshot: \(\) => ipcRenderer\.invoke\('workspace:getStartupSnapshot'\)/);
  assert.match(types, /getSnapshot: \(\) => Promise<PanvasBootstrapSnapshot>/);
  assert.match(store, /window\.panvas\?\.bootstrap/);
  assert.match(store, /pendingBootstrapSnapshot/);
  assert.match(store, /using fallback reads/);
  assert.match(app, /const bootstrapSnapshot = await loadWorkspaces\(\)/);
  assert.match(app, /if \(!bootstrapSnapshot\) await useNotebookSettingsStore\.getState\(\)\.loadSettings\(\)/);
});
