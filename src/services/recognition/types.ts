import type { Stroke } from '@/components/notebook/engine/drawingTypes';

export interface RecognitionOptions {
  language?: string;
}

export type RecognitionStatus = 'success' | 'empty' | 'unavailable' | 'error';

export interface RecognitionResult {
  status: RecognitionStatus;
  text: string;
  candidates?: string[];
  language?: string;
  /** False only when the requested native recognizer/model is genuinely unavailable. */
  isAvailable: boolean;
  error?: string;
}

/**
 * An explicitly requested, on-device recognition boundary. Implementations only
 * receive vector ink and return recognition data; they never manipulate pages.
 */
export interface HandwritingRecognitionProvider {
  readonly id: string;
  readonly name: string;
  readonly isOffline: true;

  isAvailable(): Promise<boolean>;
  recognize(strokes: Stroke[], options?: RecognitionOptions): Promise<RecognitionResult>;
}

export interface RecognitionStrokePayload {
  id: string;
  points: Array<{ x: number; y: number; pressure: number; t: number }>;
}

const MAX_STROKES = 128;
const MAX_POINTS_PER_STROKE = 10_000;
const MAX_COORDINATE = 1_000_000;
const MAX_TIMESTAMP = 86_400_000;

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Creates a bounded copy for the Electron trust boundary. It deliberately does
 * not mutate the persisted stroke objects supplied by the notebook engine.
 */
export function sanitizeRecognitionStrokes(input: unknown): RecognitionStrokePayload[] {
  if (!Array.isArray(input)) throw new Error('Recognition input must be an array of strokes.');
  if (input.length > MAX_STROKES) throw new Error(`Recognition supports at most ${MAX_STROKES} strokes per request.`);

  return input.flatMap((candidate, strokeIndex) => {
    if (!candidate || typeof candidate !== 'object') throw new Error(`Invalid recognition stroke at index ${strokeIndex}.`);
    const raw = candidate as { id?: unknown; points?: unknown };
    if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 160) {
      throw new Error(`Invalid recognition stroke identifier at index ${strokeIndex}.`);
    }
    if (!Array.isArray(raw.points) || raw.points.length > MAX_POINTS_PER_STROKE) {
      throw new Error(`Invalid recognition points at stroke ${strokeIndex}.`);
    }

    const points = raw.points.flatMap((point, pointIndex) => {
      if (!point || typeof point !== 'object') throw new Error(`Invalid recognition point at ${strokeIndex}:${pointIndex}.`);
      const rawPoint = point as { x?: unknown; y?: unknown; pressure?: unknown; t?: unknown };
      const x = finiteNumber(rawPoint.x, NaN);
      const y = finiteNumber(rawPoint.y, NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Recognition point coordinates must be finite at ${strokeIndex}:${pointIndex}.`);
      }
      return [{
        x: clamp(x, -MAX_COORDINATE, MAX_COORDINATE),
        y: clamp(y, -MAX_COORDINATE, MAX_COORDINATE),
        pressure: clamp(finiteNumber(rawPoint.pressure, 0.5), 0, 1),
        t: clamp(finiteNumber(rawPoint.t, 0), 0, MAX_TIMESTAMP),
      }];
    });

    // Windows Ink requires an actual path. Ignore isolated taps rather than
    // manufacturing a segment that did not exist in the user's ink.
    return points.length >= 2 ? [{ id: raw.id, points }] : [];
  });
}
