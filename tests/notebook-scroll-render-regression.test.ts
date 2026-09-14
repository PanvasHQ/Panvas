import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createEmptyDrawingData, type DrawingData } from '../src/components/notebook/engine/drawingTypes.ts';
import { resolvePageRenderProperties } from '../src/lib/pageProperties.ts';
import { DEFAULT_PAGE_PROPERTY_SET, type Notebook, type NotebookPage, type PagePropertySet } from '../src/types/notebook.ts';
import {
  mayApplyPageLoadToEngine,
  mergeLoadedPageData,
  resolveNotebookPageRenderData,
} from '../src/components/notebook/notebookPageRenderState.ts';

function pageData(pageId: string, objectIds: string[]): DrawingData {
  const data = createEmptyDrawingData();
  data.objects = objectIds.map(id => ({
    id,
    type: id.includes('drawing') ? 'stroke' : id.includes('image') ? 'image' : id.includes('shape') ? 'shape' : 'text',
    createdAt: 1,
    x: 0,
    y: 0,
    metadata: { pageId, stickyNote: id.includes('sticky') },
  })) as DrawingData['objects'];
  return data;
}

function ids(data: DrawingData | undefined): string[] {
  return (data?.objects ?? []).map(object => object.id);
}

const appearance = (paperColor: string, ruleLineColor: string, template: PagePropertySet['template']): PagePropertySet => ({
  ...DEFAULT_PAGE_PROPERTY_SET,
  paperColor,
  ruleLineColor,
  template,
});

test('page appearance is identical across active and inactive scroll transitions', () => {
  const notebook = {
    id: 'notebook', workspaceId: 'workspace', folderId: null, name: 'Notebook', createdAt: 1, updatedAt: 1,
    order: 0, isExpanded: true, userId: null,
    defaultPageProperties: appearance('#171717', '#525252', 'Large grid'),
  } satisfies Notebook;
  const pages = ['A', 'B', 'C'].map((id, order) => ({
    id, notebookId: notebook.id, sectionId: 'section', title: id, createdAt: 1, updatedAt: 1, order,
    userId: null, pagePropertyOverrides: {},
  } satisfies NotebookPage));
  const cached = {
    A: appearance('#ffffff', '#94a3b8', 'Ruled'),
    B: appearance('#fff4cc', '#b45309', 'Dotted'),
    C: appearance('#e0f2fe', '#0369a1', 'Small grid'),
  };
  const sequence = ['A', 'B', 'B', 'C', 'C', 'A'];

  for (const activePageId of sequence) {
    for (const page of pages) {
      const resolved = resolvePageRenderProperties(notebook, page, cached[page.id as keyof typeof cached]);
      assert.deepEqual(
        { paperColor: resolved.paperColor, ruleLineColor: resolved.ruleLineColor, template: resolved.template },
        { paperColor: cached[page.id as keyof typeof cached].paperColor, ruleLineColor: cached[page.id as keyof typeof cached].ruleLineColor, template: cached[page.id as keyof typeof cached].template },
        `Page ${page.id} appearance changed while active page was ${activePageId}`,
      );
    }
  }
});

test('persisted page objects survive active, inactive, offscreen, visible and active transitions', () => {
  const pageA = pageData('A', ['A-sticky', 'A-drawing', 'A-text', 'A-image', 'A-shape']);
  const pageB = pageData('B', ['B-text', 'B-drawing']);
  const pageC = pageData('C', ['C-text', 'C-image']);
  const cache = { A: pageA, B: pageB, C: pageC };
  const expectedA = ids(pageA);

  const transitions = [
    { focused: 'A', visible: true },
    { focused: 'B', visible: true },
    { focused: 'B', visible: false },
    { focused: 'B', visible: true },
    { focused: 'A', visible: true },
  ];

  for (const transition of transitions) {
    const resolved = resolveNotebookPageRenderData(
      'A',
      transition.focused,
      cache,
      transition.focused === 'A' ? pageA : undefined,
    );
    assert.deepEqual(ids(resolved), expectedA, `Page A changed while focused=${transition.focused}, visible=${transition.visible}`);
  }

  assert.deepEqual(ids(resolveNotebookPageRenderData('B', 'A', cache, pageA)), ['B-text', 'B-drawing']);
  assert.deepEqual(ids(resolveNotebookPageRenderData('C', 'B', cache, pageB)), ['C-text', 'C-image']);
  assert.deepEqual(ids(cache.A), expectedA, 'visibility transitions must not mutate canonical page data');
});

test('late repository snapshots fill gaps without replacing newer page data', () => {
  const currentA = pageData('A', ['A-sticky', 'A-drawing', 'A-text', 'A-image']);
  const staleEmptyA = pageData('A', []);
  const loadedB = pageData('B', ['B-shape']);
  const merged = mergeLoadedPageData({ A: currentA }, { A: staleEmptyA, B: loadedB });

  assert.equal(merged.A, currentA);
  assert.deepEqual(ids(merged.A), ['A-sticky', 'A-drawing', 'A-text', 'A-image']);
  assert.equal(merged.B, loadedB);
});

test('stale focused-page loads cannot write into another page engine', () => {
  assert.equal(mayApplyPageLoadToEngine('A', 'B', 1, 2), false);
  assert.equal(mayApplyPageLoadToEngine('B', 'B', 1, 2), false);
  assert.equal(mayApplyPageLoadToEngine('B', 'B', 2, 2), true);
});

test('scroll focus changes unmount canvases but engine destruction remains owner-only', async () => {
  const [renderer, pageView, engine] = await Promise.all([
    readFile('src/components/notebook/NotebookRenderer.tsx', 'utf8'),
    readFile('src/components/notebook/NotebookPageView.tsx', 'utf8'),
    readFile('src/components/notebook/engine/NotebookEngine.ts', 'utf8'),
  ]);

  assert.equal((renderer.match(/notebookEngine\.destroy\(\)/g) ?? []).length, 1);
  assert.match(renderer, /return \(\) => notebookEngine\.destroy\(\)/);
  assert.doesNotMatch(pageView, /notebookEngine\.destroy\(\)/);
  assert.match(pageView, /notebookEngine\.unmount\(\)/);
  assert.match(renderer, /key=\{pos\.id\}/);
  assert.match(renderer, /const incomingData = sectionDataCacheRef\.current\[targetPageId\];/);
  assert.match(renderer, /if \(!incomingData\)[\s\S]*setActivePage\(targetPageId\);[\s\S]*return;/);
  assert.doesNotMatch(renderer, /sectionDataCacheRef\.current\[targetPageId\] \|\| \{/);
  assert.match(renderer, /notebookEngine\.unmount\(\);\s*notebookEngine\.setDrawingData\(incomingData, targetPageId\);/);
  assert.match(engine, /mount\([\s\S]*if \(!this\.unsubscribeDrawingRevision\)[\s\S]*if \(!this\.unsubscribeHistoryRevision\)/);
});

test('shared canvas handoff is synchronously cleared and ownership-gated', async () => {
  const [renderer, pageView] = await Promise.all([
    readFile('src/components/notebook/NotebookRenderer.tsx', 'utf8'),
    readFile('src/components/notebook/NotebookPageView.tsx', 'utf8'),
  ]);
  assert.match(renderer, /key=\{pos\.id\}/);
  assert.match(renderer, /sceneOwnerPageId=\{isFocused \? notebookEngine\.getDrawingOwnership\(\)\.pageId/);
  assert.match(pageView, /useLayoutEffect\(\(\) => \{[\s\S]*clearCanvasSurface\(canvasRef\.current\)/);
  assert.match(pageView, /data-rendered-page-id=\{page\.id\}/);
  assert.match(pageView, /data-scene-owner-page-id=\{sceneOwnerPageId\}/);
  assert.match(pageView, /visibility: sceneReady \? 'visible' : 'hidden'/);
  assert.match(pageView, /const liveSceneReady = isFocused && sceneReady/);
  assert.match(pageView, /\{liveSceneReady && layeredDrawing && orderedLayers\.map/);
  assert.match(pageView, /\{liveSceneReady && liveTextObjects\.map/);
  assert.match(pageView, /context\.reset\(\)|canvas\.width = canvas\.width/);
});
