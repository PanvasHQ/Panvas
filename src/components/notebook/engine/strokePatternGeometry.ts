import type { StrokePattern, StrokePoint } from './drawingTypes.ts';

export interface StrokePatternGeometry {
  dashes: StrokePoint[][];
  dots: StrokePoint[];
}

const interpolatePoint = (start: StrokePoint, end: StrokePoint, ratio: number): StrokePoint => ({
  x: start.x + (end.x - start.x) * ratio,
  y: start.y + (end.y - start.y) * ratio,
  pressure: start.pressure + (end.pressure - start.pressure) * ratio,
  t: start.t + (end.t - start.t) * ratio,
});

/** Builds stable, arc-length based marks without resetting at input-point boundaries. */
export function buildStrokePatternGeometry(
  points: readonly StrokePoint[],
  pattern: Exclude<StrokePattern, 'solid'>,
  thickness: number,
): StrokePatternGeometry {
  if (points.length < 2) return { dashes: [], dots: [] };

  if (pattern === 'dotted') {
    const spacing = Math.max(5, thickness * 2.35);
    const dots: StrokePoint[] = [{ ...points[0] }];
    let travelled = 0;
    let nextDot = spacing;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length <= Number.EPSILON) continue;
      while (nextDot <= travelled + length + Number.EPSILON) {
        dots.push(interpolatePoint(start, end, (nextDot - travelled) / length));
        nextDot += spacing;
      }
      travelled += length;
    }
    return { dashes: [], dots };
  }

  const dashLength = Math.max(9, thickness * 4);
  const gapLength = Math.max(6, thickness * 2.25);
  const dashes: StrokePoint[][] = [];
  let painting = true;
  let remaining = dashLength;
  let currentDash: StrokePoint[] = [{ ...points[0] }];

  for (let index = 1; index < points.length; index += 1) {
    const sourceStart = points[index - 1];
    const sourceEnd = points[index];
    const segmentLength = Math.hypot(sourceEnd.x - sourceStart.x, sourceEnd.y - sourceStart.y);
    if (segmentLength <= Number.EPSILON) continue;
    let consumed = 0;

    while (consumed < segmentLength - Number.EPSILON) {
      const step = Math.min(remaining, segmentLength - consumed);
      const end = interpolatePoint(sourceStart, sourceEnd, (consumed + step) / segmentLength);
      if (painting) currentDash.push(end);
      consumed += step;
      remaining -= step;

      if (remaining <= Number.EPSILON) {
        if (painting && currentDash.length > 1) dashes.push(currentDash);
        painting = !painting;
        remaining = painting ? dashLength : gapLength;
        currentDash = painting ? [{ ...end }] : [];
      }
    }
  }

  if (painting && currentDash.length > 1) dashes.push(currentDash);
  return { dashes, dots: [] };
}
