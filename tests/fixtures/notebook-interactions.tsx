// Browser-only fixture: mounts production components and the production engine.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NotebookEngine } from '../../src/components/notebook/engine/NotebookEngine';
import { FloatingTextEditor } from '../../src/components/notebook/FloatingTextEditor';
import { NotebookLayersControl } from '../../src/components/notebook/NotebookLayersControl';
import { NotebookElementsControl } from '../../src/components/notebook/NotebookElementsControl';
import { createStickyNote } from '../../src/components/notebook/stickyNotes';
import '../../src/styles/index.css';
import '../../src/styles/editor-fonts.css';
import { NotebookRenderer } from '../../src/components/notebook/NotebookRenderer';
import { NotebookPageView } from '../../src/components/notebook/NotebookPageView';
import { NotebookSidebar } from '../../src/components/notebook/NotebookSidebar';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { notebookRepository } from '../../src/repositories/NotebookRepository';
import { createEmptyDrawingData, type DrawingData } from '../../src/components/notebook/engine/drawingTypes';

const engine = new NotebookEngine();
const note = createStickyNote({ id: 'runtime-note', x: 180, y: 180 });
engine.texts.addText(note);
engine.tools.setMode('select');
engine.selection.select(note.id, 'text');
Object.assign(window, { fixtureEngine: engine });

function Fixture() {
  const [, update] = useState(0);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const refresh = () => update(n => n + 1);
    const subscriptions = [engine.history.subscribe(refresh), engine.input.onDrawingChange(refresh), engine.layers.subscribe(refresh), engine.selection.subscribe(refresh), engine.tools.subscribe(refresh)];
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, []);
  return <div style={{ padding: 24 }}>
    <div style={{ display: 'flex', gap: 20, position: 'relative', zIndex: 100 }}>
      <button onClick={() => engine.history.undo()}>Undo</button>
      <button onClick={() => engine.history.redo()}>Redo</button>
      <button onClick={() => { engine.selection.clearSelection(); engine.tools.setMode('select'); }}>Deselect</button>
      <button onClick={() => setZoom(1.5)}>Zoom</button>
      <button onClick={() => { localStorage.setItem('fixture-page', JSON.stringify(engine.getDrawingData())); engine.setDrawingData(JSON.parse(localStorage.getItem('fixture-page')!), 'fixture-page'); }}>Reopen</button>
      <NotebookLayersControl engine={engine} onChange={() => engine.input.notifyChange()} />
      <NotebookElementsControl engine={engine} workspaceId="runtime-fixture" onInsert={() => engine.input.notifyChange()} />
    </div>
    <div style={{ position: 'relative', width: 900, height: 800, marginTop: 30, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
      <canvas ref={canvas => { if (canvas) engine.mount(canvas, 900, 800); }} style={{ position: 'absolute', inset: 0 }} />
      {engine.texts.getTexts().filter(text => engine.layers.isVisible(text.layerId)).map(text => <FloatingTextEditor key={text.id} object={text} engine={engine} scale={1} toolMode={engine.layers.isEditable(text.layerId) ? engine.tools.getState().mode : 'hand'} onFocus={() => {}} onBlur={() => {}} />)}
    </div>
  </div>;
}

function LayerFixture() {
  const [, update] = useState(0);
  useEffect(() => {
    const subscriptions = [engine.layers.subscribe(() => update(n => n + 1)), engine.history.subscribe(() => update(n => n + 1)), engine.tools.subscribe(() => update(n => n + 1))];
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, []);
  return <div style={{ padding: 24 }}><NotebookPageView page={{ id: 'layer-page', notebookId: 'n', sectionId: 's', title: 'Layer fixture', createdAt: 0, updatedAt: 0, order: 0, userId: null }} properties={engine.getProperties()} width={900} height={800} renderScale={1} pageNumberText="" isFocused toolState={engine.tools.getState()} notebookEngine={engine} activeEditor={null} setActiveEditor={() => {}} onActivatePage={() => {}} /></div>;
}

function pageIsolationMarker(pageNumber: number): DrawingData {
  const marker = `PAGE_${String(pageNumber).padStart(2, '0')}`;
  const data = createEmptyDrawingData();
  data.properties = {
    ...data.properties,
    template: pageNumber % 2 === 0 ? 'Dotted' : 'Ruled',
    paperColor: pageNumber % 3 === 0 ? '#fff4cc' : '#ffffff',
    ruleLineColor: pageNumber % 5 === 0 ? '#2563eb' : '#94a3b8',
  };
  data.objects = [
    {
      id: `${marker}_TEXT`,
      type: 'text',
      x: 80,
      y: 90,
      width: 360,
      height: 80,
      createdAt: pageNumber,
      layerId: 'layer-default',
      fontFamily: "'Sacramento', cursive",
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: marker }] }],
      },
    },
    {
      id: `${marker}_DRAWING`,
      type: 'stroke',
      tool: 'pen',
      color: `hsl(${pageNumber * 13} 70% 45%)`,
      thickness: 4,
      opacity: 1,
      createdAt: pageNumber,
      layerId: 'layer-default',
      points: [
        { x: 80, y: 220, pressure: 0.5, t: 0 },
        { x: 180 + pageNumber, y: 240, pressure: 0.6, t: 20 },
      ],
    },
  ];
  return data;
}

async function setupPageIsolation(root: ReturnType<typeof createRoot>) {
  const store = useWorkspaceStore.getState;
  const fixtureKey = 'panvas.test.pageIsolation';
  const storedFixture = JSON.parse(localStorage.getItem(fixtureKey) || 'null') as null | {
    workspaceId: string;
    notebookId: string;
    sectionId: string;
    pageIds: string[];
  };
  await store().loadWorkspaces();

  let workspace = storedFixture
    ? store().workspaces.find(item => item.id === storedFixture.workspaceId)
    : undefined;
  let notebook = storedFixture
    ? store().notebooks.find(item => item.id === storedFixture.notebookId)
    : undefined;
  let section = storedFixture
    ? store().notebookSections.find(item => item.id === storedFixture.sectionId)
    : undefined;
  let pages = storedFixture
    ? storedFixture.pageIds.map(id => store().notebookPages.find(item => item.id === id)).filter(Boolean)
    : [];

  if (!workspace || !notebook || !section || pages.length !== 25) {
    workspace = await store().createWorkspace('25-page isolation fixture');
    await store().setActiveWorkspace(workspace.id);
    notebook = await store().createNotebook(null, 'Isolation notebook');
    section = store().notebookSections.find(item => item.notebookId === notebook!.id)!;
    const firstPage = store().notebookPages.find(item => item.sectionId === section!.id)!;
    pages = [firstPage];

    for (let pageNumber = 2; pageNumber <= 25; pageNumber += 1) {
      pages.push(await notebookRepository.createPage(
        null,
        workspace.id,
        notebook.id,
        section.id,
        `Page ${pageNumber}`,
      ));
    }
    for (let index = 0; index < pages.length; index += 1) {
      const data = pageIsolationMarker(index + 1);
      await notebookRepository.setPagePropertyOverrides(workspace.id, pages[index]!.id, {
        template: data.properties.template,
        paperColor: data.properties.paperColor,
        ruleLineColor: data.properties.ruleLineColor,
      });
      await notebookRepository.saveDrawingData(
        workspace.id,
        notebook.id,
        pages[index]!.id,
        data,
      );
    }
    localStorage.setItem(fixtureKey, JSON.stringify({
      workspaceId: workspace.id,
      notebookId: notebook.id,
      sectionId: section.id,
      pageIds: pages.map(item => item!.id),
    }));
  } else {
    await store().setActiveWorkspace(workspace.id);
    notebook = store().notebooks.find(item => item.id === storedFixture!.notebookId)!;
    section = store().notebookSections.find(item => item.id === storedFixture!.sectionId)!;
    pages = storedFixture!.pageIds.map(id => store().notebookPages.find(item => item.id === id)!);
  }

  await store().loadWorkspaceContents(workspace.id);
  store().setActivePage(pages[0].id);

  let rendererKey = 0;
  const render = () => root.render(
    <div key={rendererKey++} style={{ display: 'flex', height: '100vh' }}>
      <span
        data-font-probe="Sacramento"
        style={{ position: 'fixed', left: -10000, fontFamily: "'Sacramento', cursive" }}
      >
        Font probe
      </span>
      <div data-isolation-sidebar="true" style={{ width: 220, minWidth: 220 }}><NotebookSidebar /></div>
      <div style={{ flex: 1, minWidth: 0 }}><NotebookRenderer onEngineReady={rendererEngine => {
        Object.assign(window, {
          pageIsolationEdit: (pageId: string, marker: string) => {
            if (rendererEngine.getDrawingOwnership().pageId !== pageId) {
              throw new Error('Fixture attempted to edit a sheet that does not own the live engine');
            }
            rendererEngine.drawing.addStroke({
              id: marker,
              type: 'stroke',
              tool: 'pen',
              color: '#7c3aed',
              thickness: 8,
              opacity: 1,
              createdAt: Date.now(),
              layerId: 'layer-default',
              points: [
                { x: 500, y: 460, pressure: .5, t: 0 },
                { x: 650, y: 520, pressure: .6, t: 20 },
              ],
            });
            rendererEngine.drawing.redraw();
            rendererEngine.input.notifyChange();
          },
        });
      }} /></div>
    </div>,
  );
  render();

  Object.assign(window, {
    pageIsolationIds: pages.map(item => item!.id),
    pageIsolationRead: (pageId: string) => notebookRepository.loadDrawingData(workspace.id, notebook.id, pageId),
    pageIsolationSelect: (pageId: string) => store().setActivePage(pageId),
    pageIsolationRemount: () => render(),
    pageIsolationReorder: async () => {
      const reversed = [...pages].reverse().map(item => item!.id);
      await store().reorderPages(reversed);
      return reversed;
    },
    pageIsolationDeleteRestore: async (pageId: string) => {
      await store().deleteNotebookPage(pageId);
      await notebookRepository.restoreEntity(workspace.id, pageId, 'page');
      await store().loadWorkspaceContents(workspace.id);
      return notebookRepository.loadDrawingData(workspace.id, notebook.id, pageId);
    },
    pageIsolationAddBlank: async () => {
      const created = await store().createNotebookPage(section.id, 'Page 26');
      return created.id;
    },
  });
}

function recordingFlowDrawing(): DrawingData {
  const data = createEmptyDrawingData();
  data.objects = [
    {
      id: 'RECORDING_ORANGE',
      type: 'stroke',
      tool: 'pen',
      color: '#f97316',
      thickness: 18,
      opacity: 1,
      createdAt: 1,
      layerId: 'layer-default',
      points: [
        { x: 130, y: 220, pressure: .5, t: 0 },
        { x: 260, y: 280, pressure: .6, t: 20 },
        { x: 390, y: 220, pressure: .5, t: 40 },
      ],
    },
    {
      id: 'RECORDING_GREEN',
      type: 'stroke',
      tool: 'pen',
      color: '#22c55e',
      thickness: 18,
      opacity: 1,
      createdAt: 2,
      layerId: 'layer-default',
      points: [
        { x: 150, y: 380, pressure: .5, t: 0 },
        { x: 280, y: 320, pressure: .6, t: 20 },
        { x: 410, y: 380, pressure: .5, t: 40 },
      ],
    },
  ];
  return data;
}

async function setupRecordingFlow(root: ReturnType<typeof createRoot>) {
  const store = useWorkspaceStore.getState;
  const workspace = await store().createWorkspace('Recording flow isolation fixture');
  await store().setActiveWorkspace(workspace.id);
  const notebook = await store().createNotebook(null, 'Recording flow notebook');
  const section = store().notebookSections.find(item => item.notebookId === notebook.id)!;
  const first = store().notebookPages.find(item => item.sectionId === section.id)!;
  const second = await notebookRepository.createPage(null, workspace.id, notebook.id, section.id, 'Sheet 2');
  const third = await notebookRepository.createPage(null, workspace.id, notebook.id, section.id, 'Sheet 3');
  await notebookRepository.saveDrawingData(workspace.id, notebook.id, first.id, createEmptyDrawingData());
  await notebookRepository.saveDrawingData(workspace.id, notebook.id, second.id, recordingFlowDrawing());
  await notebookRepository.saveDrawingData(workspace.id, notebook.id, third.id, createEmptyDrawingData());
  await store().loadWorkspaceContents(workspace.id);
  store().setActivePage(second.id);

  Object.assign(window, {
    recordingFlowIds: [first.id, second.id, third.id],
    recordingFlowRead: (pageId: string) => notebookRepository.loadDrawingData(workspace.id, notebook.id, pageId),
  });
  root.render(<div style={{ height: '100vh' }}><NotebookRenderer onEngineReady={rendererEngine => {
    Object.assign(window, {
      recordingFlowDraw: () => {
        rendererEngine.drawing.addStroke({
          id: 'RECORDING_LIVE_STROKE',
          type: 'stroke',
          tool: 'pen',
          color: '#7c3aed',
          thickness: 12,
          opacity: 1,
          createdAt: Date.now(),
          layerId: 'layer-default',
          points: [
            { x: 520, y: 460, pressure: .5, t: 0 },
            { x: 680, y: 520, pressure: .6, t: 20 },
          ],
        });
        rendererEngine.drawing.redraw();
        rendererEngine.input.notifyChange();
      },
    });
  }} /></div>);
}

function visualIsolationDrawing(pageNumber: number): DrawingData {
  if (![1, 5, 10, 15, 20].includes(pageNumber)) return createEmptyDrawingData();
  const data = createEmptyDrawingData();
  data.objects = [
    {
      id: `VISUAL_PAGE_${String(pageNumber).padStart(2, '0')}_INK`,
      type: 'stroke',
      tool: 'pen',
      color: '#d946ef',
      thickness: 24,
      opacity: 1,
      createdAt: pageNumber,
      layerId: 'layer-default',
      points: [
        { x: 120, y: 220, pressure: .5, t: 0 },
        { x: 340, y: 320, pressure: .6, t: 20 },
      ],
    },
    {
      id: `VISUAL_PAGE_${String(pageNumber).padStart(2, '0')}_TEXT`,
      type: 'text',
      x: 120,
      y: 360,
      width: 360,
      height: 80,
      createdAt: pageNumber,
      layerId: 'layer-default',
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: `VISUAL PAGE ${pageNumber}` }] }],
      },
    },
  ] as any;
  return data;
}

async function setupVisualIsolation(root: ReturnType<typeof createRoot>) {
  const store = useWorkspaceStore.getState;
  await store().loadWorkspaces();
  const workspace = await store().createWorkspace('20-page visual isolation fixture');
  await store().setActiveWorkspace(workspace.id);
  const notebook = await store().createNotebook(null, 'Visual isolation notebook');
  const section = store().notebookSections.find(item => item.notebookId === notebook.id)!;
  const first = store().notebookPages.find(item => item.sectionId === section.id)!;
  const pages = [first];
  for (let pageNumber = 2; pageNumber <= 20; pageNumber += 1) {
    pages.push(await notebookRepository.createPage(null, workspace.id, notebook.id, section.id, `Page ${pageNumber}`));
  }
  for (let index = 0; index < pages.length; index += 1) {
    await notebookRepository.saveDrawingData(workspace.id, notebook.id, pages[index]!.id, visualIsolationDrawing(index + 1));
  }
  await store().loadWorkspaceContents(workspace.id);
  store().setActivePage(first.id);
  let renderRevision = 0;
  let rendererEngine: NotebookEngine | null = null;
  const render = () => root.render(<div key={renderRevision++} style={{ height: '100vh' }}><NotebookRenderer onEngineReady={engine => { rendererEngine = engine; }} /></div>);
  Object.assign(window, {
    visualIsolationIds: pages.map(item => item.id),
    visualIsolationRead: (pageId: string) => notebookRepository.loadDrawingData(workspace.id, notebook.id, pageId),
    visualIsolationSelect: (pageId: string) => store().setActivePage(pageId),
    visualIsolationZoom: (scale: number) => rendererEngine?.viewport.setZoom(scale),
    visualIsolationRemount: () => render(),
  });
  render();
}

async function setupLayers() {
  engine.setDrawingData(null, 'layer-page');
  engine.tools.setMode('select');
  const ids = ['layer-default'];
  engine.drawing.addStroke({ id: 'layer-stroke', type: 'stroke', tool: 'pen', color: '#7040c0', thickness: 120, opacity: 1, createdAt: 0, points: [{ x: 180, y: 240, t: 0, pressure: .5 }, { x: 340, y: 240, t: 1, pressure: .5 }] });
  ids.push(engine.layers.create('Shape').id);
  engine.shapes.addShape({ id: 'layer-shape', type: 'shape', shapeType: 'rectangle', x: 180, y: 180, width: 160, height: 140, color: '#20a060', fill: '#20a060', strokeWidth: 1, rotation: 0, createdAt: 0 });
  ids.push(engine.layers.create('Image').id);
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = imageCanvas.height = 8;
  const context = imageCanvas.getContext('2d')!;
  context.fillStyle = '#2864dc'; context.fillRect(0, 0, 8, 8);
  const image = new Image(); image.src = imageCanvas.toDataURL(); await image.decode();
  engine.images.cacheImage('layer-image-file', image, image.src);
  engine.images.addImage({ id: 'layer-image', type: 'image', fileId: 'layer-image-file', x: 180, y: 180, width: 160, height: 140, rotation: 0, createdAt: 0 });
  ids.push(engine.layers.create('Text').id);
  engine.texts.addText({ id: 'layer-text', type: 'text', x: 180, y: 180, width: 160, height: 140, createdAt: 0, content: { type: 'doc', content: [{ type: 'paragraph' }] }, metadata: { elementBackground: '#e63946' } });
  ids.push(engine.layers.create('Sticky').id);
  engine.texts.addText(createStickyNote({ id: 'layer-sticky', x: 180, y: 180, shape: 'square', color: '#fef08a' }));
  engine.selection.clearSelection();
  Object.assign(window, { fixtureLayerIds: ids });
}

async function mount() {
  const root = createRoot(document.getElementById('root')!);
  if (new URLSearchParams(location.search).has('layers')) {
    await setupLayers();
    root.render(<LayerFixture />);
  } else if (new URLSearchParams(location.search).has('pageIsolation')) {
    await setupPageIsolation(root);
  } else if (new URLSearchParams(location.search).has('recordingFlow')) {
    await setupRecordingFlow(root);
  } else if (new URLSearchParams(location.search).has('visualIsolation')) {
    await setupVisualIsolation(root);
  } else if (new URLSearchParams(location.search).has('renderer')) {
    const store = useWorkspaceStore.getState;
    const workspace = await store().createWorkspace('Runtime clipboard fixture');
    await store().setActiveWorkspace(workspace.id);
    const notebook = await store().createNotebook(null, 'Clipboard notebook');
    const pageId = store().activePageId!;
    const strokes = [0, 1].map(index => ({ type: 'stroke', id: `source-${index}`, tool: 'pen', color: '#123456', opacity: 1, thickness: 4, createdAt: 1, layerId: 'layer-default', points: [{ x: 180, y: 220 + index * 60, pressure: .5, t: 0 }, { x: 300, y: 250 + index * 60, pressure: .6, t: 20 }] }));
    await notebookRepository.saveDrawingData(workspace.id, notebook.id, pageId, { ...engine.getDrawingData(), objects: strokes });
    Object.assign(window, {
      fixturePage: { workspaceId: workspace.id, notebookId: notebook.id, pageId },
      readFixturePage: () => notebookRepository.loadDrawingData(workspace.id, notebook.id, pageId),
      createFixturePage: async () => {
        const section = store().notebookSections.find(item => item.notebookId === notebook.id)!;
        const second = await store().createNotebookPage(section.id, 'Paste destination');
        Object.assign(window, { readSecondFixturePage: () => notebookRepository.loadDrawingData(workspace.id, notebook.id, second.id) });
        return second.id;
      },
      selectFixturePage: (targetPageId: string) => store().setActivePage(targetPageId),
    });
    root.render(<div style={{ height: '100vh' }}><NotebookRenderer /></div>);
  } else root.render(<React.StrictMode><Fixture /></React.StrictMode>);
}
void mount();
