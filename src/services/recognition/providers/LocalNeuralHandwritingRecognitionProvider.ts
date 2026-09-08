import type { Stroke } from '@/components/notebook/engine/drawingTypes';
import type { HandwritingRecognitionProvider, RecognitionOptions, RecognitionResult } from '../types.ts';
import {
  computeInkLineSpec,
  renderNormalizedLineImage,
  type BitmapSurface,
} from '../neural/inkRasterizer.ts';
import type { NeuralBackend, NeuralWorkerRequest, NeuralWorkerResponse } from '../neural/neuralWorkerProtocol.ts';

export interface NeuralWorkerHandle {
  postMessage(message: NeuralWorkerRequest): void;
  terminate(): void;
  set onmessage(handler: ((event: MessageEvent<NeuralWorkerResponse>) => void) | null);
}

export interface NeuralRuntimeFactory {
  createWorker(): NeuralWorkerHandle | null;
  createBitmapSurface(width: number, height: number): BitmapSurface | null;
}

const DEFAULT_RUNTIME: NeuralRuntimeFactory = {
  createWorker(): NeuralWorkerHandle | null {
    if (typeof Worker === 'undefined') return null;
    try {
      const worker = new Worker(new URL('../neural/neuralRecognitionWorker.ts', import.meta.url), { type: 'module' });
      return worker as unknown as NeuralWorkerHandle;
    } catch {
      return null;
    }
  },
  createBitmapSurface(width: number, height: number): BitmapSurface | null {
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        if (!context) return null;
        return { createImageData: (w, h) => context.createImageData(w, h) };
      } catch {
        return null;
      }
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return null;
      return { createImageData: (w, h) => context.createImageData(w, h) };
    }
    return null;
  },
};

export type NeuralStatusState = 'preparing' | 'downloading' | 'ready' | 'error';

export interface NeuralStatusDetail {
  state: NeuralStatusState;
  message: string;
}

export const NEURAL_STATUS_EVENT = 'panvas:neural-status';

/** One-time, deduplicated first-use notices — never repeated spam. */
const emittedStatuses = new Set<NeuralStatusState>();
function emitStatusOnce(state: NeuralStatusState, message: string): void {
  if (typeof document === 'undefined' || emittedStatuses.has(state)) return;
  emittedStatuses.add(state);
  document.dispatchEvent(new CustomEvent<NeuralStatusDetail>(NEURAL_STATUS_EVENT, { detail: { state, message } }));
}

const INIT_TIMEOUT_MS = 120_000; // first-use model download can be slow
const RECOGNIZE_TIMEOUT_MS = 30_000;

interface RuntimeSession {
  worker: NeuralWorkerHandle;
  initPromise: Promise<NeuralBackend>;
  /** Shared dispatcher state: every in-flight recognize waits in this map. */
  pending: Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>;
}

// One worker/model runtime per application context, shared by every provider
// instance (the factory creates a fresh handle per engine/dialog, but the
// model must initialize exactly once and never redownload per phrase).
let runtimeSession: RuntimeSession | null = null;
let runtimeFailure: string | null = null;
let runtimeReady = false;
let nextRequestId = 1;

function resetRuntime(): void {
  runtimeSession?.worker.terminate();
  runtimeSession = null;
  runtimeReady = false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

function createRuntimeSession(factory: NeuralRuntimeFactory): RuntimeSession {
  const worker = factory.createWorker();
  if (!worker) throw new Error('Web Worker unavailable for local handwriting recognition.');

  const pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
  const initListeners: Array<(response: NeuralWorkerResponse) => void> = [];

  const baseHandler = (event: MessageEvent<NeuralWorkerResponse>) => {
    const response = event.data;
    if (!response) return;
    if (response.type === 'download-progress') {
      emitStatusOnce('downloading', 'Downloading local handwriting model (~65 MB). This is needed only once.');
      return;
    }
    if (response.type === 'init-ok' || response.type === 'init-failed') {
      const listeners = initListeners.splice(0, initListeners.length);
      for (const listener of listeners) listener(response);
      if (response.type === 'init-ok') emitStatusOnce('ready', 'On-device handwriting recognition is ready.');
      return;
    }
    if (response.type === 'recognize-ok') {
      pending.get(response.requestId)?.resolve(response.text);
      pending.delete(response.requestId);
      return;
    }
    if (response.type === 'recognize-failed') {
      pending.get(response.requestId)?.reject(new Error(response.error));
      pending.delete(response.requestId);
    }
  };
  worker.onmessage = baseHandler;

  emitStatusOnce('preparing', 'Preparing on-device handwriting recognition…');

  const initPromise = new Promise<NeuralBackend>((resolve, reject) => {
    initListeners.push(response => {
      if (response.type === 'init-ok') resolve(response.backend);
      else if (response.type === 'init-failed') reject(new Error(response.error));
    });
    worker.postMessage({ type: 'init' });
  });

  return { worker, initPromise, pending };
}

/**
 * Local on-device neural handwriting fallback (EXPERIMENTAL).
 *
 * Rasterizes Panvas vector strokes into a normalized line image and runs the
 * English-only TrOCR int8 model fully on-device via transformers.js in a Web
 * Worker. Implements the existing provider contract; ink is never uploaded
 * and never mutated. Every failure resolves to a safe RecognitionResult that
 * preserves the user's raw ink.
 */
export class LocalNeuralHandwritingRecognitionProvider implements HandwritingRecognitionProvider {
  readonly id = 'local-neural';
  readonly name = 'Local on-device recognition';
  readonly isOffline = true as const;
  private readonly factory: NeuralRuntimeFactory;

  constructor(factory: NeuralRuntimeFactory = DEFAULT_RUNTIME) {
    this.factory = factory;
  }

  /**
   * Cheap, non-downloading capability check. Model preparation intentionally
   * happens on first recognize — never at activation, startup, or here.
   */
  async isAvailable(): Promise<boolean> {
    if (runtimeFailure) return false;
    if (runtimeSession) return true;
    const worker = this.factory.createWorker();
    if (!worker) return false;
    worker.terminate();
    return true;
  }

  async recognize(strokes: Stroke[], options: RecognitionOptions = {}): Promise<RecognitionResult> {
    const language = options.language?.trim() || '';
    if (language && !/^en(\b|-|_|$)/i.test(language)) {
      return {
        status: 'unavailable',
        text: '',
        isAvailable: false,
        language,
        error: `Local on-device handwriting recognition currently supports English only (requested: ${language}). Your ink will be kept.`,
      };
    }

    const spec = computeInkLineSpec(strokes);
    if (!spec) return { status: 'empty', text: '', isAvailable: true };

    const surface = this.factory.createBitmapSurface(spec.width, spec.height);
    if (!surface) {
      return { status: 'unavailable', text: '', isAvailable: false, error: 'Canvas rasterization is unavailable in this environment. Your ink will be kept.' };
    }
    const image = renderNormalizedLineImage(spec, surface);
    const bitmap = { data: image.imageData.data, width: image.width, height: image.height };

    const startedAt = Date.now();
    try {
      const { text, backend } = await withTimeout(
        this.runInference(bitmap),
        RECOGNIZE_TIMEOUT_MS,
        'Local handwriting recognition',
      );
      const trimmed = text.trim();
      if (typeof console !== 'undefined') {
        console.info(`[Panvas recognition] provider=local-neural backend=${backend ?? 'unknown'} latencyMs=${Date.now() - startedAt}`);
      }
      if (!trimmed) return { status: 'empty', text: '', isAvailable: true, language: 'en' };
      return { status: 'success', text: trimmed, isAvailable: true, language: 'en' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const preparationFailed = !runtimeReady || /timed out|Worker unavailable|model preparation/i.test(message);
      if (preparationFailed) {
        // Initialization/wedge failure: reset so a later attempt gets a fresh
        // worker, and stop advertising availability until reload.
        resetRuntime();
        runtimeFailure = message;
        emitStatusOnce('error', 'On-device handwriting recognition could not be prepared. Your ink will be kept.');
        return { status: 'unavailable', text: '', isAvailable: false, error: 'Local handwriting recognition is unavailable on this device. Your ink will be kept.' };
      }
      return { status: 'error', text: '', isAvailable: true, error: 'Local handwriting recognition failed. Your ink was kept.' };
    }
  }

  /**
   * Harness-facing entry: run inference on a prepared ink bitmap without the
   * stroke rasterizer (the benchmark lab feeds prepared line images). Same
   * runtime, timeouts, and failure semantics as recognize().
   */
  async recognizeInkBitmap(
    image: { data: Uint8ClampedArray; width: number; height: number },
    options: RecognitionOptions = {},
  ): Promise<RecognitionResult> {
    const language = options.language?.trim() || '';
    if (language && !/^en(\b|-|_|$)/i.test(language)) {
      return { status: 'unavailable', text: '', isAvailable: false, language, error: 'Local on-device handwriting recognition currently supports English only. Your ink will be kept.' };
    }
    const startedAt = Date.now();
    try {
      const { text, backend } = await withTimeout(this.runInference(image), RECOGNIZE_TIMEOUT_MS, 'Local handwriting recognition');
      const trimmed = text.trim();
      if (typeof console !== 'undefined') {
        console.info(`[Panvas recognition] provider=local-neural backend=${backend ?? 'unknown'} latencyMs=${Date.now() - startedAt}`);
      }
      if (!trimmed) return { status: 'empty', text: '', isAvailable: true, language: 'en' };
      return { status: 'success', text: trimmed, isAvailable: true, language: 'en' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/timed out|Worker unavailable|model preparation/i.test(message) || !runtimeSession) {
        resetRuntime();
        runtimeFailure = message;
        emitStatusOnce('error', 'On-device handwriting recognition could not be prepared. Your ink will be kept.');
        return { status: 'unavailable', text: '', isAvailable: false, error: 'Local handwriting recognition is unavailable on this device. Your ink will be kept.' };
      }
      return { status: 'error', text: '', isAvailable: true, error: 'Local handwriting recognition failed. Your ink was kept.' };
    }
  }

  private runInference(image: { data: Uint8ClampedArray; width: number; height: number }): Promise<{ text: string; backend: NeuralBackend | null }> {
    if (runtimeFailure) return Promise.reject(new Error(runtimeFailure));
    if (!runtimeSession) {
      try {
        runtimeSession = createRuntimeSession(this.factory);
      } catch (error) {
        runtimeFailure = error instanceof Error ? error.message : String(error);
        return Promise.reject(error instanceof Error ? error : new Error(runtimeFailure));
      }
    }
    const session = runtimeSession;
    const requestId = nextRequestId++;
    let backend: NeuralBackend | null = null;
    return new Promise<{ text: string; backend: NeuralBackend | null }>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        session.pending.delete(requestId);
        fn();
      };

      // One stable worker dispatcher routes responses through the shared
      // pending map, so concurrent recognizes can never clobber each other.
      session.pending.set(requestId, {
        resolve: text => settle(() => resolve({ text, backend })),
        reject: error => settle(() => reject(error)),
      });

      (async () => {
        // Reuse the shared singleton initialization; concurrent callers await
        // the same promise and never trigger a second download.
        backend = await session.initPromise;
        runtimeReady = true;
        session.worker.postMessage({ type: 'recognize', requestId, image });
      })().catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        // Failures before the recognize request leaves are preparation
        // failures (download/cache/runtime), distinct from inference ones.
        settle(() => reject(new Error(`Local handwriting model preparation failed: ${message}`)));
      });
    });
  }
}

/** Test-only: resets the shared worker/model runtime between scenarios. */
export function resetNeuralRuntimeForTests(): void {
  resetRuntime();
  runtimeFailure = null;
  emittedStatuses.clear();
}
