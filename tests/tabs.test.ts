import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDocumentTab, cycleDocumentTab, openDocumentTab, reorderDocumentTabs, splitDocumentTab, type DocumentTab } from '../src/stores/documentTabs.ts';

const notebook: DocumentTab = { id: 'page-1', type: 'notebook', title: 'Notes', pageId: 'page-1' };
const pdf: DocumentTab = { id: 'page-2', type: 'pdf', title: 'Reference.pdf', pageId: 'page-2' };
const canvas: DocumentTab = { id: 'canvas-1', type: 'canvas', title: 'Diagram' };

test('opening tabs activates and deduplicates documents', () => {
  const first = openDocumentTab([], notebook);
  assert.deepEqual(first.tabs.map(tab => tab.id), ['page-1']);
  assert.equal(first.activeTabId, 'page-1');

  const second = openDocumentTab(first.tabs, pdf);
  assert.deepEqual(second.tabs.map(tab => tab.id), ['page-1', 'page-2']);
  assert.equal(second.activeTabId, 'page-2');

  const duplicate = openDocumentTab(second.tabs, { ...notebook, title: 'Renamed notes' });
  assert.deepEqual(duplicate.tabs.map(tab => tab.title), ['Renamed notes', 'Reference.pdf']);
  assert.equal(duplicate.activeTabId, 'page-1');
});

test('closing tabs chooses the nearest adjacent active tab and preserves inactive state', () => {
  const tabs = [notebook, pdf, canvas];
  const inactive = closeDocumentTab(tabs, 'page-1', 'page-2');
  assert.deepEqual(inactive.tabs.map(tab => tab.id), ['page-1', 'canvas-1']);
  assert.equal(inactive.activeTabId, 'page-1');

  const active = closeDocumentTab(tabs, 'page-2', 'page-2');
  assert.deepEqual(active.tabs.map(tab => tab.id), ['page-1', 'canvas-1']);
  assert.equal(active.activeTabId, 'canvas-1');

  const last = closeDocumentTab([notebook], 'page-1', 'page-1');
  assert.equal(last.activeTabId, null);
});

test('tabs reorder, cycle, and pair a page tab for split view', () => {
  const tabs = [notebook, pdf, canvas];
  assert.deepEqual(reorderDocumentTabs(tabs, 0, 2).map(tab => tab.id), ['page-2', 'canvas-1', 'page-1']);
  assert.equal(cycleDocumentTab(tabs, 'page-1', 1), 'page-2');
  assert.equal(cycleDocumentTab(tabs, 'page-1', -1), 'canvas-1');
  assert.deepEqual(splitDocumentTab(tabs, 'page-2'), { pageId: 'page-2' });
  assert.equal(splitDocumentTab(tabs, 'canvas-1'), null);
});
