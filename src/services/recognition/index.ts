import { UnsupportedRecognitionProvider } from './providers/UnsupportedRecognitionProvider.ts';
import { WindowsInkRecognitionProvider } from './providers/WindowsInkRecognitionProvider.ts';
import { WebHandwritingRecognitionProvider } from './providers/WebHandwritingRecognitionProvider.ts';
import { LocalNeuralHandwritingRecognitionProvider } from './providers/LocalNeuralHandwritingRecognitionProvider.ts';
import type { HandwritingRecognitionProvider } from './types.ts';

export interface RecognitionEnvironment {
  platform?: string;
  hasElectronBridge?: boolean;
  hasWebHandwritingApi?: boolean;
  hasLocalNeuralRuntime?: boolean;
}

function runtimeEnvironment(): Required<RecognitionEnvironment> {
  return {
    platform: typeof navigator === 'undefined' ? '' : navigator.platform,
    hasElectronBridge: typeof window !== 'undefined' && typeof window.panvas?.recognition?.recognize === 'function',
    hasWebHandwritingApi: typeof navigator !== 'undefined'
      && typeof navigator.createHandwritingRecognizer === 'function'
      && typeof (globalThis as typeof globalThis & { HandwritingStroke?: unknown }).HandwritingStroke === 'function',
    // Cheap capability check (no UA sniffing): the local neural fallback
    // needs a Web Worker plus a rasterizable bitmap surface. The model
    // itself loads lazily on first use, never here.
    hasLocalNeuralRuntime: typeof Worker !== 'undefined'
      && (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined'),
  };
}

/**
 * Local neural fallback kill-switch. 2026-08-29: the TrOCR-small experiment is
 * REJECTED — user-verified catastrophic accuracy on real handwriting in
 * Windows Chrome ("hello" → "vteVol."). Disabled for normal runtime; the
 * provider/worker/rasterizer infrastructure stays for the benchmark harness
 * (`/app/dev/handwriting-benchmark`) while a better local model is evaluated.
 * Flip to true only after a candidate passes the user accuracy benchmark.
 */
export const LOCAL_NEURAL_FALLBACK_ENABLED = false;

/**
 * Returns only local providers, in strict preference order:
 * Windows Ink bridge → native browser handwriting API → local on-device
 * neural model (currently disabled — rejected experiment) → explicit
 * unsupported (raw ink preserved).
 */
export function getHandwritingRecognitionProvider(environment: RecognitionEnvironment = runtimeEnvironment()): HandwritingRecognitionProvider {
  if (environment.hasElectronBridge && /^win/i.test(environment.platform ?? '')) {
    return new WindowsInkRecognitionProvider();
  }
  if (environment.hasWebHandwritingApi) return new WebHandwritingRecognitionProvider();
  if (LOCAL_NEURAL_FALLBACK_ENABLED && environment.hasLocalNeuralRuntime) return new LocalNeuralHandwritingRecognitionProvider();
  return new UnsupportedRecognitionProvider();
}

export * from './types.ts';
export * from './bulkConversion.ts';
export * from './handwritingLineContinuation.ts';
export { UnsupportedRecognitionProvider, UNSUPPORTED_RECOGNITION_MESSAGE } from './providers/UnsupportedRecognitionProvider.ts';
export { WindowsInkRecognitionProvider } from './providers/WindowsInkRecognitionProvider.ts';
export { WebHandwritingRecognitionProvider } from './providers/WebHandwritingRecognitionProvider.ts';
export { LocalNeuralHandwritingRecognitionProvider, NEURAL_STATUS_EVENT, type NeuralStatusDetail } from './providers/LocalNeuralHandwritingRecognitionProvider.ts';
