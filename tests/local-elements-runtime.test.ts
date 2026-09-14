import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getStarterElements,
  filterLocalElements,
  localElementRepository,
  serializeSnapshotForComparison,
  validateElementSnapshot,
  type ElementSnapshot,
  type LocalElement,
} from '../src/services/elements/LocalElementRepository.ts';
import { createStickyNote, getStickyNoteColor, getStickyNoteShape, isStickyNote, insertStickyPreset, STICKY_PRESETS } from '../src/components/notebook/stickyNotes.ts';
import { LayerManager } from '../src/components/notebook/engine/LayerManager.ts';
import { TextManager } from '../src/components/notebook/engine/TextManager.ts';
import { SelectionEngine } from '../src/components/notebook/engine/SelectionEngine.ts';
import { HistoryManager } from '../src/components/notebook/engine/HistoryManager.ts';
import type { Stroke, Shape, ImageObject } from '../src/components/notebook/engine/drawingTypes.ts';

// Mock localStorage for Node test runner
const memoryStorage = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
    clear: () => memoryStorage.clear(),
  };
}

// Stubs to avoid @/repositories/CanvasRepository (Dexie) import chain in Node test runner
class FakeDrawingEngine {
  private strokes: Stroke[] = [];
  getStrokes(): Stroke[] { return this.strokes; }
  addStroke(stroke: Stroke): void { this.strokes.push(stroke); }
  removeStrokes(ids: Set<string>): Stroke[] {
    const removed = this.strokes.filter(s => ids.has(s.id));
    this.strokes = this.strokes.filter(s => !ids.has(s.id));
    return removed;
  }
  findStrokesNearPoint(): string[] { return []; }
  redraw(): void {}
  renderLiveStroke(): void {}
  renderLasso(): void {}
}

class FakeShapeManager {
  private shapes: Shape[] = [];
  getShapes(): Shape[] { return this.shapes; }
  addShape(shape: Shape): void { this.shapes.push(shape); }
  removeShapes(ids: Set<string>): Shape[] {
    const removed = this.shapes.filter(s => ids.has(s.id));
    this.shapes = this.shapes.filter(s => !ids.has(s.id));
    return removed;
  }
  findShapesNearPoint(): string[] { return []; }
  clearShapes(): Shape[] { const p = this.shapes; this.shapes = []; return p; }
}

class FakeImageManager {
  private images: ImageObject[] = [];
  getImages(): ImageObject[] { return this.images; }
  addImage(img: ImageObject): void { this.images.push(img); }
  removeImages(ids: Set<string>): ImageObject[] {
    const removed = this.images.filter(i => ids.has(i.id));
    this.images = this.images.filter(i => !ids.has(i.id));
    return removed;
  }
  clearImages(): ImageObject[] { const p = this.images; this.images = []; return p; }
}

function clipboardFixture() {
  const layers = new LayerManager();
  const history = new HistoryManager();
  const texts = new TextManager(layers);
  const drawing = new FakeDrawingEngine();
  const shapes = new FakeShapeManager();
  const images = new FakeImageManager();
  const selection = new SelectionEngine(drawing as any, shapes as any, history, {} as any, texts, images as any, layers);
  return { layers, history, texts, drawing, shapes, images, selection };
}

test('copy fallback, repeated paste and history preserve originals and assign fresh IDs on active layer', async () => {
  const f = clipboardFixture();
  const stroke: Stroke = { id: 'original', type: 'stroke', tool: 'pen', color: '#123456', thickness: 2, opacity: 1, createdAt: 1, layerId: 'layer-default', points: [{ x: 10, y: 15, pressure: .5, t: 0 }, { x: 90, y: 70, pressure: .7, t: 10 }] };
  f.drawing.addStroke(stroke);
  f.selection.select(stroke.id, 'stroke');
  await f.selection.copySelection();
  const layer = f.layers.create('Paste here');
  let selectionChanges = 0;
  f.selection.subscribe(() => selectionChanges++);
  assert.equal(f.selection.pasteInternalClipboard(), true);
  assert.equal(f.drawing.getStrokes().length, 2);
  const first = structuredClone(f.drawing.getStrokes()[1]);
  assert.equal(first.layerId, layer.id);
  assert.notEqual(first.id, stroke.id);
  assert.equal(first.points[0].x, 30);
  assert.equal(f.selection.getSelectedElements()[0].id, first.id);
  assert.ok(selectionChanges > 0);
  assert.equal(f.selection.pasteInternalClipboard(), true);
  const second = f.drawing.getStrokes()[2];
  assert.equal(second.points[0].x, 50);
  assert.notEqual(second.id, first.id);
  assert.deepEqual(f.drawing.getStrokes()[0], stroke);
  f.history.undo();
  assert.equal(f.drawing.getStrokes().length, 2);
  f.history.redo();
  assert.equal(f.drawing.getStrokes()[2].id, second.id);
  f.layers.setLocked(layer.id, true);
  f.layers.setLocked('layer-default', true);
  assert.equal(f.selection.pasteInternalClipboard(), false);
});

test('saved drawing deduplication preserves relative geometry and compares every point', () => {
  const snapshot: ElementSnapshot = { type: 'panvas/elements', strokes: [{ id: 'a', type: 'stroke', tool: 'pen', color: '#000000', thickness: 2, opacity: 1, createdAt: 0, points: [{ x: 10, y: 10, t: 0, pressure: .5 }, { x: 20, y: 30, t: 10, pressure: .5 }] }], shapes: [], texts: [], images: [] };
  const moved = structuredClone(snapshot);
  moved.strokes[0].id = 'new';
  moved.strokes[0].points.forEach(point => { point.x += 100; point.y += 70; });
  assert.equal(serializeSnapshotForComparison(snapshot), serializeSnapshotForComparison(moved));
  moved.strokes[0].points[1].x += 5;
  assert.notEqual(serializeSnapshotForComparison(snapshot), serializeSnapshotForComparison(moved));
});

test('an asynchronous clipboard read cannot insert into a page loaded while it was pending', async () => {
  const f = clipboardFixture();
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let resolveRead!: (text: string) => void;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: () => new Promise<string>(resolve => { resolveRead = resolve; }) } });
  try {
    const pending = f.selection.pasteSelection();
    f.selection.resetPageScope();
    resolveRead(JSON.stringify({ type: 'panvas/elements', strokes: [], shapes: [], images: [], texts: [createStickyNote({ id: 'stale', x: 10, y: 20 })] }));
    await pending;
    assert.equal(f.texts.getTexts().length, 0);
    assert.equal(f.history.canUndo(), false);
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

test('Starter derives every canonical sticky preset and supported compact shape from shared definitions', () => {
  const starters = getStarterElements();
  assert.equal(starters.length, STICKY_PRESETS.length + 6);
  assert.equal(starters.every(s => s.category === 'Starter' && s.builtin === true), true);
  assert.deepEqual(starters[0].snapshot.texts[0].content, { type: 'doc', content: [{ type: 'paragraph', content: [] }] });

  for (const starter of starters) {
    const valid = validateElementSnapshot(starter.snapshot);
    assert.ok(valid);
    assert.equal(valid.texts.length + valid.shapes.length, 1);
    if (valid.texts.length) {
      const text = valid.texts[0];
      assert.equal(text.metadata?.isStickyNote, true);
      assert.ok(text.metadata?.color);
    }
  }
  assert.deepEqual(starters.filter(item => item.snapshot.texts.length).map(item => item.name), STICKY_PRESETS.map(item => item.label));
  assert.deepEqual(starters.filter(item => item.snapshot.shapes.length).map(item => item.snapshot.shapes[0].shapeType), ['rectangle', 'ellipse', 'triangle', 'diamond', 'line', 'arrow']);
});

test('All, Starter, and My Elements are distinct stable semantic filters', () => {
  const starters = getStarterElements();
  const mine = { ...starters[0], id: 'mine', builtin: false, category: 'Custom' };
  const all = [...starters, mine];
  assert.equal(filterLocalElements(all, 'All').length, all.length);
  assert.equal(filterLocalElements(all, 'Starter').length, starters.length);
  assert.deepEqual(filterLocalElements(all, 'My Elements').map(item => item.id), ['mine']);
});

test('gallery action inserts every preset exactly once with metadata, active layer, dirty signal, and history', () => {
  for (const preset of STICKY_PRESETS) {
    const f = clipboardFixture();
    const layer = f.layers.create('Preset layer');
    let dirty = 0;
    const engine = {
      ...f,
      drawing: Object.assign(f.drawing, { getInsertionPoint: () => ({ x: 75, y: 95 }) }),
      tools: { setMode: (mode: string) => assert.equal(mode, 'select') },
      input: { notifyChange: () => { dirty++; } },
    };
    const inserted = insertStickyPreset(engine as any, preset.id);
    assert.ok(inserted, preset.id);
    assert.equal(f.texts.getTexts().length, 1, preset.id);
    assert.equal(inserted.layerId, layer.id);
    assert.equal(inserted.x, 75);
    assert.equal(inserted.y, 95);
    assert.equal(inserted.width, preset.width);
    assert.equal(inserted.height, preset.height);
    assert.equal(inserted.metadata?.color, preset.color);
    assert.equal(inserted.metadata?.opacity, preset.opacity);
    assert.equal(inserted.metadata?.shape, preset.shape);
    assert.equal(inserted.metadata?.paper, preset.paper);
    assert.equal(f.selection.getSelectedElements()[0].id, inserted.id);
    assert.equal(dirty, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(inserted)).metadata, inserted.metadata);
    f.history.undo();
    assert.equal(f.texts.getTexts().length, 0);
    assert.equal(dirty, 2);
    f.history.redo();
    assert.equal(f.texts.getTexts().length, 1);
    assert.equal(dirty, 3);
    assert.deepEqual(f.texts.getTexts()[0].metadata, inserted.metadata);
  }
});

test('saving focused sticky note creates valid ElementSnapshot with all metadata intact', () => {
  const note = createStickyNote({
    id: 'focused-sticky-1',
    x: 40,
    y: 80,
    color: '#bae6fd',
    opacity: 0.9,
    shape: 'rounded-rect',
  });

  const snapshot: ElementSnapshot = {
    type: 'panvas/elements',
    strokes: [],
    shapes: [],
    texts: [structuredClone(note)],
    images: [],
  };

  const validated = validateElementSnapshot(snapshot);
  assert.ok(validated);
  assert.equal(validated.texts.length, 1);
  const savedNote = validated.texts[0];
  assert.equal(isStickyNote(savedNote), true);
  assert.equal(getStickyNoteColor(savedNote), '#bae6fd');
  assert.equal(getStickyNoteShape(savedNote), 'rounded-rect');
  assert.equal(savedNote.metadata?.opacity, 0.9);
});

test('local element CRUD operations: create, update, deduplicate, and delete', async () => {
  const workspaceId = 'ws-test-elements-1';
  memoryStorage.clear();

  const note = createStickyNote({ id: 'note-crud', x: 10, y: 10, color: '#fbcfe8', shape: 'square' });
  const snapshot: ElementSnapshot = {
    type: 'panvas/elements',
    strokes: [],
    shapes: [],
    texts: [note],
    images: [],
  };

  // 1. Create
  const created = await localElementRepository.create(workspaceId, snapshot, 'Pink Square Note');
  assert.equal(created.name, 'Pink Square Note');
  assert.equal(created.category, 'My elements');
  assert.equal(created.workspaceId, workspaceId);

  // 2. Fetch all
  const elements = await localElementRepository.getAll(workspaceId);
  assert.equal(elements.length, 1);
  assert.equal(elements[0].id, created.id);

  // 3. Deduplication check: attempting to create identical element snapshot throws error
  // 3. Deduplication: attempting to create identical snapshot throws
  await assert.rejects(
    async () => localElementRepository.create(workspaceId, snapshot, 'Duplicate Note'),
    /already been saved/
  );

  // 4. Update name, category, and favorite
  const updatedList = await localElementRepository.update(workspaceId, created.id, {
    name: 'Renamed Square Note',
    category: 'Templates',
    favorite: true,
  });
  assert.equal(updatedList[0].name, 'Renamed Square Note');
  assert.equal(updatedList[0].category, 'Templates');
  assert.equal(updatedList[0].favorite, true);

  // 5. Delete
  const remaining = await localElementRepository.remove(workspaceId, created.id);
  assert.equal(remaining.length, 0);
});

test('inserting element snapshot via pasteElements preserves sticky note metadata and targets active layer', () => {
  const layers = new LayerManager();
  const workLayer = layers.create('Active Work');
  layers.setActive(workLayer.id);

  const history = new HistoryManager();
  const textManager = new TextManager(layers);
  const drawingEngine = new FakeDrawingEngine();
  const shapeManager = new FakeShapeManager();
  const imageManager = new FakeImageManager();
  const selection = new SelectionEngine(
    drawingEngine as any,
    shapeManager as any,
    history,
    {} as any,
    textManager,
    imageManager as any,
    layers,
  );

  const starterNote = createStickyNote({
    id: 'starter-1',
    x: 100,
    y: 100,
    color: '#bbf7d0',
    opacity: 0.95,
    shape: 'star',
  });

  const snapshot: ElementSnapshot = {
    type: 'panvas/elements',
    strokes: [],
    shapes: [],
    texts: [starterNote],
    images: [],
  };

  const pasted = selection.pasteElements(snapshot);
  assert.equal(pasted, true);

  const pastedTexts = textManager.getTexts();
  assert.equal(pastedTexts.length, 1);

  const inserted = pastedTexts[0];
  assert.notEqual(inserted.id, 'starter-1'); // New unique ID assigned
  assert.equal(inserted.layerId, workLayer.id); // Assigned to active layer
  assert.equal(inserted.x, 120); // +20 offset applied
  assert.equal(inserted.y, 120);
  assert.equal(isStickyNote(inserted), true);
  assert.equal(getStickyNoteColor(inserted), '#bbf7d0');
  assert.equal(getStickyNoteShape(inserted), 'star');
  assert.equal(inserted.metadata?.opacity, 0.95);

  // History undo
  // Undo removes the inserted note
  history.undo();
  assert.equal(textManager.getTexts().length, 0);

  // History redo
  // Redo re-inserts it on the correct layer
  history.redo();
  assert.equal(textManager.getTexts().length, 1);
  assert.equal(textManager.getTexts()[0].layerId, workLayer.id);
});
