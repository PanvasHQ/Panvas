import assert from 'node:assert/strict';
import test from 'node:test';
import {
  sourceRectToVisual,
  sourceToVisual,
  visualDeltaToSource,
  visualPageDimensions,
  visualToSource,
} from '../src/components/notebook/engine/pdfCoordinates.ts';
import { pdfAnnotationStorageId } from '../src/services/search/searchIndexEvents.ts';

const dimensions = { width: 300, height: 500 };
const sourcePoint = { x: 72, y: 144 };

test('PDF source/visual point transforms use real non-square dimensions and round-trip', () => {
  const expected = {
    0: { x: 72, y: 144 },
    90: { x: 356, y: 72 },
    180: { x: 228, y: 356 },
    270: { x: 144, y: 228 },
  } as const;

  for (const rotation of [0, 90, 180, 270] as const) {
    assert.deepEqual(sourceToVisual(sourcePoint, dimensions, rotation), expected[rotation]);
    assert.deepEqual(visualToSource(expected[rotation], dimensions, rotation), sourcePoint);
  }
  assert.deepEqual(visualPageDimensions(dimensions, 0), { width: 300, height: 500 });
  assert.deepEqual(visualPageDimensions(dimensions, 90), { width: 500, height: 300 });
  assert.deepEqual(visualPageDimensions(dimensions, 270), { width: 500, height: 300 });
});

test('PDF source rectangles resolve to rotated visual bounding boxes without mutating canonical coordinates', () => {
  const sourceRect = { x: 20, y: 40, width: 80, height: 30 };
  const expected = {
    0: { x: 20, y: 40, width: 80, height: 30 },
    90: { x: 430, y: 20, width: 30, height: 80 },
    180: { x: 200, y: 430, width: 80, height: 30 },
    270: { x: 40, y: 200, width: 30, height: 80 },
  } as const;

  for (const rotation of [0, 90, 180, 270] as const) {
    assert.deepEqual(sourceRectToVisual(sourceRect, dimensions, rotation), expected[rotation]);
  }
  assert.deepEqual(sourceRect, { x: 20, y: 40, width: 80, height: 30 });
});

test('rotated text placement contract swaps visual bounds while retaining source placement', () => {
  const text = { x: 90, y: 120, width: 160, height: 72 };
  const visual = sourceRectToVisual(text, dimensions, 90);

  assert.deepEqual(visual, { x: 308, y: 90, width: 72, height: 160 });
  assert.deepEqual(text, { x: 90, y: 120, width: 160, height: 72 });
});

test('rotated text resize deltas stay in canonical source axes', () => {
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 0), { x: 5, y: 8 });
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 90), { x: 8, y: -5 });
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 180), { x: -5, y: -8 });
  assert.deepEqual(visualDeltaToSource({ x: 5, y: 8 }, 270), { x: -8, y: 5 });
});

test('primary and secondary PDF annotations have isolated canonical storage identities', () => {
  const primary = pdfAnnotationStorageId('pdf-owner', 1);
  const secondary = pdfAnnotationStorageId('pdf-owner', 2);
  const persisted = new Map<string, string>();

  persisted.set(primary, 'primary text');
  persisted.set(secondary, 'secondary text');

  assert.notEqual(primary, secondary);
  assert.equal(persisted.get(primary), 'primary text');
  assert.equal(persisted.get(secondary), 'secondary text');
});

test('mixed-rotation two-page spread keeps each page dimensions and text coordinates independent', () => {
  const primary = sourceRectToVisual({ x: 30, y: 40, width: 100, height: 50 }, dimensions, 0);
  const secondary = sourceRectToVisual({ x: 30, y: 40, width: 100, height: 50 }, dimensions, 90);

  assert.deepEqual(primary, { x: 30, y: 40, width: 100, height: 50 });
  assert.deepEqual(secondary, { x: 410, y: 30, width: 50, height: 100 });
  assert.deepEqual(visualPageDimensions(dimensions, 0), { width: 300, height: 500 });
  assert.deepEqual(visualPageDimensions(dimensions, 90), { width: 500, height: 300 });
});

test('annotation export receives canonical source coordinates, not rotated DOM coordinates', () => {
  const canonical = { x: 28, y: 64, width: 140, height: 72 };
  const visual = sourceRectToVisual(canonical, dimensions, 270);

  // The DOM uses visual for placement, while persistence/export continues to use canonical.
  assert.notDeepEqual(visual, canonical);
  assert.deepEqual(canonical, { x: 28, y: 64, width: 140, height: 72 });
});
