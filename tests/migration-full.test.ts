import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { runMigrationCoordinator, type MigrationSource } from '../src/lib/migration-core.ts';
import { importDexieWorkspace, resolveMigrationWorkspaceDirectory, type MigrationDestination } from '../electron/ipc/migration-import.ts';
import { WriteQueue, type AtomicWriteData } from '../electron/ipc/write-queue.ts';
import { prepareRemoteWorkspaceRecords } from '../electron/ipc/workspace-sync-order.ts';
import { cloudApplyFailure } from '../src/services/cloudsync/errors.ts';

const now = Date.now() - 60_000;
const bytes = (values: number[]) => new Uint8Array(values).buffer;
const table = <T>(values: T[]) => ({ toArray: async () => values });

function fixture(): { source: MigrationSource; records: Record<string, any[]> } {
  const records = {
    workspaces: [{ id: 'ws-a', name: 'Migration Fixture', createdAt: now, updatedAt: now, userId: null }],
    folders: [{ id: 'folder-a', workspaceId: 'ws-a', parentId: null, name: 'Research', order: 0, updatedAt: now }],
    canvasFiles: [{ id: 'canvas-a', workspaceId: 'ws-a', folderId: 'folder-a', name: 'Map', updatedAt: now }],
    canvasData: [{ canvasFileId: 'canvas-a', elements: [{ id: 'shape-a', type: 'rectangle' }], appState: { zoom: 1 }, files: {}, customBlocks: [], version: 2, updatedAt: now, userId: null }],
    customBlocks: [{ id: 'block-a', canvasFileId: 'canvas-a', type: 'markdown', content: '# Evidence', x: 1, y: 2, width: 3, height: 4, createdAt: now, updatedAt: now, userId: null }],
    notebooks: [{ id: 'notebook-a', workspaceId: 'ws-a', folderId: 'folder-a', name: 'Lab', order: 0, updatedAt: now, defaultPageProperties: { paperColor: '#fffaf0', template: 'Engineering' } }],
    notebookSections: [{ id: 'section-a', notebookId: 'notebook-a', name: 'Tests', order: 0, updatedAt: now }],
    notebookPages: [
      { id: 'page-text', notebookId: 'notebook-a', sectionId: 'section-a', title: 'Notes', order: 0, updatedAt: now, pagePropertyOverrides: { orientation: 'landscape', extraRight: 320 } },
      { id: 'page-pdf', notebookId: 'notebook-a', sectionId: 'section-a', title: 'Paper', order: 1, updatedAt: now, type: 'pdf', pdfDataId: 'pdf-a', pdfPageState: { version: 1, pageOrder: [1], rotations: { 1: 90 } } },
    ],
    notebookPageContents: [
      { pageId: 'page-text', workspaceId: 'ws-a', notebookId: 'notebook-a', data: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'semantic marker' }] }] }, version: 1, updatedAt: now, userId: null },
      { pageId: 'page-pdf', workspaceId: 'ws-a', notebookId: 'notebook-a', data: { type: 'doc', content: [] }, version: 1, updatedAt: now, userId: null },
    ],
    notebookPageDrawings: [
      { pageId: 'page-text', workspaceId: 'ws-a', notebookId: 'notebook-a', data: { objects: [{ id: 'stroke-a', type: 'stroke', points: [[1, 2], [3, 4]] }], layers: [{ id: 'layer-a' }] }, version: 1, updatedAt: now, userId: null },
      { pageId: 'page-pdf_pdf_1', workspaceId: 'ws-a', notebookId: 'notebook-a', data: { objects: [{ id: 'ink-pdf', type: 'stroke' }] }, version: 1, updatedAt: now, userId: null },
    ],
    pdfFiles: [{ id: 'pdf-a', canvasFileId: 'temp', fileName: 'paper.pdf', data: bytes([37, 80, 68, 70, 45, 1, 2, 3]), createdAt: now, userId: null }],
    imageFiles: [
      { id: 'image-a', canvasFileId: 'page-text', fileName: 'figure.png', mimeType: 'image/png', data: bytes([137, 80, 78, 71]), createdAt: now, userId: null },
      { id: 'audio-a', canvasFileId: 'page-text', fileName: 'note.webm', mimeType: 'audio/webm', data: bytes([26, 69, 223, 163]), createdAt: now, userId: null },
    ],
  };
  return { source: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, table(value)])) as unknown as MigrationSource, records };
}

function destination(root: string, queue: WriteQueue = new WriteQueue()): MigrationDestination {
  return { workspaceDir: path.join(root, 'Migration Fixture'), pdfStoreDir: path.join(root, 'Assets', 'pdf-store'), imageStoreDir: path.join(root, 'Assets', 'image-store'), audioStoreDir: path.join(root, 'Assets', 'audio-store'), writeQueue: queue, registerWorkspace: () => undefined };
}

class FailOnceQueue extends WriteQueue {
  private failed = false;
  private readonly pattern: RegExp;
  constructor(pattern: RegExp) { super(); this.pattern = pattern; }
  override async enqueue(filePath: string, data: AtomicWriteData): Promise<void> {
    if (!this.failed && this.pattern.test(filePath)) { this.failed = true; throw new Error('injected migration write failure'); }
    return super.enqueue(filePath, data);
  }
}

const markerApi = (marker: Map<string, string>) => ({ getItem: (key: string) => marker.get(key) ?? null, setItem: (key: string, value: string) => marker.set(key, value), removeItem: (key: string) => marker.delete(key) });

test('full migration reconstructs hierarchy, semantic page/canvas data, properties, and binaries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-migration-full-'));
  const { source, records } = fixture();
  const marker = new Map<string, string>();
  try {
    const target = destination(root);
    assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, target), markerApi(marker)), true);
    assert.equal(marker.get('dexie_migrated'), 'true');
    const metadata = JSON.parse(await readFile(path.join(target.workspaceDir, '.panvas', 'workspace.json'), 'utf8'));
    assert.deepEqual(metadata.folders, records.folders);
    assert.deepEqual(metadata.notebookPages, records.notebookPages);
    assert.deepEqual(JSON.parse(await readFile(path.join(target.workspaceDir, 'Notebooks', 'notebook-a', 'pages', 'page-text.content.json'), 'utf8')), records.notebookPageContents[0].data);
    assert.deepEqual(JSON.parse(await readFile(path.join(target.workspaceDir, 'Notebooks', 'notebook-a', 'pages', 'page-text.drawing.json'), 'utf8')), records.notebookPageDrawings[0].data);
    assert.deepEqual(JSON.parse(await readFile(path.join(target.workspaceDir, 'Notebooks', 'notebook-a', 'pages', 'page-pdf_pdf_1.drawing.json'), 'utf8')), records.notebookPageDrawings[1].data);
    const canvas = JSON.parse(await readFile(path.join(target.workspaceDir, 'Canvas', 'canvas-a.json'), 'utf8'));
    assert.deepEqual(canvas.elements, records.canvasData[0].elements);
    assert.deepEqual(canvas.customBlocks, records.customBlocks);
    assert.deepEqual([...await readFile(path.join(target.pdfStoreDir, 'pdf-a.bin'))], [...new Uint8Array(records.pdfFiles[0].data)]);
    assert.deepEqual([...await readFile(path.join(target.imageStoreDir, 'image-a.bin'))], [...new Uint8Array(records.imageFiles[0].data)]);
    assert.deepEqual([...await readFile(path.join(target.audioStoreDir, 'audio-a.bin'))], [...new Uint8Array(records.imageFiles[1].data)]);
    assert.equal(JSON.parse(await readFile(path.join(target.workspaceDir, '.panvas', 'system.json'), 'utf8')).migration_complete, true);
    assert.equal(records.notebookPageContents.length, 2, 'source fixture remains available');
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const [label, pattern] of [['page content', /\.content\.json$/], ['drawing', /\.drawing\.json$/], ['binary', /\.bin$/]] as const) {
  test(`${label} failure keeps completion false and retry succeeds`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-migration-fail-'));
    const { source, records } = fixture();
    const marker = new Map<string, string>();
    try {
      const failedTarget = destination(root, new FailOnceQueue(pattern));
      assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, failedTarget), markerApi(marker)), false);
      assert.equal(marker.has('dexie_migrated'), false);
      assert.equal(JSON.parse(await readFile(path.join(failedTarget.workspaceDir, '.panvas', 'system.json'), 'utf8')).migration_complete, false);
      assert.equal(records.pdfFiles[0].data.byteLength, 8, 'source binary remains intact');
      const retryTarget = destination(root);
      assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, retryTarget), markerApi(marker)), true);
      assert.equal(marker.get('dexie_migrated'), 'true');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('retry preserves newer destination data and rejects a conflicting binary', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-migration-existing-'));
  const { source } = fixture();
  try {
    const target = destination(root);
    assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, target)), true);
    const contentPath = path.join(target.workspaceDir, 'Notebooks', 'notebook-a', 'pages', 'page-text.content.json');
    const newer = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'newer destination edit' }] }] };
    await writeFile(contentPath, JSON.stringify(newer));
    const future = new Date(Date.now() + 60_000);
    await utimes(contentPath, future, future);
    assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, target)), true);
    assert.deepEqual(JSON.parse(await readFile(contentPath, 'utf8')), newer);
    await writeFile(path.join(target.pdfStoreDir, 'pdf-a.bin'), new Uint8Array([1, 2, 3]));
    await writeFile(path.join(target.workspaceDir, '.panvas', 'system.json'), JSON.stringify({
      version: 1, workspaceId: 'ws-a', migration_complete: false,
    }));
    assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, target)), false);
    assert.deepEqual([...await readFile(path.join(target.pdfStoreDir, 'pdf-a.bin'))], [1, 2, 3]);
    assert.equal(JSON.parse(await readFile(path.join(target.workspaceDir, '.panvas', 'system.json'), 'utf8')).migration_complete, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a completed canonical migration is a no-op that preserves newer filesystem work', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-migration-completed-'));
  const { source } = fixture();
  try {
    const target = destination(root);
    assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, target)), true);
    const metadataPath = path.join(target.workspaceDir, '.panvas', 'workspace.json');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    metadata.localOnlyProof = 'must-survive';
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    assert.equal(await runMigrationCoordinator(source, bundle => importDexieWorkspace(bundle, target)), true);
    assert.equal(JSON.parse(await readFile(metadataPath, 'utf8')).localOnlyProof, 'must-survive');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('migration directory allocation remains canonical across many same-name workspaces', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-migration-index-'));
  try {
    const destinations = new Set<string>();
    for (let index = 0; index < 120; index += 1) {
      const id = `ws-index-${index}`;
      const directory = await resolveMigrationWorkspaceDirectory(root, { id, name: 'My Workspace' });
      assert.equal(destinations.has(directory), false);
      destinations.add(directory);
      await mkdir(path.join(directory, '.panvas'), { recursive: true });
      await writeFile(path.join(directory, '.panvas', 'workspace.json'), JSON.stringify({ id, name: 'My Workspace' }));
    }
    assert.equal(destinations.size, 120);
    assert.equal(
      await resolveMigrationWorkspaceDirectory(root, { id: 'ws-index-80', name: 'My Workspace' }),
      [...destinations][80],
    );
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('purged empty system-default shells are not recreated from legacy Dexie', async () => {
  const shell = {
    id: 'ws-purged-shell', name: 'My Workspace', isSystem: true, systemType: 'default', userId: null,
    folders: [], canvasFiles: [{ id: 'canvas-shell', workspaceId: 'ws-purged-shell', name: 'Welcome Canvas' }],
    notebooks: [], notebookSections: [], notebookPages: [],
  };
  const source = Object.fromEntries([
    ['workspaces', table([shell])],
    ['canvasFiles', table(shell.canvasFiles)],
    ['canvasData', table([{ canvasFileId: 'canvas-shell', elements: [], appState: {}, files: {}, customBlocks: [] }])],
    ...['folders', 'customBlocks', 'notebooks', 'notebookSections', 'notebookPages', 'notebookPageContents', 'notebookPageDrawings', 'pdfFiles', 'imageFiles']
      .map(name => [name, table([])]),
  ]) as unknown as MigrationSource;
  const attempted: string[] = [];
  const marker = new Map<string, string>();
  assert.equal(await runMigrationCoordinator(source, async bundle => { attempted.push(bundle.workspace.id); return true; }, markerApi(marker)), true);
  assert.deepEqual(attempted, []);
  assert.equal(marker.get('dexie_migrated'), 'true');
});

test('legacy unmarked default shells collapse to one deterministic migration candidate', async () => {
  const makeShell = (id: string, createdAt: number) => ({
    id, name: 'My Workspace', createdAt, updatedAt: createdAt, userId: null,
    folders: [], canvasFiles: [{ id: `${id}-canvas`, workspaceId: id, name: 'Welcome Canvas', createdAt, updatedAt: createdAt }],
    notebooks: [], notebookSections: [], notebookPages: [],
  });
  const shells = [makeShell('ws-shell-new', now + 20), makeShell('ws-shell-old', now), makeShell('ws-shell-mid', now + 10)];
  const source = Object.fromEntries([
    ['workspaces', table(shells)],
    ['canvasFiles', table(shells.flatMap(shell => shell.canvasFiles))],
    ['canvasData', table(shells.map(shell => ({ canvasFileId: shell.canvasFiles[0].id, elements: [], appState: {}, files: {}, customBlocks: [] })))],
    ...['folders', 'customBlocks', 'notebooks', 'notebookSections', 'notebookPages', 'notebookPageContents', 'notebookPageDrawings', 'pdfFiles', 'imageFiles']
      .map(name => [name, table([])]),
  ]) as unknown as MigrationSource;
  const attempted: string[] = [];
  const marker = new Map<string, string>();
  assert.equal(await runMigrationCoordinator(source, async bundle => { attempted.push(bundle.workspace.id); return true; }, markerApi(marker)), true);
  assert.deepEqual(attempted, ['ws-shell-old']);
  assert.equal(marker.get('dexie_migrated'), 'true');
});

test('bootstrap, migration, filesystem discovery, and hydration stay idempotent for 100 starts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-bootstrap-idempotency-'));
  const legitimate = ['ws-real-a', 'ws-real-b', 'ws-real-c'].map((id, index) => ({
    id, name: `Real Workspace ${index + 1}`, createdAt: now + index, updatedAt: now + index, userId: null,
    folders: [], canvasFiles: [], notebooks: [], notebookSections: [], notebookPages: [],
  }));
  const markedDefault = {
    id: 'ws-marked-default', name: 'My Workspace', createdAt: now, updatedAt: now, userId: null,
    isSystem: true, systemType: 'default', folders: [],
    canvasFiles: [{ id: 'canvas-marked-default', workspaceId: 'ws-marked-default', name: 'Welcome Canvas' }],
    notebooks: [], notebookSections: [], notebookPages: [],
  };
  const legacyShells = Array.from({ length: 100 }, (_, index) => ({
    id: `ws-legacy-shell-${index}`, name: 'My Workspace', createdAt: now + 100 + index, updatedAt: now + 100 + index, userId: null,
    folders: [], canvasFiles: [{ id: `canvas-legacy-shell-${index}`, workspaceId: `ws-legacy-shell-${index}`, name: 'Welcome Canvas' }],
    notebooks: [], notebookSections: [], notebookPages: [],
  }));
  const allWorkspaces = [...legitimate, markedDefault, ...legacyShells];
  const source = Object.fromEntries([
    ['workspaces', table(allWorkspaces)],
    ['canvasFiles', table(allWorkspaces.flatMap(workspace => workspace.canvasFiles))],
    ['canvasData', table(allWorkspaces.flatMap(workspace => workspace.canvasFiles).map(canvas => ({ canvasFileId: canvas.id, elements: [], appState: {}, files: {}, customBlocks: [] })))],
    ...['folders', 'customBlocks', 'notebooks', 'notebookSections', 'notebookPages', 'notebookPageContents', 'notebookPageDrawings', 'pdfFiles', 'imageFiles']
      .map(name => [name, table([])]),
  ]) as unknown as MigrationSource;
  const queue = new WriteQueue();
  const marker = new Map<string, string>();
  const importWorkspace = async (bundle: any) => {
    const workspaceDir = await resolveMigrationWorkspaceDirectory(root, bundle.workspace);
    return importDexieWorkspace(bundle, {
      workspaceDir,
      pdfStoreDir: path.join(root, 'Assets', 'pdf-store'),
      imageStoreDir: path.join(root, 'Assets', 'image-store'),
      audioStoreDir: path.join(root, 'Assets', 'audio-store'),
      writeQueue: queue,
      registerWorkspace: () => undefined,
    });
  };
  const discoverIds = async () => {
    const entries = await import('node:fs/promises').then(fs => fs.readdir(root, { withFileTypes: true }));
    const ids: string[] = [];
    for (const entry of entries.filter(item => item.isDirectory())) {
      try { ids.push(JSON.parse(await readFile(path.join(root, entry.name, '.panvas', 'workspace.json'), 'utf8')).id); }
      catch { /* non-workspace support directories are ignored */ }
    }
    return ids.sort();
  };
  try {
    const expected = ['ws-real-a', 'ws-real-b', 'ws-real-c', 'ws-legacy-shell-0'].sort();
    for (let start = 0; start < 100; start += 1) {
      assert.equal(await runMigrationCoordinator(source, importWorkspace, markerApi(marker)), true);
      assert.deepEqual(await discoverIds(), expected);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a missing PDF referenced by page metadata is reported without a success marker', async () => {
  const { source, records } = fixture();
  records.pdfFiles.splice(0);
  const marker = new Map<string, string>();
  let imports = 0;
  assert.equal(await runMigrationCoordinator(source, async () => { imports++; return true; }, markerApi(marker)), false);
  assert.equal(imports, 0, 'invalid source must not reach the destination');
  assert.equal(marker.has('dexie_migrated'), false);
  assert.equal(records.notebookPages.length, 2, 'source hierarchy remains intact');
});

test('occupied My Workspace gets a distinct canonical-ID migration destination and preserves both roots', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-migration-collision-'));
  const occupied = path.join(root, 'My Workspace');
  const queue = new WriteQueue();
  try {
    await mkdir(path.join(occupied, '.panvas'), { recursive: true });
    await writeFile(path.join(occupied, '.panvas', 'workspace.json'), JSON.stringify({
      id: 'ws-local-existing', name: 'My Workspace', folders: [], canvasFiles: [], notebooks: [], notebookSections: [], notebookPages: [],
    }));

    const incoming = { id: 'ws-3jXUwJnvn-wQ', name: 'My Workspace', folders: [], canvasFiles: [], notebooks: [], notebookSections: [], notebookPages: [] };
    const workspaceDir = await resolveMigrationWorkspaceDirectory(root, incoming);
    assert.equal(workspaceDir, path.join(root, 'My Workspace (Migrated 2)'));
    await importDexieWorkspace({ workspace: incoming, canvasData: [], pageContents: [], pageDrawings: [], pdfFiles: [], imageFiles: [] }, {
      workspaceDir,
      pdfStoreDir: path.join(root, 'Assets', 'pdf-store'),
      imageStoreDir: path.join(root, 'Assets', 'image-store'),
      audioStoreDir: path.join(root, 'Assets', 'audio-store'),
      writeQueue: queue,
      registerWorkspace: () => undefined,
    });

    assert.equal(JSON.parse(await readFile(path.join(occupied, '.panvas', 'workspace.json'), 'utf8')).id, 'ws-local-existing');
    assert.equal(JSON.parse(await readFile(path.join(workspaceDir, '.panvas', 'workspace.json'), 'utf8')).id, 'ws-3jXUwJnvn-wQ');
    assert.equal(await resolveMigrationWorkspaceDirectory(root, incoming), workspaceDir, 'retry resolves by canonical ID, not display name');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('one rejected migration bundle does not prevent a later workspace root from registering', async () => {
  const workspaces = [
    { id: 'ws-rejected', name: 'My Workspace', folders: [], canvasFiles: [], notebooks: [], notebookSections: [], notebookPages: [] },
    { id: 'ws-3jXUwJnvn-wQ', name: 'is', folders: [], canvasFiles: [], notebooks: [], notebookSections: [], notebookPages: [] },
  ];
  const source = Object.fromEntries([
    ['workspaces', table(workspaces)],
    ...['folders', 'canvasFiles', 'canvasData', 'customBlocks', 'notebooks', 'notebookSections', 'notebookPages', 'notebookPageContents', 'notebookPageDrawings', 'pdfFiles', 'imageFiles']
      .map(name => [name, table([])]),
  ]) as unknown as MigrationSource;
  const attempted: string[] = [];
  const marker = new Map<string, string>();
  assert.equal(await runMigrationCoordinator(source, async bundle => {
    attempted.push(bundle.workspace.id);
    if (bundle.workspace.id === 'ws-rejected') throw new Error('injected destination rejection');
    return true;
  }, markerApi(marker)), false);
  assert.deepEqual(attempted, ['ws-rejected', 'ws-3jXUwJnvn-wQ']);
  assert.equal(marker.has('dexie_migrated'), false);
});

test('native remote batch applies the root first and accepts child deltas after canonical root registration', () => {
  const child = { kind: 'notebook' as const, id: 'nb-1', parentId: 'ws-3jXUwJnvn-wQ', payload: { id: 'nb-1', workspaceId: 'ws-3jXUwJnvn-wQ' }, tombstone: false };
  const root = { kind: 'workspace' as const, id: 'ws-3jXUwJnvn-wQ', parentId: null, payload: { id: 'ws-3jXUwJnvn-wQ', name: 'is' }, tombstone: false };
  assert.deepEqual(prepareRemoteWorkspaceRecords('ws-3jXUwJnvn-wQ', [child, root], false).map(record => record.kind), ['workspace', 'notebook']);
  assert.deepEqual(prepareRemoteWorkspaceRecords('ws-3jXUwJnvn-wQ', [child], true), [child]);
  assert.throws(
    () => prepareRemoteWorkspaceRecords('ws-3jXUwJnvn-wQ', [child], false),
    /root record is missing for local reconstruction/,
  );
  assert.throws(
    () => prepareRemoteWorkspaceRecords('ws-3jXUwJnvn-wQ', [{ ...root, payload: { ...root.payload, id: 'ws-other' } }], false),
    /root identity does not match the manifest workspace/,
  );
});

test('live workspace-root exceptions retain distinct sanitized diagnostics', () => {
  const context = {
    workspaceId: 'ws-3jXUwJnvn-wQ', entityKind: 'workspace' as const,
    entityId: 'ws-3jXUwJnvn-wQ', schemaVersion: 2,
    stage: 'local-record-apply', operation: 'apply-workspace',
    throwingFunction: 'WorkspaceService.applyRemoteRecords',
  };
  const collision = cloudApplyFailure(
    new Error('A different workspace already uses the destination folder My Workspace.'),
    context,
  );
  assert.equal(collision.diagnostic.reason, 'workspace-destination-collision');
  assert.equal(collision.diagnostic.errorMessage, 'Workspace_destination_is_already_owned_by_another_ID.');

  const missingRoot = cloudApplyFailure(
    new Error('Remote workspace root record is missing for local reconstruction.'),
    context,
  );
  assert.equal(missingRoot.diagnostic.reason, 'remote-workspace-root-missing');
  assert.equal(missingRoot.diagnostic.entityId, 'ws-3jXUwJnvn-wQ');
  assert.equal(missingRoot.diagnostic.errorClass, 'Error');
  assert.ok(missingRoot.diagnostic.throwingFunction, 'the diagnostic retains a sanitized throwing boundary');
});
