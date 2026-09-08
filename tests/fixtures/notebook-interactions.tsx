// Browser-only fixture: mounts production components and the production engine.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NotebookEngine } from '../../src/components/notebook/engine/NotebookEngine';
import { FloatingTextEditor } from '../../src/components/notebook/FloatingTextEditor';
import { NotebookLayersControl } from '../../src/components/notebook/NotebookLayersControl';
import { NotebookElementsControl } from '../../src/components/notebook/NotebookElementsControl';
import { createStickyNote } from '../../src/components/notebook/stickyNotes';
import '../../src/styles/index.css';
import { NotebookRenderer } from '../../src/components/notebook/NotebookRenderer';
import { NotebookPageView } from '../../src/components/notebook/NotebookPageView';
import { useWorkspaceStore } from '../../src/stores/workspaceStore';
import { notebookRepository } from '../../src/repositories/NotebookRepository';

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
