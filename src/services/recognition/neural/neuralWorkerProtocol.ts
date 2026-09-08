/**
 * Message protocol between LocalNeuralHandwritingRecognitionProvider and the
 * neural recognition worker. The worker owns the transformers.js/ONNX runtime
 * and the model download; the provider owns rasterization, timeouts, and the
 * Panvas RecognitionResult contract.
 */

export type NeuralBackend = 'webgpu' | 'wasm';

export interface NeuralInkBitmap {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type NeuralWorkerRequest =
  | { type: 'init' }
  | { type: 'recognize'; requestId: number; image: NeuralInkBitmap }
  | { type: 'dispose' };

export type NeuralWorkerResponse =
  | { type: 'init-ok'; backend: NeuralBackend }
  | { type: 'init-failed'; error: string }
  | { type: 'download-progress'; loaded: number; total: number }
  | { type: 'recognize-ok'; requestId: number; text: string }
  | { type: 'recognize-failed'; requestId: number; error: string };

/** Experimental English-only model. Self-hosting comes with PWA deployment work. */
export const NEURAL_MODEL_ID = 'Xenova/trocr-small-handwritten';
export const NEURAL_MODEL_DTYPE = { encoder_model: 'q8', decoder_model_merged: 'q8' } as const;

/**
 * Versioned model-revision contract for the eventual self-hosted asset
 * pipeline. A production build sets PANVAS_MODEL_BASE_URL (e.g. a versioned
 * path under the app origin); model files then resolve under
 * `<base>/<revision>/…` so `panvas-handwriting-en-v2` never re-downloads v1
 * and old revisions can be purged once v2 is confirmed. Until then the
 * benchmark harness uses the public HF fallback directly.
 */
export const LOCAL_HANDWRITING_MODEL_REVISION = 'panvas-handwriting-en-v1';
export const PANVAS_MODEL_BASE_URL: string | null = null;

export function resolveNeuralModelSource(): string {
  if (PANVAS_MODEL_BASE_URL) {
    const base = PANVAS_MODEL_BASE_URL.replace(/\/+$/, '');
    return `${base}/${LOCAL_HANDWRITING_MODEL_REVISION}`;
  }
  return NEURAL_MODEL_ID;
}
