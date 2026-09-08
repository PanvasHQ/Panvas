/**
 * Developer-only local handwriting benchmark runner. Feeds the SAME prepared
 * samples through candidate recognizers and reports expected vs recognized
 * text, CER/WER, and latency. Never uploads anything; never alters normal
 * Panvas handwriting behavior (the runtime fallback stays disabled).
 */
import type { Stroke } from '@/components/notebook/engine/drawingTypes';
import { computeInkLineSpec, renderNormalizedLineImage, type BitmapSurface } from '../neural/inkRasterizer.ts';
import { LocalNeuralHandwritingRecognitionProvider } from '../providers/LocalNeuralHandwritingRecognitionProvider.ts';
import { evaluateSample, summarize, type SampleEvaluation, type BenchmarkSummary } from './metrics.ts';
import { BENCHMARK_CANDIDATES, TROCR_SMALL_CANDIDATE_ID, candidateById } from './candidateRegistry.ts';

export interface BenchmarkSampleInput {
  readonly expectedText: string;
  readonly source: 'strokes' | 'image-file';
  readonly strokes?: readonly Stroke[];
  readonly image?: { data: Uint8ClampedArray; width: number; height: number };
  readonly fileName?: string;
}

export interface BenchmarkCandidateResult {
  readonly candidateId: string;
  readonly status: 'recognized' | 'failed' | 'skipped';
  readonly samples: SampleEvaluation[];
  readonly summary: BenchmarkSummary;
  readonly error?: string;
}

export interface BenchmarkReport {
  readonly startedAt: number;
  readonly candidates: BenchmarkCandidateResult[];
}

function defaultSurface(width: number, height: number): BitmapSurface | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    return context ? { createImageData: (w, h) => context.createImageData(w, h) } : null;
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    return context ? { createImageData: (w, h) => context.createImageData(w, h) } : null;
  }
  return null;
}

function bitmapForSample(sample: BenchmarkSampleInput): { data: Uint8ClampedArray; width: number; height: number } | null {
  if (sample.image) return sample.image;
  if (!sample.strokes?.length) return null;
  const spec = computeInkLineSpec(sample.strokes);
  if (!spec) return null;
  const surface = defaultSurface(spec.width, spec.height);
  if (!surface) return null;
  const rendered = renderNormalizedLineImage(spec, surface);
  return { data: rendered.imageData.data, width: rendered.width, height: rendered.height };
}

/**
 * Runs the runnable candidates over the given samples. Today only the
 * rejected-but-runnable TrOCR-small stack executes; every other candidate
 * reports `skipped` until its adapter is verified, so the harness never
 * fakes results.
 */
export async function runLocalHandwritingBenchmark(
  samples: readonly BenchmarkSampleInput[],
  candidateIds: readonly string[] = [TROCR_SMALL_CANDIDATE_ID],
): Promise<BenchmarkReport> {
  const startedAt = Date.now();
  const candidates: BenchmarkCandidateResult[] = [];

  for (const candidateId of candidateIds) {
    const descriptor = candidateById(candidateId);
    if (!descriptor || candidateId !== TROCR_SMALL_CANDIDATE_ID) {
      candidates.push({
        candidateId,
        status: 'skipped',
        samples: [],
        summary: summarize([]),
        error: `No verified runnable adapter yet for ${descriptor?.label ?? candidateId}.`,
      });
      continue;
    }

    const provider = new LocalNeuralHandwritingRecognitionProvider();
    const evaluations: SampleEvaluation[] = [];
    let failure: string | null = null;
    for (const sample of samples) {
      const bitmap = bitmapForSample(sample);
      if (!bitmap) {
        failure = failure ?? 'A sample had neither decodable image data nor rasterizable strokes.';
        continue;
      }
      const startedAtSample = Date.now();
      const result = await provider.recognizeInkBitmap(bitmap, { language: 'en' });
      const latencyMs = Date.now() - startedAtSample;
      if (result.status === 'success') {
        evaluations.push(evaluateSample(sample.expectedText, result.text, latencyMs));
      } else {
        evaluations.push(evaluateSample(sample.expectedText, '', latencyMs));
        failure = failure ?? result.error ?? `Recognition returned ${result.status}.`;
      }
    }
    candidates.push({
      candidateId,
      status: failure && evaluations.length === 0 ? 'failed' : 'recognized',
      samples: evaluations,
      summary: summarize(evaluations),
      error: failure ?? undefined,
    });
  }

  return { startedAt, candidates };
}

/** The canonical quick sample suite from the evaluation brief. */
export const BENCHMARK_SAMPLE_HINTS: readonly string[] = [
  'hello',
  'hello world',
  'I love Panvas',
  'I love Panvas 3000',
  '123456789',
  '(a natural cursive sentence)',
];

export { BENCHMARK_CANDIDATES };
