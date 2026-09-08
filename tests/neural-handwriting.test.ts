import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { computeInkLineSpec, renderNormalizedLineImage, type BitmapSurface } from '../src/services/recognition/neural/inkRasterizer.ts';
import {
  LocalNeuralHandwritingRecognitionProvider,
  resetNeuralRuntimeForTests,
  type NeuralWorkerHandle,
} from '../src/services/recognition/providers/LocalNeuralHandwritingRecognitionProvider.ts';
import { getHandwritingRecognitionProvider } from '../src/services/recognition/index.ts';
import { WindowsInkRecognitionProvider } from '../src/services/recognition/providers/WindowsInkRecognitionProvider.ts';
import { WebHandwritingRecognitionProvider } from '../src/services/recognition/providers/WebHandwritingRecognitionProvider.ts';
import { UnsupportedRecognitionProvider } from '../src/services/recognition/providers/UnsupportedRecognitionProvider.ts';
import { recognizeHandwritingLines } from '../src/services/recognition/bulkConversion.ts';
import type { Stroke } from '../src/components/notebook/engine/drawingTypes.ts';
import type { NeuralWorkerRequest, NeuralWorkerResponse } from '../src/services/recognition/neural/neuralWorkerProtocol.ts';

const surface: BitmapSurface = {
  createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
};

function stroke(id: string, points: Array<{ x: number; y: number }>): Stroke {
  return {
    id,
    tool: 'pen',
    color: '#000000',
    thickness: 2,
    opacity: 100,
    createdAt: 1,
    layerId: 'layer-1',
    points: points.map(point => ({ ...point, pressure: 0.5, t: 0 })),
  } as unknown as Stroke;
}

const WORD_A = stroke('a', [{ x: 10, y: 10 }, { x: 40, y: 12 }, { x: 70, y: 8 }]);
const WORD_B = stroke('b', [{ x: 200, y: 12 }, { x: 240, y: 10 }]);

test('rasterizer returns null for empty or finite-free ink', () => {
  assert.equal(computeInkLineSpec([]), null);
  assert.equal(computeInkLineSpec([{ points: [{ x: NaN, y: NaN }] }]), null);
});

test('rasterizer computes tight padded bounds and preserves word gaps', () => {
  const spec = computeInkLineSpec([WORD_A, WORD_B])!;
  // Inter-word gap (x 70→200) must survive: width far exceeds two word widths.
  assert.ok(spec.width > 250, `width ${spec.width} must include the word gap`);
  assert.ok(spec.height < 40, `height ${spec.height} must hug the line`);
  // Strokes are translated to the padded origin, not deformed.
  assert.equal(spec.strokes.length, 2);
  assert.ok(spec.strokes[0][0].x < spec.strokes[1][0].x);
});

test('rasterizer renders with a uniform scale (aspect preserved, never stretched)', () => {
  const spec = computeInkLineSpec([WORD_A, WORD_B])!;
  const image = renderNormalizedLineImage(spec, surface);
  const specRatio = spec.width / spec.height;
  const imageRatio = image.width / image.height;
  assert.ok(Math.abs(specRatio - imageRatio) < 0.05, `${imageRatio} must match ${specRatio}`);
  // Long edge normalized toward the model target without exceeding it wildly.
  assert.ok(Math.max(image.width, image.height) <= 384 + 2);
  assert.ok(Math.max(image.width, image.height) >= 64);
});

test('rasterizer keeps strokes disconnected (whitespace between words stays white)', () => {
  const spec = computeInkLineSpec([WORD_A, WORD_B])!;
  const image = renderNormalizedLineImage(spec, surface);
  const gapXStart = Math.round(((70 - 0) * image.width) / spec.width);
  const gapXEnd = Math.round(((200 - 0) * image.width) / spec.width);
  const midY = Math.floor(image.height / 2);
  for (let x = gapXStart + 6; x < gapXEnd - 6; x += 1) {
    const offset = (midY * image.width + x) * 4;
    assert.equal(image.imageData.data[offset], 255, `column ${x} between words must stay white`);
  }
});

test('rasterizer paints dark ink on a light background', () => {
  const spec = computeInkLineSpec([WORD_A])!;
  const image = renderNormalizedLineImage(spec, surface);
  const data = image.imageData.data;
  let dark = 0;
  for (let index = 0; index < data.length; index += 4) {
    assert.equal(data[index + 3], 255, 'background must be opaque');
    if (data[index] < 200) dark += 1;
  }
  assert.ok(dark > 0, 'ink pixels must exist');
});

test('rasterizer never mutates the source strokes', () => {
  const strokes = [WORD_A, WORD_B];
  const before = JSON.stringify(strokes);
  computeInkLineSpec(strokes);
  renderNormalizedLineImage(computeInkLineSpec(strokes)!, surface);
  assert.equal(JSON.stringify(strokes), before);
});

test('rasterizer handles tiny single-tap words', () => {
  const spec = computeInkLineSpec([stroke('dot', [{ x: 5, y: 5 }])])!;
  const image = renderNormalizedLineImage(spec, surface);
  assert.ok(image.width >= 64);
  assert.ok(image.height >= 64);
});

class FakeWorker implements NeuralWorkerHandle {
  onmessage: ((event: MessageEvent<NeuralWorkerResponse>) => void) | null = null;
  sent: NeuralWorkerRequest[] = [];
  terminated = false;
  /** When set, responses are deferred until the test resolves them. */
  deferred = false;

  postMessage(message: NeuralWorkerRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: NeuralWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<NeuralWorkerResponse>);
  }
}

function fakeFactory(worker: FakeWorker) {
  return {
    createWorker: () => worker,
    createBitmapSurface: (width: number, height: number) => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) }),
  };
}

async function driveAutomaticInit(worker: FakeWorker): Promise<void> {
  // Let the provider's async init/run chain reach its postMessage calls.
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  worker.respond({ type: 'init-ok', backend: 'webgpu' });
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
}

test('provider maps a successful model response into the existing result contract', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const pending = provider.recognize([WORD_A], { language: 'en-US' });
  await driveAutomaticInit(worker);
  worker.respond({ type: 'recognize-ok', requestId: (worker.sent.find(m => m.type === 'recognize') as { requestId: number }).requestId, text: '  hello  ' });
  const result = await pending;
  assert.equal(result.status, 'success');
  assert.equal(result.text, 'hello');
  assert.equal(result.isAvailable, true);
  assert.equal(result.language, 'en');
});

test('model initialization happens exactly once; concurrent recognizes reuse it', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const first = provider.recognize([WORD_A]);
  const second = provider.recognize([WORD_B]);
  await driveAutomaticInit(worker);
  const recognizeRequests = worker.sent.filter(m => m.type === 'recognize');
  assert.equal(worker.sent.filter(m => m.type === 'init').length, 1);
  assert.equal(recognizeRequests.length, 2);
  for (const request of recognizeRequests) {
    worker.respond({ type: 'recognize-ok', requestId: (request as { requestId: number }).requestId, text: 'x' });
  }
  const firstResult = await first;
  assert.deepEqual(firstResult.text, 'x');
  assert.deepEqual((await second).text, 'x');
});

test('initialization failure yields unavailable + preserves availability contract', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const pending = provider.recognize([WORD_A]);
  for (let turn = 0; turn < 8; turn += 1) await Promise.resolve();
  worker.respond({ type: 'init-failed', error: 'wasm unavailable' });
  const result = await pending;
  assert.equal(result.status, 'unavailable');
  assert.equal(result.isAvailable, false);
  assert.match(result.error ?? '', /ink will be kept/i);
  assert.equal(await provider.isAvailable(), false);
  assert.match(result.error ?? '', /unavailable/i);
});

test('inference failure is a non-fatal error result and ink is untouched', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const strokes = [WORD_A];
  const before = JSON.stringify(strokes);
  const pending = provider.recognize(strokes);
  await driveAutomaticInit(worker);
  worker.respond({
    type: 'recognize-failed',
    requestId: (worker.sent.find(m => m.type === 'recognize') as { requestId: number }).requestId,
    error: 'tensor shape mismatch',
  });
  const result = await pending;
  assert.equal(result.status, 'error');
  assert.equal(result.text, '');
  assert.equal(await provider.isAvailable(), true, 'an inference failure must not disable the provider');
  assert.equal(JSON.stringify(strokes), before);
});

test('empty model output maps to the empty status with ink preserved', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const pending = provider.recognize([WORD_A]);
  await driveAutomaticInit(worker);
  worker.respond({ type: 'recognize-ok', requestId: (worker.sent.find(m => m.type === 'recognize') as { requestId: number }).requestId, text: '' });
  const result = await pending;
  assert.equal(result.status, 'empty');
});

test('unsupported languages are truthfully declined without touching the model', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const result = await provider.recognize([WORD_A], { language: 'hi-IN' });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.isAvailable, false);
  assert.match(result.error ?? '', /English only/);
  assert.equal(worker.sent.length, 0, 'no worker/model traffic for unsupported languages');
  // Default (no language) and en variants proceed normally.
  assert.equal((await provider.isAvailable()), true);
});

test('empty stroke input short-circuits to empty without model traffic', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const result = await provider.recognize([]);
  assert.equal(result.status, 'empty');
  assert.equal(worker.sent.length, 0);
});

test('bulk conversion consumes the provider through the existing path', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  const batch = {
    id: 'line-1',
    strokes: [WORD_A],
    bounds: { x: 10, y: 8, width: 60, height: 6 },
    baseline: 12,
    blankLinesBefore: 0,
  };
  const pending = recognizeHandwritingLines(provider, [batch], { language: 'en' });
  await driveAutomaticInit(worker);
  worker.respond({ type: 'recognize-ok', requestId: (worker.sent.find(m => m.type === 'recognize') as { requestId: number }).requestId, text: 'hello' });
  const reviewed = await pending;
  assert.equal(reviewed[0]?.text, 'hello');
  assert.equal(reviewed[0]?.status, 'success');
});

test('provider factory prefers native providers and falls back by capability only', async () => {
  assert.ok(getHandwritingRecognitionProvider({ platform: 'Win32', hasElectronBridge: true }) instanceof WindowsInkRecognitionProvider);
  assert.ok(getHandwritingRecognitionProvider({ platform: 'MacIntel', hasElectronBridge: true, hasWebHandwritingApi: true }) instanceof WebHandwritingRecognitionProvider);
  // 2026-08-29: TrOCR-small REJECTED (user-verified accuracy failure) — the
  // local neural fallback is disabled for normal runtime even when capable.
  assert.ok(
    getHandwritingRecognitionProvider({ platform: 'Win32', hasElectronBridge: false, hasWebHandwritingApi: false, hasLocalNeuralRuntime: true })
      instanceof UnsupportedRecognitionProvider,
  );
  assert.ok(getHandwritingRecognitionProvider({ platform: 'Win32', hasElectronBridge: false, hasWebHandwritingApi: false }) instanceof UnsupportedRecognitionProvider);
  const { LOCAL_NEURAL_FALLBACK_ENABLED } = await import('../src/services/recognition/index.ts');
  assert.equal(LOCAL_NEURAL_FALLBACK_ENABLED, false, 'fallback must stay disabled until a candidate passes the user benchmark');
});

test('worker stays WASM-baseline without cross-origin isolation and never logs ink', async () => {
  const source = await readFile(new URL('../src/services/recognition/neural/neuralRecognitionWorker.ts', import.meta.url), 'utf8');
  assert.match(source, /buildPipeline\('webgpu'\)/);
  assert.match(source, /buildPipeline\('wasm'\)/);
  assert.match(source, /numThreads = 1/);
  assert.match(source, /initPromise = null/);
  // Privacy contract: the worker never posts ink or recognized text anywhere.
  assert.ok(!/fetch\(/.test(source), 'worker must not make raw fetch calls');
  assert.ok(!/XMLHttpRequest/.test(source));
});

test('the provider never downloads at activation: isAvailable is offline-only', async () => {
  resetNeuralRuntimeForTests();
  const worker = new FakeWorker();
  const provider = new LocalNeuralHandwritingRecognitionProvider(fakeFactory(worker));
  assert.equal(await provider.isAvailable(), true);
  assert.equal(worker.sent.length, 0, 'isAvailable must not send init/traffic');
  assert.equal(provider.isOffline, true);
});
