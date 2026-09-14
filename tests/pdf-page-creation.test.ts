import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createNotebookPageFiles } from '../electron/ipc/notebook-page-create.ts';
import { WriteQueue } from '../electron/ipc/write-queue.ts';

test('Electron repository creates default and PDF pages in one canonical IPC call', async () => {
  const server = await createServer({
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true },
    resolve: { alias: { '@': path.join(process.cwd(), 'src') } },
  });
  const calls: unknown[][] = [];
  const previousWindow = globalThis.window;
  try {
    const pageApi = {
      create: async (...args: unknown[]) => {
        calls.push(args);
        return { id: `page-${calls.length}`, notebookId: args[1], sectionId: args[2], title: args[3], type: args[4], pdfDataId: args[5] };
      },
      update: async () => { throw new Error('creation must not issue an update'); },
    };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { panvas: { notebookPage: pageApi } } });
    const { NotebookRepository } = await server.ssrLoadModule('/src/repositories/NotebookRepository.ts');
    const repository = new NotebookRepository();
    const ordinary = await repository.createPage(null, 'ws-1', 'notebook-1', 'section-1', 'Ordinary');
    const pdf = await repository.createPage(null, 'ws-1', 'notebook-1', 'section-1', 'PDF', 'pdf', 'pdf-asset-1');
    assert.equal(ordinary.type, 'default');
    assert.equal(pdf.pdfDataId, 'pdf-asset-1');
    assert.deepEqual(calls, [
      ['ws-1', 'notebook-1', 'section-1', 'Ordinary', 'default', undefined],
      ['ws-1', 'notebook-1', 'section-1', 'PDF', 'pdf', 'pdf-asset-1'],
    ]);
  } finally {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
    await server.close();
  }
});

test('PDF page creation persists its association in the initial workspace and page writes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'panvas-pdf-page-'));
  try {
    const workspace = { notebookPages: [] as Array<Record<string, unknown>> };
    const queue = new WriteQueue();
    const workspacePath = path.join(root, 'workspace.json');
    const page = await createNotebookPageFiles({
      workspaceDir: root,
      workspace,
      notebookId: 'notebook-1',
      sectionId: 'section-1',
      title: 'Imported PDF',
      type: 'pdf',
      pdfDataId: 'pdf-asset-1',
      pageId: 'page-1',
      now: 42,
      writeWorkspace: () => writeFile(workspacePath, JSON.stringify(workspace)),
      writeQueue: queue,
    });
    const persistedWorkspace = JSON.parse(await readFile(workspacePath, 'utf8'));
    const persistedPage = JSON.parse(await readFile(path.join(root, 'Notebooks', 'notebook-1', 'pages', 'page-1.json'), 'utf8'));
    assert.equal(page.pdfDataId, 'pdf-asset-1');
    assert.equal(persistedWorkspace.notebookPages[0].pdfDataId, 'pdf-asset-1');
    assert.equal(persistedPage.type, 'pdf');
    assert.equal(persistedPage.pdfDataId, 'pdf-asset-1');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
