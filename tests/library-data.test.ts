import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAncestorDeletion,
  getTrashRoots,
  markDeletedByAncestor,
  markDirectlyDeleted,
} from '../src/services/library/trashModel.ts';

function record(id: string, extra: Record<string, unknown> = {}) {
  return { id, updatedAt: 1, deletedAt: null, ...extra };
}

test('trash exposes one notebook root and suppresses cascaded descendants', () => {
  const notebook = record('notebook-a', { workspaceId: 'ws' });
  const section = record('section-a', { notebookId: 'notebook-a' });
  const page = record('page-a', { notebookId: 'notebook-a', sectionId: 'section-a' });
  const canvas = record('canvas-a', { workspaceId: 'ws', notebookId: 'notebook-a' });
  markDirectlyDeleted(notebook, 10);
  markDeletedByAncestor(section, 10, notebook.id);
  markDeletedByAncestor(page, 10, notebook.id);
  markDeletedByAncestor(canvas, 10, notebook.id);

  const roots = getTrashRoots({
    workspaces: [record('ws', { deletedAt: null })],
    folders: [], canvasFiles: [canvas], notebooks: [notebook],
    notebookSections: [section], notebookPages: [page],
  });
  assert.deepEqual(roots.notebooks.map(item => item.id), ['notebook-a']);
  assert.deepEqual(roots.sections, []);
  assert.deepEqual(roots.pages, []);
  assert.deepEqual(roots.canvasFiles, []);
});

test('direct page and section deletion remain independent trash roots', () => {
  const notebook = record('notebook-a', { workspaceId: 'ws' });
  const section = record('section-a', { notebookId: notebook.id });
  const page = record('page-a', { notebookId: notebook.id, sectionId: section.id });
  markDirectlyDeleted(section, 20);
  markDeletedByAncestor(page, 20, section.id);
  const roots = getTrashRoots({ workspaces: [record('ws')], folders: [], canvasFiles: [], notebooks: [notebook], notebookSections: [section], notebookPages: [page] });
  assert.deepEqual(roots.sections.map(item => item.id), ['section-a']);
  assert.deepEqual(roots.pages, []);

  clearAncestorDeletion(page, section.id, 30);
  section.deletedAt = null;
  delete section.deletedByAncestorId;
  markDirectlyDeleted(page, 40);
  const pageRoots = getTrashRoots({ workspaces: [record('ws')], folders: [], canvasFiles: [], notebooks: [notebook], notebookSections: [section], notebookPages: [page] });
  assert.deepEqual(pageRoots.pages.map(item => item.id), ['page-a']);
});

test('folder deletion suppresses nested notebooks and canvases and restore clears only its cascade marker', () => {
  const folder = record('folder-a', { workspaceId: 'ws', parentId: null });
  const child = record('folder-b', { workspaceId: 'ws', parentId: folder.id });
  const notebook = record('notebook-a', { workspaceId: 'ws', folderId: child.id });
  const canvas = record('canvas-a', { workspaceId: 'ws', folderId: child.id });
  markDirectlyDeleted(folder, 50);
  markDeletedByAncestor(child, 50, folder.id);
  markDeletedByAncestor(notebook, 50, folder.id);
  markDeletedByAncestor(canvas, 50, folder.id);
  const roots = getTrashRoots({ workspaces: [record('ws')], folders: [folder, child], canvasFiles: [canvas], notebooks: [notebook] });
  assert.deepEqual(roots.folders.map(item => item.id), ['folder-a']);
  assert.deepEqual(roots.notebooks, []);
  assert.deepEqual(roots.canvasFiles, []);
  clearAncestorDeletion(child, folder.id, 60);
  clearAncestorDeletion(notebook, folder.id, 60);
  clearAncestorDeletion(canvas, folder.id, 60);
  folder.deletedAt = null;
  delete folder.deletedByAncestorId;
  assert.equal(child.deletedAt, null);
  assert.equal(notebook.deletedAt, null);
  assert.equal(canvas.deletedAt, null);
});

test('legacy deleted descendants are suppressed from roots by persisted geometry', () => {
  const notebook = record('notebook-a', { workspaceId: 'ws', deletedAt: 70 });
  const page = record('page-a', { notebookId: notebook.id, sectionId: 'section-a', deletedAt: 70 });
  const section = record('section-a', { notebookId: notebook.id, deletedAt: 70 });
  const roots = getTrashRoots({ workspaces: [record('ws')], folders: [], canvasFiles: [], notebooks: [notebook], notebookSections: [section], notebookPages: [page] });
  assert.deepEqual(roots.notebooks.map(item => item.id), ['notebook-a']);
  assert.deepEqual(roots.sections, []);
  assert.deepEqual(roots.pages, []);
});
