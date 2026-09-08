import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCanonicalCanvasPayload, isValidCanvasScenePayload, selectCanonicalCanvasScene } from '../src/repositories/canvasSceneStorage.ts';
import { validateEntityName, InvalidEntityNameError } from '../src/lib/entityName.ts';
import type { CanvasData, CustomBlock } from '../src/types/canvas';

function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

function scene(id: string, updatedAt: number, elements: unknown[] = [{ id: 'el-1' }]): CanvasData {
  return { canvasFileId: id, elements, appState: {}, files: {}, customBlocks: [], version: 1, updatedAt, userId: null };
}

function block(id: string, content = '# note'): CustomBlock {
  return { id, canvasFileId: 'canvas-1', type: 'markdown', x: 0, y: 0, width: 320, height: 120, content, createdAt: 1, updatedAt: 1, userId: null };
}

// ---- Adapter selection (behavioral via the pure decision + source contract) ----

test('invalid payloads never win arbitration', () => {
  assert.equal(isValidCanvasScenePayload(null), false);
  assert.equal(isValidCanvasScenePayload({ canvasFileId: 'x' }), false, 'elements array is mandatory');
  const decision = selectCanonicalCanvasScene(null, scene('c-1', 5));
  assert.equal(decision.scene?.updatedAt, 5);
  assert.equal(decision.writeForwardLegacy, true, 'legacy-only scene must be adopted into the canonical file');
});

test('newest-wins arbitration: filesystem wins ties, legacy wins only when strictly newer', () => {
  const file = scene('c-1', 100);
  const legacy = scene('c-1', 100);
  assert.equal(selectCanonicalCanvasScene(file, legacy).writeForwardLegacy, false, 'tie → filesystem (no endless migration)');

  const newerFile = selectCanonicalCanvasScene(scene('c-1', 200), scene('c-1', 100));
  assert.equal(newerFile.scene?.updatedAt, 200);
  assert.equal(newerFile.writeForwardLegacy, false, 'never overwrite newer canonical data with legacy');

  const newerLegacy = selectCanonicalCanvasScene(scene('c-1', 100), scene('c-1', 200));
  assert.equal(newerLegacy.scene?.updatedAt, 200);
  assert.equal(newerLegacy.writeForwardLegacy, true, 'strictly newer legacy scene is written forward exactly once');

  assert.equal(selectCanonicalCanvasScene(scene('c-1', 100), null).scene?.updatedAt, 100);
});

test('canonical payload embeds custom blocks, bumps version, and merges partial saves', () => {
  const previous = scene('canvas-1', 50);
  previous.version = 7;
  previous.appState = { zoom: 2 } as CanvasData['appState'];
  const payload = buildCanonicalCanvasPayload(
    { canvasFileId: 'canvas-1', elements: [{ id: 'el-2' }], appState: {}, files: {} },
    previous,
    [block('block-1'), block('block-2', '$E=mc^2$')],
    'user-1',
    999,
  );
  assert.deepEqual(payload.customBlocks.map(b => b.id), ['block-1', 'block-2'], 'custom blocks are part of the ONE canonical representation');
  assert.equal(payload.version, 8);
  assert.equal(payload.updatedAt, 999);
  assert.equal(payload.userId, 'user-1');
  assert.equal(payload.elements.length, 1);

  // Partial autosave (no files/appState given) merges over the previous scene.
  const partial = buildCanonicalCanvasPayload({ canvasFileId: 'canvas-1', elements: [] }, previous, [], null, 1000);
  assert.deepEqual(partial.appState, { zoom: 2 }, 'partial saves must not drop previous fields');
  assert.deepEqual(partial.files, previous.files);

  // First save with no previous scene still produces a valid payload.
  const fresh = buildCanonicalCanvasPayload({ canvasFileId: 'c-2', elements: [], appState: {}, files: {} }, null, [], null, 1);
  assert.equal(fresh.version, 1);
  assert.deepEqual(fresh.customBlocks, []);
});

// ---- Windows reserved names ----

test('Windows reserved device names are rejected case-insensitively, with or without extensions', () => {
  for (const name of ['CON', 'con', 'Con', 'PRN', 'aux', 'NUL', 'COM1', 'com9', 'LPT1', 'lpt9', 'CON.txt', 'nul.md', 'LPT1.notes', 'com4.canvas']) {
    assert.throws(() => validateEntityName(name), InvalidEntityNameError, `"${name}" must be rejected`);
  }
  assert.match((() => { try { validateEntityName('CON.txt'); } catch (error) { return error; } throw new Error('unreachable'); })().message, /reserved Windows device name/);
});

test('normal names pass through unchanged and validation is clean', () => {
  for (const name of ['Research', 'my notes', 'Plan 3000', 'con artist', 'second.nan', '控制']) {
    const trimmed = name.trim();
    assert.equal(validateEntityName(name), trimmed);
  }
  assert.throws(() => validateEntityName('   '), InvalidEntityNameError);
  assert.throws(() => validateEntityName('bad<name'), InvalidEntityNameError);
  assert.throws(() => validateEntityName('x'.repeat(129)), InvalidEntityNameError);
});

// ---- Wiring contracts (renderer/store/backup paths) ----

test('CanvasRepository routes Electron saves/loads through the canonical filesystem bridge', async () => {
  const source = await read('../src/repositories/CanvasRepository.ts');
  assert.match(source, /window\.panvas[\s\S]{0,40}canvas\.save\(workspace, data\.canvasFileId, payload\)/);
  assert.match(source, /window\.panvas[\s\S]{0,40}canvas\.load\(workspace, canvasFileId\)/);
  assert.match(source, /selectCanonicalCanvasScene\(fileScene, legacyScene \?\? null\)/);
  assert.match(source, /importCustomBlocks\(userId, embeddedBlocks\)/);
  // Electron scene writes no longer touch Dexie; browser path still does.
  const electronBranch = source.slice(source.indexOf('// ---- Canvas Data'));
  assert.ok(electronBranch.indexOf('window.panvas.canvas.save') < electronBranch.indexOf('canvasDB.saveCanvasData'));
  assert.match(source, /getBlocksByCanvas\(userId, data\.canvasFileId\)/, 'saves embed the renderer block cache');
});

test('browser IndexedDB path and sync queue remain unchanged', async () => {
  const source = await read('../src/repositories/CanvasRepository.ts');
  assert.match(source, /await canvasDB\.saveCanvasData\(userId, data\);/);
  assert.match(source, /queueSync\('canvasData', data\.canvasFileId, 'update', full\)/);
  const store = await read('../src/stores/canvasStore.ts');
  assert.match(store, /loadCanvasData: async \(canvasFileId: string, workspaceId\?: string\)/);
  assert.match(store, /saveCanvasData: async \(data: Partial<CanvasData> & \{ canvasFileId: string \}, workspaceId\?: string\)/);
});

test('backup/restore uses the canonical filesystem scenes in Electron', async () => {
  const service = await read('../electron/ipc/WorkspaceService.ts');
  // Export reads the canonical files; restore writes them through the queue.
  assert.match(service, /path\.join\(workspaceDir, 'Canvas', `\$\{canvas\.id\}\.json`\)/);
  assert.match(service, /writeQueue\.enqueue\(path\.join\(workspaceDir, 'Canvas', `\$\{canvas\.id\}\.json`\)/);
  const backupService = await read('../src/services/backup/backupService.ts');
  assert.match(backupService, /runtime\.panvas\?\.backup\)\s*return runtime\.panvas\.backup\.export\(workspaceId\)/);
});

test('hierarchy, trash, and custom-block helper contracts are untouched', async () => {
  const workspaceDB = await read('../src/database/canvasDB.ts');
  assert.match(workspaceDB, /export async function importCustomBlocks/);
  assert.match(workspaceDB, /bulkPut/);
  const repo = await read('../src/repositories/CanvasRepository.ts');
  // Canvas hierarchy ownership and trash semantics must be identical strings.
  assert.match(repo, /canvasFile\.update\(workspaceId, id, \{ deletedAt: Date\.now\(\) \}\)/);
  assert.match(repo, /canvasFile\.update\(workspaceId, id, \{ deletedAt: null \}\)/);
  assert.match(repo, /canvasFile\.create\(workspaceId, name, folderId, notebookId, sectionId\)/);
});
