import assert from 'node:assert/strict';
import test from 'node:test';
import { LayerManager } from '../src/components/notebook/engine/LayerManager.ts';
import { TextManager } from '../src/components/notebook/engine/TextManager.ts';
import { createStickyNote } from '../src/components/notebook/stickyNotes.ts';
import type { Shape, DrawingData } from '../src/components/notebook/engine/drawingTypes.ts';

// Minimal ShapeManager stub — avoids importing real ShapeManager which
// transitively pulls in ViewportManager PDF dependencies not testable in Node.
class FakeShapeManager {
  private shapes: Shape[] = [];
  getShapes(): Shape[] { return this.shapes; }
  addShape(shape: Shape): void { this.shapes.push(shape); }
  removeShapes(ids: Set<string>): Shape[] {
    const removed = this.shapes.filter(s => ids.has(s.id));
    this.shapes = this.shapes.filter(s => !ids.has(s.id));
    return removed;
  }
  clearShapes(): Shape[] { const p = this.shapes; this.shapes = []; return p; }
}

test('layer lifecycle: add, reorder, visibility, locking, and active layer switching', () => {
  const layers = new LayerManager();
  const base = layers.getLayers()[0];
  assert.equal(base.id, 'layer-default');
  assert.equal(base.name, 'Content');
  assert.equal(layers.getActiveLayerId(), 'layer-default');

  // Add layers
  const background = layers.create('Background');
  const annotations = layers.create('Annotations');
  assert.equal(layers.getLayers().length, 3);
  assert.equal(layers.getActiveLayerId(), annotations.id);

  // Reorder layers: move annotations down
  // Reorder: move annotations toward base (direction = -1 → toward index 0)
  const moved = layers.move(annotations.id, -1);
  assert.equal(moved, true);
  const names = layers.getLayers().map(l => l.name);
  assert.deepEqual(names, ['Content', 'Annotations', 'Background']);

  // Set active layer explicitly
  // Set active layer explicitly using correct API: setActive()
  layers.setActive(background.id);
  assert.equal(layers.getActiveLayerId(), background.id);

  // Locking active layer automatically shifts active layer to an editable one
  // Locking the active layer auto-shifts to an editable one
  layers.setLocked(background.id, true);
  const backgroundLayer = layers.getLayers().find(l => l.id === background.id)!;
  assert.equal(backgroundLayer.locked, true);
  assert.equal(layers.isEditable(background.id), false);
  assert.notEqual(layers.getActiveLayerId(), background.id);

  // Hiding layer makes it not editable
  // Hiding a layer makes it not editable
  layers.setVisible(annotations.id, false);
  assert.equal(layers.isVisible(annotations.id), false);
  assert.equal(layers.isEditable(annotations.id), false);

  // Re-enable visibility and unlock
  layers.setVisible(annotations.id, true);
  assert.equal(layers.isVisible(annotations.id), true);
  layers.setLocked(background.id, false);
  assert.equal(layers.isEditable(background.id), true);
});

test('layer deletion returns stable fallback and refuses to delete the last layer', () => {
  const layers = new LayerManager();
  const notesLayer = layers.create('Notes Layer');
  const textManager = new TextManager(layers);

  // Add elements on the notes layer
  // Activate notes layer and add a sticky note
  layers.setActive(notesLayer.id);
  const note = createStickyNote({ id: 'sticky-layer-del', x: 20, y: 30 });
  textManager.addText(note);
  assert.equal(note.layerId, notesLayer.id);

  // Add a shape via stub
  const shapeManager = new FakeShapeManager();
  const shape: Shape = {
    id: 'shape-layer-del',
    type: 'shape',
    shapeType: 'rectangle',
    x: 10,
    y: 10,
    width: 100,
    height: 50,
    color: '#000000',
    strokeWidth: 2,
    fill: null,
    rotation: 0,
    createdAt: 1,
    layerId: notesLayer.id,
  };
  shapeManager.addShape(shape);

  // Delete notesLayer
  const removal = layers.remove(notesLayer.id);
  assert.ok(removal);
  assert.equal(removal.removed.id, notesLayer.id);
  assert.equal(removal.fallbackId, 'layer-default');

  // Reassign elements from deleted layer to fallback layer
  // Reassign elements from deleted layer to fallback
  for (const t of textManager.getTexts()) {
    if (t.layerId === notesLayer.id) {
      t.layerId = removal.fallbackId;
    }
    if (t.layerId === notesLayer.id) t.layerId = removal.fallbackId;
  }
  for (const s of shapeManager.getShapes()) {
    if (s.layerId === notesLayer.id) {
      s.layerId = removal.fallbackId;
    }
    if (s.layerId === notesLayer.id) s.layerId = removal.fallbackId;
  }

  assert.equal(textManager.getTexts()[0].layerId, 'layer-default');
  assert.equal(shapeManager.getShapes()[0].layerId, 'layer-default');

  // Verify cannot delete the last layer
  const nullRemoval = layers.remove('layer-default');
  assert.equal(nullRemoval, null);
});

test('layer persistence roundtrip in DrawingData v3 restores full layer stack and active layer', () => {
  const layers = new LayerManager();
  const layer1 = layers.create('Sketch');
  const layer2 = layers.create('Notes');
  layers.setActive(layer1.id);
  layers.setLocked(layer2.id, true);

  const drawingData: DrawingData = {
    version: 3,
    objects: [],
    strokes: [],
    shapes: [],
    texts: [],
    images: [],
    layers: layers.getLayers() as any[],
    activeLayerId: layers.getActiveLayerId(),
  };

  const serialized = JSON.stringify(drawingData);
  const restored = JSON.parse(serialized) as DrawingData;

  // Restore into fresh LayerManager via setData()
  const restoredLayers = new LayerManager();
  restoredLayers.setData(restored.layers || [], restored.activeLayerId);

  assert.equal(restoredLayers.getLayers().length, 3);
  assert.equal(restoredLayers.getActiveLayerId(), layer1.id);
  const restoredLayer2 = restoredLayers.getLayers().find(l => l.id === layer2.id)!;
  assert.equal(restoredLayer2.locked, true);
  assert.equal(restoredLayers.isEditable(layer1.id), true);
});
