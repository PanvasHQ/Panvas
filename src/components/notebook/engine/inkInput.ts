import type { StrokePoint } from './drawingTypes.ts';

/** Maps PointerEvent pressure without inventing pressure for devices that do not report it. */
export function mapPointerPressure(pointerType: string, pressure: number, enabled: boolean): number {
  if (!enabled || pointerType === 'mouse' || !Number.isFinite(pressure) || pressure <= 0) return 0.5;
  const clamped = Math.max(0.01, Math.min(1, pressure));
  // Smoothstep suppresses noisy low-end hardware values while retaining the full range.
  return clamped * clamped * (3 - 2 * clamped);
}

/** Stateful, low-latency spatial and pressure filter owned by one pointer gesture. */
export class InkInputFilter {
  private previous: StrokePoint | null = null;

  reset(): void { this.previous = null; }

  push(raw: StrokePoint, stabilization: number): StrokePoint {
    const prior = this.previous;
    if (!prior) {
      this.previous = { ...raw };
      return { ...raw };
    }
    const amount = Math.max(0, Math.min(1, stabilization / 100));
    const distance = Math.hypot(raw.x - prior.x, raw.y - prior.y);
    // Slow/jittery motion receives stronger filtering. Fast intent catches up quickly.
    const spatialAlpha = Math.min(1, (1 - amount) + amount * (0.16 + Math.min(0.68, distance / 24)));
    const pressureAlpha = 1 - amount * 0.72;
    const point = {
      x: prior.x + (raw.x - prior.x) * spatialAlpha,
      y: prior.y + (raw.y - prior.y) * spatialAlpha,
      pressure: prior.pressure + (raw.pressure - prior.pressure) * pressureAlpha,
      t: raw.t,
    };
    this.previous = point;
    return { ...point };
  }
}
