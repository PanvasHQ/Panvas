import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextGeneratedPageTitle, isGeneratedPagePlaceholder } from '../src/lib/notebookPageNaming.ts';

const pages = (...titles: string[]) => titles.map(title => ({ title }));

test('empty section starts at Page 1', () => {
  assert.equal(getNextGeneratedPageTitle([]), 'Page 1');
});

test('generated names advance monotonically', () => {
  assert.equal(getNextGeneratedPageTitle(pages('Page 1')), 'Page 2');
  assert.equal(getNextGeneratedPageTitle(Array.from({ length: 20 }, (_, i) => ({ title: `Page ${i + 1}` }))), 'Page 21');
  assert.equal(getNextGeneratedPageTitle(pages('Page 1', 'Page 2', 'Page 4')), 'Page 5');
});

test('delete/create never reuses an earlier generated title', () => {
  assert.equal(getNextGeneratedPageTitle(pages('Page 1', 'Page 2', 'Page 4')), 'Page 5');
});

test('user titles are preserved and do not affect numbering', () => {
  assert.equal(getNextGeneratedPageTitle(pages('Page 1', 'Mathematics', 'Page 3')), 'Page 4');
  assert.equal(getNextGeneratedPageTitle(pages('Research', 'Notes')), 'Page 1');
});

test('reordering does not change the next title and collisions are case-insensitive', () => {
  assert.equal(getNextGeneratedPageTitle(pages('Page 5', 'page 2', 'Page 1')), 'Page 6');
  assert.equal(getNextGeneratedPageTitle(pages('PAGE 1', 'Page 2')), 'Page 3');
});

test('the legacy placeholder is replaced only for generated requests', () => {
  assert.equal(isGeneratedPagePlaceholder('New page'), true);
  assert.equal(isGeneratedPagePlaceholder(''), true);
  assert.equal(isGeneratedPagePlaceholder('Mathematics'), false);
});
