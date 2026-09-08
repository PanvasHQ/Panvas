import assert from 'node:assert/strict';
import test from 'node:test';
import { HistoryManager } from '../src/components/notebook/engine/HistoryManager.ts';
import { applyGroupedTranslation, reorderQueueWithinLayers } from '../src/components/notebook/engine/mixedPlacement.ts';

type QueueItem = { id: string; layerId: string };

const ids = (items: QueueItem[]) => items.map(item => item.id);

test('z-order actions reorder selected peers and history restores their exact order', () => {
  const history = new HistoryManager();
  let queue: QueueItem[] = [
    { id: 'a', layerId: 'content' },
    { id: 'b', layerId: 'content' },
    { id: 'c', layerId: 'content' },
  ];

  const apply = (action: 'front' | 'back' | 'forward' | 'backward', selected: string[]) => {
    const before = queue;
    const after = reorderQueueWithinLayers(queue, new Set(selected), action);
    queue = after;
    history.pushExecuted({ execute: () => { queue = after; }, undo: () => { queue = before; } });
  };

  apply('forward', ['a']);
  assert.deepEqual(ids(queue), ['b', 'a', 'c']);
  history.undo();
  assert.deepEqual(ids(queue), ['a', 'b', 'c']);
  history.redo();
  assert.deepEqual(ids(queue), ['b', 'a', 'c']);

  apply('backward', ['c']);
  assert.deepEqual(ids(queue), ['b', 'c', 'a']);
  apply('front', ['b']);
  assert.deepEqual(ids(queue), ['c', 'a', 'b']);
  apply('back', ['b']);
  assert.deepEqual(ids(queue), ['b', 'c', 'a']);
});

test('grouped translation applies one exact delta to stroke, shape, text, and image', () => {
  const stroke = {
    id: 'stroke', type: 'stroke' as const, layerId: 'content', tool: 'pen' as const,
    color: '#000', thickness: 2, opacity: 1, createdAt: 0,
    points: [{ x: 10, y: 20, pressure: 0.5, t: 0 }, { x: 30, y: 25, pressure: 0.5, t: 1 }],
  };
  const shape = { id: 'shape', type: 'shape' as const, layerId: 'content', shapeType: 'rectangle' as const, x: 50, y: 60, width: 20, height: 20, color: '#000', strokeWidth: 2, fill: null, rotation: 0, createdAt: 0 };
  const text = { id: 'text', type: 'text' as const, layerId: 'content', x: 90, y: 100, width: 220, height: 180, content: {}, createdAt: 0 };
  const image = { id: 'image', type: 'image' as const, layerId: 'content', x: 130, y: 140, width: 80, height: 60, fileId: 'file', rotation: 0, createdAt: 0 };
  const originals = [
    stroke.points.map(point => ({ ...point })),
    { x: shape.x, y: shape.y },
    { x: text.x, y: text.y },
    { x: image.x, y: image.y },
  ];

  for (const [object, original] of [[stroke, originals[0]], [shape, originals[1]], [text, originals[2]], [image, originals[3]]] as const) {
    applyGroupedTranslation(object, original, 17, -9);
  }

  assert.deepEqual(stroke.points.map(({ x, y }) => ({ x, y })), [{ x: 27, y: 11 }, { x: 47, y: 16 }]);
  assert.deepEqual({ x: shape.x, y: shape.y }, { x: 67, y: 51 });
  assert.deepEqual({ x: text.x, y: text.y }, { x: 107, y: 91 });
  assert.deepEqual({ x: image.x, y: image.y }, { x: 147, y: 131 });
});

test('z-order reordering never crosses a PageLayer boundary', () => {
  const queue: QueueItem[] = [
    { id: 'content-a', layerId: 'content' },
    { id: 'annotation-a', layerId: 'annotation' },
    { id: 'content-b', layerId: 'content' },
    { id: 'annotation-b', layerId: 'annotation' },
  ];

  const reordered = reorderQueueWithinLayers(queue, new Set(['content-a']), 'front');
  assert.deepEqual(ids(reordered), ['content-b', 'annotation-a', 'content-a', 'annotation-b']);
  assert.deepEqual(
    reordered.filter(item => item.layerId === 'annotation').map(item => item.id),
    ['annotation-a', 'annotation-b'],
  );
});
