import assert from 'node:assert/strict';
import test from 'node:test';
import { filterAndSortLibraryFiles, getLibraryTags, projectLibraryTrashFiles, type LibraryFile } from '../src/components/library/libraryModel.ts';
import { normalizeFolderAppearance } from '../src/types/workspace.ts';

const files: LibraryFile[] = [
  { id: 'notebook-a', workspaceId: 'ws', folderId: 'research', type: 'notebook', title: 'Alpha notes', modified: 'Edited yesterday', size: '4 pages', pageCount: 4, tags: ['Research', 'Favorite'], owner: 'Local', updatedAt: 200, lastOpenedAt: 200, isFavorite: true },
  { id: 'canvas-b', workspaceId: 'ws', folderId: 'design', type: 'canvas', title: 'Beta board', modified: 'Edited today', size: 'Infinite canvas', tags: ['Diagram'], owner: 'Local', updatedAt: 300, lastOpenedAt: 300, isFavorite: false },
  { id: 'pdf-c', workspaceId: 'ws', folderId: 'research', type: 'pdf', title: 'Gamma paper', modified: 'Edited last week', size: 'PDF document', pageCount: 1, tags: ['Research', 'PDF'], owner: 'Local', updatedAt: 100, lastOpenedAt: 100, isFavorite: false },
];

const defaultQuery = { view: 'library' as const, filter: 'all' as const, folderId: null, query: '', tag: null, sort: 'modified-desc' as const };

test('Library filters files immediately by interactive tag and folder', () => {
  const tagged = filterAndSortLibraryFiles(files, { ...defaultQuery, tag: 'research' });
  assert.deepEqual(tagged.map(file => file.id), ['notebook-a', 'pdf-c']);

  const inFolder = filterAndSortLibraryFiles(files, { ...defaultQuery, folderId: 'design' });
  assert.deepEqual(inFolder.map(file => file.id), ['canvas-b']);
  assert.deepEqual(getLibraryTags(files), ['Diagram', 'Favorite', 'PDF', 'Research']);
});

test('Library sorts by name, modification order, and type deterministically', () => {
  assert.deepEqual(filterAndSortLibraryFiles(files, { ...defaultQuery, sort: 'name-asc' }).map(file => file.title), ['Alpha notes', 'Beta board', 'Gamma paper']);
  assert.deepEqual(filterAndSortLibraryFiles(files, { ...defaultQuery, sort: 'modified-asc' }).map(file => file.id), ['pdf-c', 'notebook-a', 'canvas-b']);
  assert.deepEqual(filterAndSortLibraryFiles(files, { ...defaultQuery, sort: 'type-asc' }).map(file => file.type), ['canvas', 'notebook', 'pdf']);
});

test('Folder appearance accepts valid custom colors and supported icons only', () => {
  assert.deepEqual(normalizeFolderAppearance({ color: '#12abEF', icon: 'briefcase' }), { color: '#12ABEF', icon: 'briefcase' });
  assert.deepEqual(normalizeFolderAppearance({ color: 'blue', icon: 'rocket' as never }), { color: undefined, icon: undefined });
});

test('Library recent view orders items strictly by newest activity first', () => {
  const recent = filterAndSortLibraryFiles(files, { ...defaultQuery, view: 'recent' });
  assert.deepEqual(recent.map(file => file.id), ['canvas-b', 'notebook-a', 'pdf-c']);
});

test('Library favorites view filters items by isFavorite across content types', () => {
  const favorites = filterAndSortLibraryFiles(files, { ...defaultQuery, view: 'favorites' });
  assert.deepEqual(favorites.map(file => file.id), ['notebook-a']);
  assert.equal(favorites[0].isFavorite, true);
});

test('Library recent view dynamically promotes newly opened items to the top', () => {
  // Initial order: canvas-b (300), notebook-a (200), pdf-c (100)
  const initialRecent = filterAndSortLibraryFiles(files, { ...defaultQuery, view: 'recent' });
  assert.deepEqual(initialRecent.map(f => f.id), ['canvas-b', 'notebook-a', 'pdf-c']);

  // Simulate user opening notebook-a at timestamp 500
  const updatedFiles = files.map(f => f.id === 'notebook-a' ? { ...f, lastOpenedAt: 500 } : f);
  const afterOpen = filterAndSortLibraryFiles(updatedFiles, { ...defaultQuery, view: 'recent' });
  assert.deepEqual(afterOpen.map(f => f.id), ['notebook-a', 'canvas-b', 'pdf-c']);
});

test('Library recent view falls back to canonical modification time for legacy records', () => {
  const neverOpened = { ...files[0], id: 'never-opened', updatedAt: 150, lastOpenedAt: undefined };
  const recent = filterAndSortLibraryFiles([neverOpened, ...files], { ...defaultQuery, view: 'recent' });
  assert.deepEqual(recent.map(file => file.id), ['canvas-b', 'notebook-a', 'never-opened', 'pdf-c']);
});

test('Library browse view switching updates active view and selects corresponding items', () => {
  // 1. Default: Library active (all non-deleted files)
  let currentView: 'library' | 'recent' | 'favorites' | 'trash' = 'library';
  let result = filterAndSortLibraryFiles(files, { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'library');
  assert.equal(result.length, 3);

  // 2. Click Recent: Recent active + Recent content selected
  currentView = 'recent';
  result = filterAndSortLibraryFiles(files, { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'recent');
  assert.deepEqual(result.map(f => f.id), ['canvas-b', 'notebook-a', 'pdf-c']);

  // 3. Click Favorites: Favorites active + Favorites content selected
  currentView = 'favorites';
  result = filterAndSortLibraryFiles(files, { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'favorites');
  assert.deepEqual(result.map(f => f.id), ['notebook-a']);

  // 4. Click Trash: Trash active + Trash content selected
  currentView = 'trash';
  const trashItems: LibraryFile[] = [
    { id: 'deleted-1', workspaceId: 'ws', folderId: null, type: 'notebook', title: 'Deleted Doc', modified: 'In Trash', size: 'Restorable', tags: ['Deleted'], owner: 'Local', updatedAt: 50, isFavorite: false },
  ];
  result = filterAndSortLibraryFiles(trashItems, { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'trash');
  assert.deepEqual(result.map(f => f.id), ['deleted-1']);

  // 5. Click Library: Library active again
  currentView = 'library';
  result = filterAndSortLibraryFiles(files, { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'library');
  assert.equal(result.length, 3);
});

test('Empty Favorites and Trash can become active views without reverting to Library', () => {
  // Empty favorites
  const noFavoritesFiles: LibraryFile[] = [
    { id: 'doc-1', workspaceId: 'ws', folderId: null, type: 'notebook', title: 'Doc', modified: 'today', size: '1 page', pageCount: 1, tags: [], owner: 'Local', updatedAt: 100, isFavorite: false },
  ];
  let currentView: 'library' | 'recent' | 'favorites' | 'trash' = 'favorites';
  let result = filterAndSortLibraryFiles(noFavoritesFiles, { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'favorites');
  assert.equal(result.length, 0); // Empty result, but view remains 'favorites'

  // Empty trash
  currentView = 'trash';
  result = filterAndSortLibraryFiles([], { ...defaultQuery, view: currentView });
  assert.equal(currentView, 'trash');
  assert.equal(result.length, 0); // Empty result, but view remains 'trash'
});

test('projectLibraryTrashFiles calculates real retention countdown from persisted deletedAt', () => {
  const DAY_MS = 86_400_000;
  const deletedAtTime = 1_000 * DAY_MS;
  const data = {
    activeWorkspaceId: 'ws-1',
    workspaces: [],
    folders: [],
    canvasFiles: [],
    notebooks: [
      {
        id: 'nb-fresh',
        workspaceId: 'ws-1',
        folderId: null,
        name: 'Freshly Deleted Notebook',
        createdAt: 1,
        updatedAt: deletedAtTime,
        deletedAt: deletedAtTime,
        order: 0,
        isPinned: false,
      },
      {
        id: 'nb-18days',
        workspaceId: 'ws-1',
        folderId: null,
        name: 'Older Deleted Notebook',
        createdAt: 1,
        updatedAt: deletedAtTime - 12 * DAY_MS,
        deletedAt: deletedAtTime - 12 * DAY_MS,
        order: 1,
        isPinned: false,
      },
      {
        id: 'nb-missing-date',
        workspaceId: 'ws-1',
        folderId: null,
        name: 'Missing Date Notebook',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        order: 2,
        isPinned: false,
      },
    ],
    sections: [],
    pages: [],
  };

  // Projection at deletion time (0 ms elapsed)
  const filesAtDeletion = projectLibraryTrashFiles(data as any, deletedAtTime);
  const freshItem = filesAtDeletion.find(item => item.id === 'nb-fresh');
  assert.equal(freshItem?.modified, 'In Trash');
  assert.equal(freshItem?.size, 'Deletes permanently in 30 days');

  const olderItem = filesAtDeletion.find(item => item.id === 'nb-18days');
  assert.equal(olderItem?.modified, 'In Trash');
  assert.equal(olderItem?.size, 'Deletes permanently in 18 days');

  const missingItem = filesAtDeletion.find(item => item.id === 'nb-missing-date');
  assert.equal(missingItem?.size, 'Deletion date unavailable');

  // Advance time by 28 days: freshItem now has 2 days remaining, olderItem is purge eligible
  const filesAfter28Days = projectLibraryTrashFiles(data as any, deletedAtTime + 28 * DAY_MS);
  const freshAfter28 = filesAfter28Days.find(item => item.id === 'nb-fresh');
  assert.equal(freshAfter28?.size, 'Deletes permanently in 2 days');

  const olderAfter28 = filesAfter28Days.find(item => item.id === 'nb-18days');
  assert.equal(olderAfter28?.size, 'Deletes permanently today');

  // Advance time by 29 days: freshItem now has 1 day remaining => 'Deletes permanently tomorrow'
  const filesAfter29Days = projectLibraryTrashFiles(data as any, deletedAtTime + 29 * DAY_MS);
  const freshAfter29 = filesAfter29Days.find(item => item.id === 'nb-fresh');
  assert.equal(freshAfter29?.size, 'Deletes permanently tomorrow');
});
