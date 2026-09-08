import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspaceBackup, parseWorkspaceBackup, remapWorkspaceBackup, serializeWorkspaceBackup, type BackupSource } from '../src/services/backup/backupService.ts';

const source: BackupSource = {
  workspace: { id: 'ws-1', name: 'Research', createdAt: 1, updatedAt: 2, isPinned: false, syncStatus: 'local', userId: null, deletedAt: null },
  folders: [{ id: 'folder-1', workspaceId: 'ws-1', parentId: null, name: 'Notes', createdAt: 1, updatedAt: 2, order: 0, syncStatus: 'local', userId: null, deletedAt: null }],
  notebooks: [{ id: 'notebook-1', workspaceId: 'ws-1', folderId: 'folder-1', name: 'Daily', createdAt: 1, updatedAt: 2, order: 0, isExpanded: true, userId: null }],
  sections: [{ id: 'section-1', notebookId: 'notebook-1', name: 'General', createdAt: 1, updatedAt: 2, order: 0, isExpanded: true, userId: null }],
  pages: [{ id: 'page-1', notebookId: 'notebook-1', sectionId: 'section-1', title: 'Today', createdAt: 1, updatedAt: 2, order: 0, userId: null }],
  canvases: [{ id: 'canvas-1', workspaceId: 'ws-1', folderId: null, name: 'Plan', createdAt: 1, updatedAt: 2, lastOpenedAt: 2, order: 0, isPinned: false, syncStatus: 'local', userId: null, deletedAt: null }],
  pagePayloads: { 'page-1': { drawing: { strokes: [{ x: 10, y: 20 }] }, content: { type: 'doc', content: [{ type: 'paragraph' }] } } },
  canvasPayloads: { 'canvas-1': { canvasFileId: 'canvas-1', elements: [{ id: 'element-1' }], appState: { zoom: 1 }, files: {}, customBlocks: [], version: 1, updatedAt: 2, userId: null } },
};

test('backup serializes metadata, page payloads, and canvas payloads', () => {
  const backup = buildWorkspaceBackup(source, 123);
  const parsed = parseWorkspaceBackup(serializeWorkspaceBackup(backup));
  assert.equal(parsed.header.type, 'panvas/workspace-backup');
  assert.equal(parsed.header.exportedAt, 123);
  assert.equal(parsed.notebooks.length, 1);
  assert.deepEqual(parsed.pagePayloads['page-1'].drawing, source.pagePayloads['page-1'].drawing);
  assert.deepEqual(parsed.canvasPayloads['canvas-1'].elements, source.canvasPayloads['canvas-1'].elements);
});

test('backup rejects malformed JSON and invalid schema', () => {
  assert.throws(() => parseWorkspaceBackup('{not json'), /JSON is malformed/);
  assert.throws(() => parseWorkspaceBackup({ ...source, header: { ...buildWorkspaceBackup(source).header, type: 'other' } }), /header is invalid/);
  assert.throws(() => parseWorkspaceBackup({ ...buildWorkspaceBackup(source), pagePayloads: {} }), /page payload is missing/);
});

test('restore remaps ids and relationships while preserving payload content', () => {
  const restored = remapWorkspaceBackup(buildWorkspaceBackup(source), { idFactory: prefix => `${prefix}-new`, workspaceName: 'Research Restored', userId: 'user-1', now: 99 });
  assert.equal(restored.workspace.name, 'Research Restored');
  assert.equal(restored.folders.length, source.folders.length);
  assert.equal(restored.notebooks.length, source.notebooks.length);
  assert.equal(restored.sections.length, source.sections.length);
  assert.equal(restored.pages.length, source.pages.length);
  assert.equal(restored.canvases.length, source.canvases.length);
  assert.notEqual(restored.workspace.id, source.workspace.id);
  assert.equal(restored.folders[0].workspaceId, restored.workspace.id);
  assert.equal(restored.notebooks[0].workspaceId, restored.workspace.id);
  assert.equal(restored.pages[0].notebookId, restored.notebooks[0].id);
  assert.equal(restored.sections[0].notebookId, restored.notebooks[0].id);
  assert.deepEqual(restored.pagePayloads[restored.pages[0].id].content, source.pagePayloads['page-1'].content);
  assert.equal(restored.canvasPayloads[restored.canvases[0].id].canvasFileId, restored.canvases[0].id);
  assert.equal(restored.workspace.userId, 'user-1');
});
