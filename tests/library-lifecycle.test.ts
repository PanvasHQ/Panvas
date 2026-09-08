import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';
import {
  filterAndSortLibraryFiles,
  projectActiveLibraryFiles,
  projectLibraryTrashFiles,
} from '../src/components/library/libraryModel.ts';
import {
  getDeletedWorkspaceItems,
  setNotebookDeletedAt,
} from '../electron/ipc/workspace-trash.ts';
import { readLastAppRoute, readLastLibraryView, rememberAppRoute, rememberLibraryView } from '../src/services/library/libraryRouteState.ts';

const query = { view: 'library' as const, filter: 'all' as const, folderId: null, query: '', tag: null, sort: 'modified-desc' as const };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function workspaceDocument() {
  const workspace = { id: 'ws-a', name: 'Workspace A', createdAt: 1, updatedAt: 1, isPinned: false, deletedAt: null };
  const notebookA = { id: 'notebook-a', workspaceId: workspace.id, folderId: null, name: 'Notebook A', createdAt: 1, updatedAt: 1, order: 0, isExpanded: true, isPinned: false, deletedAt: null };
  const notebookC = { id: 'notebook-c', workspaceId: workspace.id, folderId: null, name: 'Notebook C', createdAt: 1, updatedAt: 1, order: 1, isExpanded: true, isPinned: false, deletedAt: null };
  const section = { id: 'section-a', notebookId: notebookA.id, name: 'Section A', createdAt: 1, updatedAt: 1, order: 0, isExpanded: true, deletedAt: null };
  const page = { id: 'page-a', notebookId: notebookA.id, sectionId: section.id, title: 'Page A', createdAt: 1, updatedAt: 1, order: 0, type: 'default', deletedAt: null };
  const canvas = { id: 'canvas-b', workspaceId: workspace.id, folderId: null, notebookId: null, sectionId: null, name: 'Canvas B', createdAt: 1, updatedAt: 1, order: 0, isPinned: false, deletedAt: null };
  return { workspaces: [workspace], folders: [], canvasFiles: [canvas], notebooks: [notebookA, notebookC], notebookSections: [section], notebookPages: [page] };
}

test('favorite, recent, delete, reload, and restore share one canonical Electron metadata lifecycle', () => {
  let persisted: any = workspaceDocument();

  persisted.notebooks.find((item: any) => item.id === 'notebook-a').isPinned = true;
  persisted = clone(persisted); // filesystem JSON reload boundary
  let live = projectActiveLibraryFiles({
    activeWorkspaceId: 'ws-a', notebooks: persisted.notebooks,
    notebookPages: persisted.notebookPages, canvasFiles: persisted.canvasFiles,
  }, 1_000);
  assert.deepEqual(filterAndSortLibraryFiles(live, { ...query, view: 'favorites' }).map(item => item.id), ['notebook-a']);

  persisted.notebooks.find((item: any) => item.id === 'notebook-a').lastOpenedAt = 100;
  persisted.canvasFiles.find((item: any) => item.id === 'canvas-b').lastOpenedAt = 200;
  persisted.notebooks.find((item: any) => item.id === 'notebook-c').lastOpenedAt = 300;
  persisted = clone(persisted);
  live = projectActiveLibraryFiles({ activeWorkspaceId: 'ws-a', notebooks: persisted.notebooks, notebookPages: persisted.notebookPages, canvasFiles: persisted.canvasFiles }, 1_000);
  assert.deepEqual(filterAndSortLibraryFiles(live, { ...query, view: 'recent' }).map(item => item.id), ['notebook-c', 'canvas-b', 'notebook-a']);

  persisted.notebooks.find((item: any) => item.id === 'notebook-a').lastOpenedAt = 400;
  persisted = clone(persisted);
  live = projectActiveLibraryFiles({ activeWorkspaceId: 'ws-a', notebooks: persisted.notebooks, notebookPages: persisted.notebookPages, canvasFiles: persisted.canvasFiles }, 1_000);
  assert.deepEqual(filterAndSortLibraryFiles(live, { ...query, view: 'recent' }).map(item => item.id), ['notebook-a', 'notebook-c', 'canvas-b']);

  assert.equal(setNotebookDeletedAt(persisted, 'notebook-a', 500, 500), true);
  persisted = clone(persisted);
  const deleted = getDeletedWorkspaceItems(persisted);
  assert.deepEqual(deleted.notebooks.map(item => item.id), ['notebook-a']);
  assert.deepEqual(deleted.sections, []);
  assert.deepEqual(deleted.pages, []);
  live = projectActiveLibraryFiles({ activeWorkspaceId: 'ws-a', notebooks: persisted.notebooks, notebookPages: persisted.notebookPages, canvasFiles: persisted.canvasFiles }, 1_000);
  assert.equal(live.some(item => item.id === 'notebook-a'), false);
  assert.equal(filterAndSortLibraryFiles(live, { ...query, view: 'favorites' }).some(item => item.id === 'notebook-a'), false);
  assert.deepEqual(projectLibraryTrashFiles({
    activeWorkspaceId: 'ws-a', workspaces: deleted.workspaces as any, folders: deleted.folders as any,
    canvasFiles: deleted.canvasFiles as any, notebooks: deleted.notebooks as any,
    sections: deleted.sections as any, pages: deleted.pages as any,
    activeNotebooks: persisted.notebooks, activeSections: persisted.notebookSections,
  }).map(item => item.id), ['notebook-a']);

  assert.equal(setNotebookDeletedAt(persisted, 'notebook-a', null, 600), true);
  persisted = clone(persisted);
  assert.deepEqual(getDeletedWorkspaceItems(persisted).notebooks, []);
  assert.equal(persisted.notebookSections.find((item: any) => item.id === 'section-a').deletedAt, null);
  assert.equal(persisted.notebookPages.find((item: any) => item.id === 'page-a').deletedAt, null);
  live = projectActiveLibraryFiles({ activeWorkspaceId: 'ws-a', notebooks: persisted.notebooks, notebookPages: persisted.notebookPages, canvasFiles: persisted.canvasFiles }, 1_000);
  assert.deepEqual(filterAndSortLibraryFiles(live, { ...query, view: 'favorites' }).map(item => item.id), ['notebook-a']);
});

test('Browse Trash projects every root kind across all workspaces', () => {
  const activeWorkspace = { id: 'ws-a', name: 'Active', updatedAt: 1, deletedAt: null };
  const deletedWorkspace = { id: 'ws-deleted', name: 'Deleted workspace', updatedAt: 1, deletedAt: 10 };
  const otherWorkspace = { id: 'ws-b', name: 'Other', updatedAt: 1, deletedAt: null };
  const sectionOwner = { id: 'nb-section-owner', workspaceId: 'ws-a', folderId: null, name: 'Section owner', updatedAt: 1, deletedAt: null };
  const pageOwner = { id: 'nb-page-owner', workspaceId: 'ws-a', folderId: null, name: 'Page owner', updatedAt: 1, deletedAt: null };
  const otherOwner = { id: 'nb-other-owner', workspaceId: 'ws-b', folderId: null, name: 'Other owner', updatedAt: 1, deletedAt: null };
  const activeSection = { id: 'active-section', notebookId: pageOwner.id, name: 'Active section', updatedAt: 1, deletedAt: null };
  const otherSection = { id: 'other-section', notebookId: otherOwner.id, name: 'Other section', updatedAt: 1, deletedAt: null };
  const data: any = {
    workspaces: [activeWorkspace, deletedWorkspace, otherWorkspace],
    folders: [{ id: 'folder-root', workspaceId: 'ws-a', parentId: null, name: 'Folder root', updatedAt: 1, deletedAt: 20 }],
    canvasFiles: [{ id: 'canvas-root', workspaceId: 'ws-a', folderId: null, name: 'Canvas root', updatedAt: 1, deletedAt: 21 }],
    notebooks: [
      sectionOwner, pageOwner, otherOwner,
      { id: 'notebook-root', workspaceId: 'ws-a', folderId: null, name: 'Notebook root', updatedAt: 1, deletedAt: 22 },
    ],
    notebookSections: [
      activeSection, otherSection,
      { id: 'section-root', notebookId: sectionOwner.id, name: 'Section root', updatedAt: 1, deletedAt: 23 },
    ],
    notebookPages: [
      { id: 'page-root', notebookId: pageOwner.id, sectionId: activeSection.id, title: 'Page root', type: 'default', updatedAt: 1, deletedAt: 24 },
      { id: 'other-page-root', notebookId: otherOwner.id, sectionId: otherSection.id, title: 'Other page', type: 'default', updatedAt: 1, deletedAt: 25 },
    ],
  };
  const roots = getDeletedWorkspaceItems(data);
  const files = projectLibraryTrashFiles({
    activeWorkspaceId: 'ws-a', workspaces: roots.workspaces as any, folders: roots.folders as any,
    canvasFiles: roots.canvasFiles as any, notebooks: roots.notebooks as any,
    sections: roots.sections as any, pages: roots.pages as any,
    activeNotebooks: [sectionOwner, pageOwner, otherOwner] as any,
    activeSections: [activeSection, otherSection] as any,
  });
  assert.deepEqual(new Set(files.map(item => item.type)), new Set(['workspace', 'folder', 'canvas', 'notebook', 'section', 'page']));
  assert.equal(files.some(item => item.id === 'other-page-root'), true);
  assert.deepEqual(files.map(item => item.trashKind), ['workspace', 'folder', 'notebook', 'section', 'page', 'page', 'canvas']);
});

test('restoring a notebook never resurrects a child that was directly deleted first', () => {
  let persisted: any = workspaceDocument();
  const page = persisted.notebookPages[0];
  page.deletedAt = 90;
  delete page.deletedByAncestorId;
  setNotebookDeletedAt(persisted, 'notebook-a', 100, 100);
  assert.equal(page.deletedAt, 90);
  assert.equal(page.deletedByAncestorId, undefined);
  setNotebookDeletedAt(persisted, 'notebook-a', null, 110);
  persisted = clone(persisted);
  assert.equal(persisted.notebookPages[0].deletedAt, 90);
  assert.deepEqual(getDeletedWorkspaceItems(persisted).pages.map(item => item.id), ['page-a']);
});

test('Library route and Browse view survive hydration without forcing Home', () => {
  const memory = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    },
  };
  try {
    rememberAppRoute('/app/library');
    rememberLibraryView('favorites');
    assert.equal(readLastAppRoute(), '/app/library');
    assert.equal(readLastLibraryView(), 'favorites');
    rememberAppRoute('/');
    assert.equal(readLastAppRoute(), '/app/library');
  } finally {
    delete (globalThis as any).window;
  }
});

test('workspace store actions persist through repository adapters and survive a canonical reload', async () => {
  let persisted: any = workspaceDocument();
  const memory = new Map<string, string>([['panvas.activeWorkspaceId', 'ws-a']]);
  const localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
  (globalThis as any).localStorage = localStorage;
  (globalThis as any).window = {
    localStorage,
    panvas: {
      trash: {
        getAll: async () => {
          const roots = getDeletedWorkspaceItems(persisted);
          return { ...roots, sections: roots.sections };
        },
      },
    },
  };

  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: 'custom',
    logLevel: 'silent',
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    server: { middlewareMode: true },
  });

  const originalNow = Date.now;
  const restorations: Array<() => void> = [() => { Date.now = originalNow; }];

  try {
    const [{ workspaceRepository }, { folderRepository }, { canvasRepository }, { notebookRepository }, { useWorkspaceStore }] = await Promise.all([
      server.ssrLoadModule('/src/repositories/WorkspaceRepository.ts'),
      server.ssrLoadModule('/src/repositories/FolderRepository.ts'),
      server.ssrLoadModule('/src/repositories/CanvasRepository.ts'),
      server.ssrLoadModule('/src/repositories/NotebookRepository.ts'),
      server.ssrLoadModule('/src/stores/workspaceStore.ts'),
    ]);

    let clock = 1_000;
    Date.now = () => ++clock;
    const replace = (object: any, key: string, implementation: (...args: any[]) => any) => {
      const original = object[key];
      object[key] = implementation;
      restorations.push(() => { object[key] = original; });
    };

    replace(workspaceRepository, 'getAll', async () => clone(persisted.workspaces.filter((item: any) => !item.deletedAt)));
    replace(folderRepository, 'getAll', async () => clone(persisted.folders.filter((item: any) => !item.deletedAt)));
    replace(canvasRepository, 'getAll', async () => clone(persisted.canvasFiles.filter((item: any) => !item.deletedAt)));
    replace(canvasRepository, 'getRecent', async () => clone(persisted.canvasFiles.filter((item: any) => !item.deletedAt).sort((a: any, b: any) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))));
    replace(canvasRepository, 'updateLastOpened', async (_workspaceId: string, id: string, openedAt: number) => {
      persisted.canvasFiles.find((item: any) => item.id === id).lastOpenedAt = openedAt;
    });
    replace(notebookRepository, 'getAll', async () => clone(persisted.notebooks.filter((item: any) => !item.deletedAt)));
    replace(notebookRepository, 'getSections', async () => clone(persisted.notebookSections.filter((item: any) => !item.deletedAt)));
    replace(notebookRepository, 'getPages', async () => clone(persisted.notebookPages.filter((item: any) => !item.deletedAt)));
    replace(notebookRepository, 'togglePin', async (_workspaceId: string, id: string, isPinned: boolean) => {
      persisted.notebooks.find((item: any) => item.id === id).isPinned = isPinned;
    });
    replace(notebookRepository, 'updateLastOpened', async (_workspaceId: string, id: string, openedAt: number) => {
      persisted.notebooks.find((item: any) => item.id === id).lastOpenedAt = openedAt;
    });
    replace(notebookRepository, 'updatePageLastOpened', async (_workspaceId: string, id: string, openedAt: number) => {
      const page = persisted.notebookPages.find((item: any) => item.id === id);
      if (!page) return;
      page.lastOpenedAt = openedAt;
      const notebook = persisted.notebooks.find((item: any) => item.id === page.notebookId);
      if (notebook) notebook.lastOpenedAt = openedAt;
    });
    replace(notebookRepository, 'delete', async (_workspaceId: string, id: string) => {
      setNotebookDeletedAt(persisted, id, Date.now(), Date.now());
    });
    replace(notebookRepository, 'restoreEntity', async (_workspaceId: string, id: string) => {
      setNotebookDeletedAt(persisted, id, null, Date.now());
    });

    const store = useWorkspaceStore.getState();
    store.reset();
    await useWorkspaceStore.getState().loadWorkspaces();
    assert.equal(useWorkspaceStore.getState().activeWorkspaceId, 'ws-a');

    await useWorkspaceStore.getState().togglePinNotebook('notebook-a');
    assert.equal(persisted.notebooks.find((item: any) => item.id === 'notebook-a').isPinned, true);
    assert.equal(useWorkspaceStore.getState().notebooks.find((item: any) => item.id === 'notebook-a').isPinned, true);

    useWorkspaceStore.getState().reset();
    await useWorkspaceStore.getState().loadWorkspaces();
    assert.equal(useWorkspaceStore.getState().notebooks.find((item: any) => item.id === 'notebook-a').isPinned, true, 'favorite survives store reload');

    await useWorkspaceStore.getState().setActiveNotebook('notebook-a');
    await useWorkspaceStore.getState().setActiveCanvas('canvas-b');
    await useWorkspaceStore.getState().setActiveNotebook('notebook-c');
    let projected = projectActiveLibraryFiles({
      activeWorkspaceId: 'ws-a', notebooks: useWorkspaceStore.getState().notebooks,
      notebookPages: useWorkspaceStore.getState().notebookPages, canvasFiles: useWorkspaceStore.getState().canvasFiles,
    }, 2_000);
    assert.deepEqual(filterAndSortLibraryFiles(projected, { ...query, view: 'recent' }).map(item => item.id), ['notebook-c', 'canvas-b', 'notebook-a']);
    await useWorkspaceStore.getState().setActiveNotebook('notebook-a');
    projected = projectActiveLibraryFiles({ activeWorkspaceId: 'ws-a', notebooks: useWorkspaceStore.getState().notebooks, notebookPages: [], canvasFiles: useWorkspaceStore.getState().canvasFiles }, 2_000);
    assert.deepEqual(filterAndSortLibraryFiles(projected, { ...query, view: 'recent' }).map(item => item.id), ['notebook-a', 'notebook-c', 'canvas-b']);

    await useWorkspaceStore.getState().deleteNotebook('notebook-a');
    assert.equal(useWorkspaceStore.getState().notebooks.some((item: any) => item.id === 'notebook-a'), false);
    assert.deepEqual(useWorkspaceStore.getState().deletedNotebooks.map((item: any) => item.id), ['notebook-a']);

    await useWorkspaceStore.getState().restoreItem('notebook-a', 'notebook');
    assert.equal(useWorkspaceStore.getState().deletedNotebooks.length, 0);
    assert.equal(useWorkspaceStore.getState().notebooks.find((item: any) => item.id === 'notebook-a').isPinned, true);

    useWorkspaceStore.getState().reset();
    await useWorkspaceStore.getState().loadWorkspaces();
    assert.equal(useWorkspaceStore.getState().notebooks.some((item: any) => item.id === 'notebook-a'), true, 'restored notebook survives reload');
  } finally {
    for (const restore of restorations.reverse()) restore();
    Date.now = originalNow;
    await server.close();
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
  }
});
