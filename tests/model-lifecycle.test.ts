import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { characterErrorRate, evaluateSample, levenshtein, summarize, wordErrorRate } from '../src/services/recognition/benchmark/metrics.ts';
import { BENCHMARK_CANDIDATES, TROCR_SMALL_CANDIDATE_ID, candidateById } from '../src/services/recognition/benchmark/candidateRegistry.ts';
import { resolveNeuralModelSource, LOCAL_HANDWRITING_MODEL_REVISION } from '../src/services/recognition/neural/neuralWorkerProtocol.ts';
import { shouldPrepareLocalModel } from '../src/services/recognition/modelPreparation.ts';

function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('CER/WER metrics behave on the rejected-experiment examples', () => {
  // Real user-verified failure: "hello" → "vteVol."
  const failed = evaluateSample('hello', 'vteVol.', 900);
  assert.equal(failed.cer, levenshtein('hello', 'vteVol.') / 5);
  assert.ok(failed.cer > 0.8, 'catastrophic output must score a high CER');
  assert.ok(failed.wer === 1, 'no overlapping words → WER 1');
  // A perfect recognition scores zero on both metrics.
  assert.equal(characterErrorRate('I love Panvas', 'I love Panvas'), 0);
  assert.equal(wordErrorRate('I love Panvas', 'I love Panvas'), 0);
  // Partial damage lands between the extremes.
  const partial = evaluateSample('hello world', 'hello word', 100);
  assert.ok(partial.cer > 0 && partial.cer < 0.5);
  assert.equal(summarize([failed, partial]).samples, 2);
  assert.ok(summarize([failed, partial]).exactMatches === 0);
});

test('candidate registry records the user-verified TrOCR-small rejection with honest statuses', () => {
  const rejected = candidateById(TROCR_SMALL_CANDIDATE_ID);
  assert.equal(rejected?.status, 'rejected');
  assert.match(rejected?.notes ?? '', /REJECTED/i);
  const base = candidateById('panvas-handwriting-en-trocr-base');
  assert.equal(base?.status, 'rejected', '338 MB int8 is rejected at evaluation stage');
  assert.equal(base?.approximateDownloadMb, 338);
  for (const candidate of BENCHMARK_CANDIDATES) {
    assert.ok(candidate.id.startsWith('panvas-handwriting-'), 'ids double as cache revisions');
    assert.equal(candidate.status === 'verified', false, 'nothing is verified without the USER benchmark');
  }
});

test('model revision contract is versioned and self-host-ready', async () => {
  assert.equal(LOCAL_HANDWRITING_MODEL_REVISION, 'panvas-handwriting-en-v1');
  assert.equal(resolveNeuralModelSource(), 'Xenova/trocr-small-handwritten', 'harness falls back to the public HF repo until self-hosting lands');
  const protocol = await read('../src/services/recognition/neural/neuralWorkerProtocol.ts');
  assert.match(protocol, /PANVAS_MODEL_BASE_URL/);
  assert.match(protocol, /panvas-handwriting-en-v2/, 'v2 upgrade path must be documented in the contract');
});

test('background preparation only runs when enabled, windowed, and native recognition is absent', () => {
  const base = { hasWindow: true, hasNativeHandwritingApi: false };
  assert.equal(shouldPrepareLocalModel({ ...base, fallbackEnabled: true }), true);
  assert.equal(shouldPrepareLocalModel({ ...base, fallbackEnabled: false }), false, 'fallback disabled → dormant');
  assert.equal(shouldPrepareLocalModel({ ...base, fallbackEnabled: true, hasNativeHandwritingApi: true }), false, 'native provider present → never download');
  assert.equal(shouldPrepareLocalModel({ ...base, fallbackEnabled: true, hasWindow: false }), false);
});

test('the worker persists models through the versioned Panvas cache, not the default browser cache', async () => {
  const source = await read('../src/services/recognition/neural/neuralRecognitionWorker.ts');
  assert.match(source, /createPanasModelCache\(\)/);
  assert.match(source, /useCustomCache = true/);
  assert.match(source, /requestPersistentModelStorage/);
  const cache = await read('../src/services/recognition/neural/panvasModelCache.ts');
  assert.match(cache, /caches\.open\(MODEL_CACHE_NAME\)/);
  assert.match(cache, /indexedDB/, 'insecure-origin fallback tier is required');
  assert.match(cache, /navigator\.storage\.persist/);
  assert.match(cache, /purgeStaleModelRevisions/);
  const lab = await read('../src/dev/HandwritingBenchmarkLab.tsx');
  assert.match(lab, /Run benchmark/);
  assert.match(lab, /nothing is uploaded/);
});
