import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStrokePatternGeometry } from '../src/components/notebook/engine/strokePatternGeometry.ts';
import type { StrokePoint } from '../src/components/notebook/engine/drawingTypes.ts';

const line = (length: number, step: number): StrokePoint[] => Array.from(
  { length: Math.floor(length / step) + 1 },
  (_, index) => ({ x: index * step, y: 0, pressure: 0.5, t: index }),
);

test('dashed geometry keeps one phase across dense input segments', () => {
  const geometry = buildStrokePatternGeometry(line(120, 3), 'dashed', 4);
  assert.ok(geometry.dashes.length >= 4);
  for (const dash of geometry.dashes.slice(0, -1)) {
    const length = dash.slice(1).reduce((sum, point, index) => (
      sum + Math.hypot(point.x - dash[index].x, point.y - dash[index].y)
    ), 0);
    assert.ok(Math.abs(length - 16) < 0.001, `expected stable 16px dash, got ${length}`);
  }
});

test('dotted geometry uses even arc-length spacing around a corner', () => {
  const points: StrokePoint[] = [
    { x: 0, y: 0, pressure: 0.5, t: 0 },
    { x: 30, y: 0, pressure: 0.5, t: 1 },
    { x: 30, y: 30, pressure: 0.5, t: 2 },
  ];
  const dots = buildStrokePatternGeometry(points, 'dotted', 4).dots;
  assert.equal(dots.length, 7);
  const pathDistances = dots.map(point => point.y === 0 ? point.x : 30 + point.y);
  for (let index = 1; index < pathDistances.length; index += 1) {
    assert.ok(Math.abs(pathDistances[index] - pathDistances[index - 1] - 9.4) < 0.001);
  }
});


test('vector line styles share deterministic rotated rendering and hit geometry', async () => {
  const { LINE_STYLES, buildLineStyleGeometry, lineStyleHit } = await import('../src/components/notebook/engine/lineStyleGeometry.ts');
  for (const lineStyle of LINE_STYLES) for (const rotation of [0, 90, 237]) {
    const shape = { id: 'line', type: 'shape' as const, createdAt: 0, shapeType: 'arrow' as const, x: 10, y: 20, width: 170, height: -30, rotation, color: '#000000', fill: null, strokeWidth: 2, lineStyle };
    const g = buildLineStyleGeometry(shape);
    assert.deepEqual(buildLineStyleGeometry(JSON.parse(JSON.stringify(shape))), g);
    for (const p of [...g.paths.flat(), ...g.dots]) {
      assert.ok(lineStyleHit(shape, p, 0.1));
      assert.ok(p.x >= g.bounds.x && p.x <= g.bounds.x + g.bounds.width);
      assert.ok(p.y >= g.bounds.y && p.y <= g.bounds.y + g.bounds.height);
    }
    assert.equal(lineStyleHit(shape, { x: 10000, y: 10000 }, 5), false);
  }
});
