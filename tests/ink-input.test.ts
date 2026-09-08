import assert from 'node:assert/strict';
import test from 'node:test';
import { InkInputFilter, mapPointerPressure } from '../src/components/notebook/engine/inkInput.ts';

test('pressure mapping uses stylus pressure only when enabled and keeps mouse stable', () => {
  assert.equal(mapPointerPressure('mouse', 0.03, true), 0.5);
  assert.equal(mapPointerPressure('pen', 0.9, false), 0.5);
  assert.equal(mapPointerPressure('pen', 0, true), 0.5);
  assert.ok(mapPointerPressure('pen', 0.15, true) < mapPointerPressure('pen', 0.5, true));
  assert.ok(mapPointerPressure('pen', 0.85, true) > mapPointerPressure('pen', 0.5, true));
});

test('stabilization is raw at zero and progressively damps jitter without freezing intent', () => {
  const source = [0, 8, -7, 9, -8, 10].map((y, index) => ({ x: index * 4, y, pressure: 0.2 + index * 0.12, t: index * 8 }));
  const raw = new InkInputFilter();
  const strong = new InkInputFilter();
  const rawPoints = source.map(point => raw.push(point, 0));
  const stablePoints = source.map(point => strong.push(point, 100));
  assert.deepEqual(rawPoints, source);
  const rawVariation = rawPoints.slice(1).reduce((sum, point, i) => sum + Math.abs(point.y - rawPoints[i].y), 0);
  const stableVariation = stablePoints.slice(1).reduce((sum, point, i) => sum + Math.abs(point.y - stablePoints[i].y), 0);
  assert.ok(stableVariation < rawVariation * 0.82);
  assert.ok(stablePoints.at(-1)!.x > source.at(-1)!.x * 0.65, 'high stabilization must retain low latency');
  assert.ok(stablePoints.at(-1)!.pressure < source.at(-1)!.pressure, 'pressure noise is smoothed too');
});

test('filter reset isolates consecutive strokes', () => {
  const filter = new InkInputFilter();
  filter.push({ x: 500, y: 500, pressure: 1, t: 10 }, 100);
  filter.reset();
  assert.deepEqual(filter.push({ x: 10, y: 20, pressure: .2, t: 0 }, 100), { x: 10, y: 20, pressure: .2, t: 0 });
});
