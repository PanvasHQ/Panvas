import type { Stroke } from '@/components/notebook/engine/drawingTypes';
import type { HandwritingRecognitionProvider, RecognitionOptions, RecognitionResult } from '../types.ts';
import { UNSUPPORTED_RECOGNITION_MESSAGE } from './UnsupportedRecognitionProvider.ts';

interface NativeHandwritingStroke {
  addPoint(point: { x: number; y: number; t: number }): void;
}

interface NativeHandwritingDrawing {
  addStroke(stroke: NativeHandwritingStroke): void;
  getPrediction(): Promise<Array<{ text: string }>>;
}

interface NativeHandwritingRecognizer {
  startDrawing(hints?: { recognitionType?: string; alternatives?: number }): NativeHandwritingDrawing;
  finish(): void;
}

export interface WebHandwritingApi {
  createHandwritingRecognizer(constraint: { languages: string[] }): Promise<NativeHandwritingRecognizer>;
  HandwritingStroke: new () => NativeHandwritingStroke;
}

function runtimeApi(): WebHandwritingApi | null {
  if (typeof navigator === 'undefined' || typeof navigator.createHandwritingRecognizer !== 'function') return null;
  const StrokeConstructor = (globalThis as typeof globalThis & {
    HandwritingStroke?: new () => NativeHandwritingStroke;
  }).HandwritingStroke;
  if (!StrokeConstructor) return null;
  return {
    createHandwritingRecognizer: navigator.createHandwritingRecognizer.bind(navigator),
    HandwritingStroke: StrokeConstructor,
  };
}

type QueryHandwritingRecognizer = (constraint: { languages: string[] }) => Promise<unknown>;

/**
 * Feature-detected independently of createHandwritingRecognizer: the query
 * API reports whether a recognizer (and language model) genuinely exists,
 * while the create API performs the recognition itself. Either may ship
 * without the other.
 */
function queryHandwritingRecognizerApi(): QueryHandwritingRecognizer | null {
  if (typeof navigator === 'undefined') return null;
  const candidate = (navigator as Navigator & { queryHandwritingRecognizer?: QueryHandwritingRecognizer }).queryHandwritingRecognizer;
  return typeof candidate === 'function' ? candidate.bind(navigator) : null;
}

/** Native Chromium/OS digital-ink adapter. It never rasterizes page content. */
export class WebHandwritingRecognitionProvider implements HandwritingRecognitionProvider {
  readonly id = 'web-handwriting-api';
  readonly name = 'Browser handwriting recognition';
  readonly isOffline = true as const;
  private readonly api: WebHandwritingApi | null;
  private availabilityQuery: Promise<boolean> | null = null;

  constructor(api: WebHandwritingApi | null = runtimeApi()) {
    this.api = api;
  }

  /**
   * True only when the browser actually exposes a working handwriting
   * recognizer. When the query API exists it is authoritative (a flag-gated
   * create API can still lack a downloadable model for the language); a
   * missing or throwing query falls back to the API-surface check so the
   * existing safe creation path is preserved. The query runs at most once.
   */
  async isAvailable(): Promise<boolean> {
    if (!this.api) return false;
    const query = queryHandwritingRecognizerApi();
    if (!query) return true;
    if (!this.availabilityQuery) {
      const language = typeof navigator !== 'undefined' ? navigator.language : 'en';
      this.availabilityQuery = query({ languages: [language] })
        .then(result => result !== null && result !== undefined)
        .catch(() => true);
    }
    return this.availabilityQuery;
  }

  async recognize(strokes: Stroke[], options: RecognitionOptions = {}): Promise<RecognitionResult> {
    if (!this.api) return { status: 'unavailable', text: '', isAvailable: false, error: UNSUPPORTED_RECOGNITION_MESSAGE };
    let recognizer: NativeHandwritingRecognizer | null = null;
    try {
      const language = options.language?.trim() || (typeof navigator !== 'undefined' ? navigator.language : 'en');
      recognizer = await this.api.createHandwritingRecognizer({ languages: [language] });
      const drawing = recognizer.startDrawing({ recognitionType: 'text', alternatives: 5 });
      const drawingStart = Math.min(...strokes.map(stroke => stroke.createdAt));

      // Preserve stroke array order and place every point on one drawing-wide
      // time axis, as required by the WICG digital-ink API.
      for (const source of strokes) {
        const nativeStroke = new this.api.HandwritingStroke();
        for (const point of source.points) {
          nativeStroke.addPoint({
            x: point.x,
            y: point.y,
            t: Math.max(0, source.createdAt - drawingStart + point.t),
          });
        }
        drawing.addStroke(nativeStroke);
      }

      const predictions = await drawing.getPrediction();
      const candidates = predictions
        .map(prediction => prediction?.text)
        .filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0);
      return {
        status: candidates.length > 0 ? 'success' : 'empty',
        text: candidates[0] ?? '',
        candidates,
        language,
        isAvailable: true,
      };
    } catch (error) {
      return {
        status: 'error',
        text: '',
        isAvailable: true,
        error: error instanceof Error ? error.message : 'Browser handwriting recognition failed.',
      };
    } finally {
      recognizer?.finish();
    }
  }
}
