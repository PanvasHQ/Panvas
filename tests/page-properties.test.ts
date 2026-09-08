import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  capturePageGeometryAnchor,
  derivePagePropertyOverrides,
  getNotebookPageDefaults,
  resolveNotebookPageLayout,
  resolvePageDimensions,
  resolvePageGeometryScrollDelta,
  resolvePageProperties,
} from '../src/lib/pageProperties.ts';
import { DEFAULT_PAGE_PROPERTY_SET, type Notebook, type NotebookPage } from '../src/types/notebook.ts';

const notebook: Notebook = {
  id: 'notebook-test', workspaceId: 'workspace-test', folderId: null, name: 'Test',
  createdAt: 1, updatedAt: 1, order: 0, isExpanded: true, userId: null,
  defaultPageProperties: { ...DEFAULT_PAGE_PROPERTY_SET, template: 'Ruled', paperColor: '#fff9c4' },
};

const page: NotebookPage = {
  id: 'page-test', notebookId: notebook.id, sectionId: 'section-test', title: 'Page',
  createdAt: 1, updatedAt: 1, order: 0, userId: null,
};

test('legacy pages retain persisted drawing properties until metadata inheritance is established', () => {
  const resolved = resolvePageProperties(notebook, page, {
    ...DEFAULT_PAGE_PROPERTY_SET,
    template: 'Dotted',
  });
  assert.equal(resolved.template, 'Dotted');
  assert.equal(resolved.paperColor, '#ffffff');
});

test('new pages inherit notebook defaults and store only differences', () => {
  const inheritedPage = { ...page, pagePropertyOverrides: {} };
  const inherited = resolvePageProperties(notebook, inheritedPage, {
    ...DEFAULT_PAGE_PROPERTY_SET,
    template: 'Dotted',
  });
  assert.deepEqual(inherited, getNotebookPageDefaults(notebook));

  const edited = { ...inherited, margins: 'Wide' as const, paperColor: '#ffffff' };
  assert.deepEqual(derivePagePropertyOverrides(edited, notebook), {
    paperColor: '#ffffff',
    margins: 'Wide',
  });
});

test('page overrides win over notebook defaults deterministically', () => {
  const resolved = resolvePageProperties(notebook, {
    ...page,
    pagePropertyOverrides: { orientation: 'landscape', template: 'Engineering' },
  });
  assert.equal(resolved.paperColor, '#fff9c4');
  assert.equal(resolved.orientation, 'landscape');
  assert.equal(resolved.template, 'Engineering');
});

test('editable template field values are page-specific persisted overrides', () => {
  const properties = {
    ...getNotebookPageDefaults(notebook),
    template: 'Journal' as const,
    templateFields: { date: '8 September', 'mood-weather': 'Clear' },
  };
  const overrides = derivePagePropertyOverrides(properties, notebook);
  assert.deepEqual(overrides.templateFields, { date: '8 September', 'mood-weather': 'Clear' });
  assert.deepEqual(resolvePageProperties(notebook, { ...page, pagePropertyOverrides: overrides }).templateFields, properties.templateFields);
});

test('A4, A5, and Letter dimensions resolve independently in both orientations', () => {
  assert.deepEqual(resolvePageDimensions({ ...DEFAULT_PAGE_PROPERTY_SET, pageSize: 'A4' }), { width: 794, height: 1123 });
  assert.deepEqual(resolvePageDimensions({ ...DEFAULT_PAGE_PROPERTY_SET, pageSize: 'A4', orientation: 'landscape' }), { width: 1123, height: 794 });
  assert.deepEqual(resolvePageDimensions({ ...DEFAULT_PAGE_PROPERTY_SET, pageSize: 'A5' }), { width: 595, height: 842 });
  assert.deepEqual(resolvePageDimensions({ ...DEFAULT_PAGE_PROPERTY_SET, pageSize: 'A5', orientation: 'landscape' }), { width: 842, height: 595 });
  assert.deepEqual(resolvePageDimensions({ ...DEFAULT_PAGE_PROPERTY_SET, pageSize: 'Letter' }), { width: 816, height: 1056 });
  assert.deepEqual(resolvePageDimensions({ ...DEFAULT_PAGE_PROPERTY_SET, pageSize: 'Letter', orientation: 'landscape' }), { width: 1056, height: 816 });
});

test('expanded page height is persisted geometry and participates in section layout', () => {
  const expanded = { ...DEFAULT_PAGE_PROPERTY_SET, extraHeight: 560 };
  assert.deepEqual(resolvePageDimensions(expanded), { width: 794, height: 1683 });
  const layout = resolveNotebookPageLayout([
    { id: 'expanded', properties: expanded },
    { id: 'normal', properties: DEFAULT_PAGE_PROPERTY_SET },
  ]);
  assert.equal(layout.positions[1].y, 32 + 1683 + 32);
  const notebook = { id: 'n', defaultPageProperties: DEFAULT_PAGE_PROPERTY_SET } as any;
  const overrides = derivePagePropertyOverrides(expanded, notebook);
  assert.equal(overrides.extraHeight, 560);
  assert.equal(resolvePageProperties(notebook, { id: 'p', pagePropertyOverrides: overrides } as any).extraHeight, 560);
});

test('Portrait/Landscape/Portrait pages retain heterogeneous centered vertical geometry', () => {
  const pages = [
    { id: 'portrait-1', properties: { ...DEFAULT_PAGE_PROPERTY_SET } },
    { id: 'landscape', properties: { ...DEFAULT_PAGE_PROPERTY_SET, orientation: 'landscape' as const } },
    { id: 'portrait-2', properties: { ...DEFAULT_PAGE_PROPERTY_SET } },
  ];
  const layout = resolveNotebookPageLayout(pages);

  assert.deepEqual(layout.positions, [
    { id: 'portrait-1', x: 164.5, y: 32, width: 794, height: 1123 },
    { id: 'landscape', x: 0, y: 1187, width: 1123, height: 794 },
    { id: 'portrait-2', x: 164.5, y: 2013, width: 794, height: 1123 },
  ]);
  assert.equal(layout.totalWidth, 1123);
  assert.equal(layout.totalHeight, 3168);
});

test('switching focused page cannot change section geometry or per-page renderer dimensions', async () => {
  const pages = [
    { id: 'portrait', properties: { ...DEFAULT_PAGE_PROPERTY_SET } },
    { id: 'landscape', properties: { ...DEFAULT_PAGE_PROPERTY_SET, orientation: 'landscape' as const } },
  ];
  const geometryBeforeFocusChange = resolveNotebookPageLayout(pages);
  const geometryAfterFocusChange = resolveNotebookPageLayout(pages);
  assert.deepEqual(geometryAfterFocusChange.positions, geometryBeforeFocusChange.positions);

  const renderer = await readFile(new URL('../src/components/notebook/NotebookRenderer.tsx', import.meta.url), 'utf8');
  assert.match(renderer, /width=\{pos\.width\}/);
  assert.match(renderer, /height=\{pos\.height\}/);
  assert.match(renderer, /properties=\{resolvedSectionProperties\.get\(pos\.id\)!\}/);
  assert.doesNotMatch(renderer, /resolveNotebookPageLayout\([^)]*focusedPageId/s);
});

test('orientation geometry resolves to one stable focal-position transition', async () => {
  const portrait = { left: 100, top: 50, width: 794, height: 1123 };
  const viewportCenter = { x: 497, y: 611.5 };
  const anchor = capturePageGeometryAnchor(portrait, viewportCenter);
  const landscapeBeforeCorrection = { left: 100, top: 50, width: 1123, height: 794 };
  const delta = resolvePageGeometryScrollDelta(anchor, landscapeBeforeCorrection);
  assert.deepEqual(delta, { x: 164.5, y: -164.5 });

  const landscapeAfterCorrection = {
    ...landscapeBeforeCorrection,
    left: landscapeBeforeCorrection.left - delta.x,
    top: landscapeBeforeCorrection.top - delta.y,
  };
  assert.deepEqual(resolvePageGeometryScrollDelta(anchor, landscapeAfterCorrection), { x: 0, y: 0 });

  const [renderer, pageView] = await Promise.all([
    readFile(new URL('../src/components/notebook/NotebookRenderer.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/notebook/NotebookPageView.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(renderer, /pageGeometryTransitionRef\.current/);
  assert.match(renderer, /capturePageGeometryAnchor/);
  assert.match(renderer, /resolvePageGeometryScrollDelta/);
  assert.doesNotMatch(pageView, /\[isFocused, notebookEngine, width, height, page\.type, page\.id, renderScale\]/);
  assert.match(pageView, /notebookEngine\.resize\(width, height\)/);
});
