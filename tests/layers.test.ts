import assert from 'node:assert/strict';
import test from 'node:test';
import { LayerManager } from '../src/components/notebook/engine/LayerManager.ts';
import { getStarterElements, validateElementSnapshot } from '../src/services/elements/LocalElementRepository.ts';
import { AudioNoteManager } from '../src/components/notebook/engine/AudioNoteManager.ts';
import { constrainShapeDrag } from '../src/components/notebook/engine/shapeGeometry.ts';

test('layers preserve deterministic order and keep an editable active layer', () => {
  const layers = new LayerManager();
  const ink = layers.create('Ink');
  const notes = layers.create('Notes');
  assert.equal(layers.getActiveLayerId(), notes.id);

  assert.equal(layers.move(notes.id, -1), true);
  assert.deepEqual(layers.getLayers().map(layer => layer.name), ['Content', 'Notes', 'Ink']);

  layers.setLocked(notes.id, true);
  assert.notEqual(layers.getActiveLayerId(), notes.id);
  layers.setVisible(ink.id, false);
  assert.equal(layers.isVisible(ink.id), false);
  assert.equal(layers.isEditable(ink.id), false);
});

test('deleting a layer reports a stable fallback and never deletes the last layer', () => {
  const layers = new LayerManager();
  const extra = layers.create('Temporary');
  const removed = layers.remove(extra.id);
  assert.equal(removed?.removed.name, 'Temporary');
  assert.equal(removed?.fallbackId, 'layer-default');
  assert.equal(layers.remove('layer-default'), null);
});

test('missing active ID is repaired without discarding persisted locks or visibility', () => {
  const layers = new LayerManager();
  layers.setData([
    { id: 'locked', name: 'Locked', visible: true, locked: true, order: 99 },
    { id: 'hidden', name: 'Hidden', visible: false, locked: false, order: -3 },
  ], 'missing');
  const active = layers.getLayers().find(layer => layer.id === layers.getActiveLayerId());
  assert.ok(active?.visible);
  assert.equal(active?.locked, true);
  assert.equal(layers.isVisible('hidden'), false);
  assert.deepEqual(layers.getLayers().map(layer => layer.order), [0, 1]);
});

test('local Elements validate portable object groups and bundle offline starters', () => {
  const valid = validateElementSnapshot({
    type: 'panvas/elements', strokes: [], shapes: [{
      id: 'shape', type: 'shape', shapeType: 'rectangle', x: 10, y: 20,
      width: 30, height: 40, color: '#000000', strokeWidth: 2, fill: null, rotation: 0, createdAt: 1,
    }], texts: [], images: [],
  });
  assert.equal(valid?.shapes.length, 1);
  assert.equal(validateElementSnapshot({ type: 'panvas/elements', strokes: [], shapes: [], texts: [], images: [] }), null);
  assert.equal(validateElementSnapshot({ type: 'panvas/elements', strokes: [], shapes: [{ id: 'bad', type: 'shape', x: 'oops', y: 1 }], texts: [], images: [] }), null);
  assert.deepEqual(getStarterElements().map(element => element.category), ['Starter', 'Starter', 'Starter']);
});

test('audio note metadata round-trips and deletes independently of binary playback', () => {
  const audio = new AudioNoteManager();
  audio.setAll([{ id: 'audio-1', fileId: 'asset-1', fileName: 'note.webm', mimeType: 'audio/webm', durationMs: 1200, createdAt: 1 }]);
  assert.equal(audio.getAll()[0].durationMs, 1200);
  assert.equal(audio.remove('audio-1')?.fileId, 'asset-1');
  assert.equal(audio.getAll().length, 0);
});

test('shape constraints preserve squares and snap connectors to 15 degrees', () => {
  assert.deepEqual(constrainShapeDrag('ellipse', { x: 10, y: 10 }, { x: 40, y: 60 }, true), { x: 10, y: 10, width: 50, height: 50 });
  const line = constrainShapeDrag('arrow', { x: 0, y: 0 }, { x: 100, y: 13 }, true);
  assert.ok(Math.abs(line.height) < 0.0001);
  assert.ok(line.width > 100);
});
