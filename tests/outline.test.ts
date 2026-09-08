import assert from 'node:assert/strict';
import test from 'node:test';
import { extractNotebookOutline, type OutlinePage } from '../src/components/notebook/outlineModel.ts';

const page = (id: string, sectionId: string, order: number, title: string, content?: unknown, drawing?: unknown): OutlinePage => ({
  id, notebookId: 'notebook-1', sectionId, order, title, content, drawing,
  createdAt: 0, updatedAt: order, userId: null,
} as OutlinePage);

const section = (id: string, order: number) => ({ id, notebookId: 'notebook-1', order, name: id, createdAt: 0, updatedAt: 0, isExpanded: true, userId: null } as any);

test('extracts H1, H2, and H3 headings from TipTap JSON', () => {
  const outline = extractNotebookOutline([
    page('page-1', 'section-1', 0, 'Planning', {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Overview' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Stretch goal' }] },
      ],
    }),
  ], [section('section-1', 0)]);

  assert.deepEqual(outline.filter(item => item.kind === 'heading').map(item => ({ title: item.title, level: item.level, pageNumber: item.pageNumber })), [
    { title: 'Overview', level: 1, pageNumber: 1 },
    { title: 'Goals', level: 2, pageNumber: 1 },
    { title: 'Stretch goal', level: 3, pageNumber: 1 },
  ]);
});

test('orders pages by section and page order and assigns page numbers across sections', () => {
  const outline = extractNotebookOutline([
    page('page-2', 'section-2', 0, 'Second'),
    page('page-1', 'section-1', 2, 'First', undefined, { objects: [{ type: 'text', content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Start' }] }] } }] }),
  ], [section('section-2', 1), section('section-1', 0)]);

  assert.deepEqual(outline.filter(item => item.kind === 'page').map(item => ({ pageId: item.pageId, title: item.title, pageNumber: item.pageNumber })), [
    { pageId: 'page-1', title: 'First', pageNumber: 1 },
    { pageId: 'page-2', title: 'Second', pageNumber: 2 },
  ]);
  assert.equal(outline.find(item => item.kind === 'heading')?.pageNumber, 1);
});

test('ignores empty content, unsupported heading levels, and malformed nodes', () => {
  const outline = extractNotebookOutline([
    page('page-1', 'section-1', 0, 'Empty', { type: 'doc', content: [{ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Ignore' }] }, { type: 'heading', attrs: { level: 2 }, content: [] }] }),
    page('page-2', 'section-1', 1, 'Still useful', { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }, null, 'not-a-node'] }),
  ], [section('section-1', 0)]);

  assert.equal(outline.filter(item => item.kind === 'heading').length, 0);
  assert.deepEqual(outline.filter(item => item.kind === 'page').map(item => item.title), ['Empty', 'Still useful']);
});

