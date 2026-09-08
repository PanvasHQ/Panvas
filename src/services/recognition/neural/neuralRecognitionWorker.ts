/// <reference lib="webworker" />
/**
 * Local on-device handwriting recognition worker.
 *
 * Owns the transformers.js/ONNX runtime and the experimental English-only
 * TrOCR model (int8). Initialization is a single cached promise so concurrent
 * requests never trigger multiple downloads. WebGPU is attempted first and
 * WASM (single-threaded — no cross-origin isolation requirement) is the
 * mandatory baseline. Ink never leaves this worker: the only network access
 * is the one-time static model download.
 */
import type { NeuralBackend, NeuralWorkerRequest, NeuralWorkerResponse } from './neuralWorkerProtocol';
import { NEURAL_MODEL_DTYPE, resolveNeuralModelSource } from './neuralWorkerProtocol';
import { createPanasModelCache, requestPersistentModelStorage } from './panvasModelCache';

type Pipeline = (imageData: { data: Uint8ClampedArray; width: number; height: number }) => Promise<string>;

let pipeline: Pipeline | null = null;
let activeBackend: NeuralBackend | null = null;
let initPromise: Promise<void> | null = null;

function post(message: NeuralWorkerResponse): void {
  self.postMessage(message);
}

async function buildPipeline(device: 'webgpu' | 'wasm'): Promise<Pipeline> {
  // Imported lazily so the runtime (and its ~10-20 MB WASM binaries) is only
  // fetched when local recognition is genuinely used.
  const transformers: any = await import('@huggingface/transformers');
  const { env, AutoProcessor, AutoTokenizer, AutoModelForVision2Seq, RawImage } = transformers;

  // Single-threaded WASM keeps the baseline free of cross-origin isolation.
  if (device === 'wasm') {
    env.backends.onnx.wasm.numThreads = 1;
  }

  // Versioned persistent model cache (Cache Storage → IndexedDB fallback).
  // Without this, transformers.js re-downloads weights whenever Cache
  // Storage is unavailable (insecure origins, private browsing) — the exact
  // repeat-download failure observed in user testing.
  try {
    env.useCustomCache = true;
    env.customCache = createPanasModelCache();
  } catch (cacheError) {
    console.warn('[Panvas neural] persistent model cache unavailable; using runtime default.', cacheError);
  }
  void requestPersistentModelStorage();

  const progress = (info: { status?: string; loaded?: number; total?: number }) => {
    if (info?.status === 'progress' && typeof info.loaded === 'number' && typeof info.total === 'number' && info.total > 0) {
      post({ type: 'download-progress', loaded: info.loaded, total: info.total });
    }
  };

  const modelSource = resolveNeuralModelSource();
  const processor = await AutoProcessor.from_pretrained(modelSource, { progress_callback: progress });
  const tokenizer = await AutoTokenizer.from_pretrained(modelSource, { progress_callback: progress });
  const model = await AutoModelForVision2Seq.from_pretrained(modelSource, {
    dtype: NEURAL_MODEL_DTYPE,
    device,
    progress_callback: progress,
  });

  return async ({ data, width, height }) => {
    const image = new RawImage(new Uint8ClampedArray(data), width, height, 4);
    const processed = await processor(image);
    const pixelValues = processed?.pixel_values ?? processed;
    const generated = await model.generate({ inputs: pixelValues, max_new_tokens: 64 });
    const texts = tokenizer.batch_decode(generated, { skip_special_tokens: true });
    return Array.isArray(texts) ? String(texts[0] ?? '') : String(texts ?? '');
  };
}

async function ensurePipeline(): Promise<NeuralBackend> {
  if (pipeline && activeBackend) return activeBackend;
  if (!initPromise) {
    initPromise = (async () => {
      // WebGPU first when genuinely present; any failure falls through to the
      // WASM baseline before the provider ever declares unavailability.
      const hasWebgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
      if (hasWebgpu) {
        try {
          pipeline = await buildPipeline('webgpu');
          activeBackend = 'webgpu';
          return;
        } catch (error) {
          console.warn('[Panvas neural] WebGPU init failed, falling back to WASM.', error);
          pipeline = null;
        }
      }
      pipeline = await buildPipeline('wasm');
      activeBackend = 'wasm';
    })();
    initPromise.catch(() => {
      // Allow a later explicit retry after a failed attempt.
      initPromise = null;
      pipeline = null;
      activeBackend = null;
    });
  }
  await initPromise;
  return activeBackend!;
}

self.onmessage = async (event: MessageEvent<NeuralWorkerRequest>) => {
  const request = event.data;
  if (!request) return;
  try {
    if (request.type === 'init') {
      try {
        const backend = await ensurePipeline();
        post({ type: 'init-ok', backend });
      } catch (error) {
        post({ type: 'init-failed', error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    if (request.type === 'recognize') {
      try {
        await ensurePipeline();
        const text = await pipeline!(request.image);
        post({ type: 'recognize-ok', requestId: request.requestId, text });
      } catch (error) {
        post({
          type: 'recognize-failed',
          requestId: request.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }
    if (request.type === 'dispose') {
      pipeline = null;
      activeBackend = null;
      initPromise = null;
    }
  } catch (error) {
    // Never let a worker-level exception go unanswered.
    console.warn('[Panvas neural] worker error', error);
  }
};
