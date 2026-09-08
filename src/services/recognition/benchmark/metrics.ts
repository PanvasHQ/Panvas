/**
 * Pure recognition-quality metrics for the local benchmark harness. No model
 * or network access — fully unit-testable.
 */

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Character Error Rate: edit distance / reference length (0 = perfect). */
export function characterErrorRate(expected: string, actual: string): number {
  const reference = expected.trim();
  if (!reference) return actual.trim() ? 1 : 0;
  return levenshtein(reference, actual.trim()) / reference.length;
}

/** Word Error Rate over whitespace tokens (0 = perfect). */
export function wordErrorRate(expected: string, actual: string): number {
  const reference = expected.trim().split(/\s+/).filter(Boolean);
  if (reference.length === 0) return actual.trim() ? 1 : 0;
  const hypothesis = actual.trim().split(/\s+/).filter(Boolean);
  return levenshtein(reference.join(' '), hypothesis.join(' ')) / reference.join(' ').length;
}

export interface SampleEvaluation {
  expected: string;
  recognized: string;
  cer: number;
  wer: number;
  latencyMs: number;
}

export function evaluateSample(expected: string, recognized: string, latencyMs: number): SampleEvaluation {
  return {
    expected: expected.trim(),
    recognized: recognized.trim(),
    cer: characterErrorRate(expected, recognized),
    wer: wordErrorRate(expected, recognized),
    latencyMs,
  };
}

export interface BenchmarkSummary {
  samples: number;
  meanCer: number;
  meanWer: number;
  meanLatencyMs: number;
  exactMatches: number;
}

export function summarize(results: SampleEvaluation[]): BenchmarkSummary {
  if (results.length === 0) return { samples: 0, meanCer: 0, meanWer: 0, meanLatencyMs: 0, exactMatches: 0 };
  const sum = results.reduce(
    (accumulator, result) => ({
      cer: accumulator.cer + result.cer,
      wer: accumulator.wer + result.wer,
      latencyMs: accumulator.latencyMs + result.latencyMs,
      exact: accumulator.exact + (result.recognized.toLowerCase() === result.expected.toLowerCase() ? 1 : 0),
    }),
    { cer: 0, wer: 0, latencyMs: 0, exact: 0 },
  );
  return {
    samples: results.length,
    meanCer: sum.cer / results.length,
    meanWer: sum.wer / results.length,
    meanLatencyMs: sum.latencyMs / results.length,
    exactMatches: sum.exact,
  };
}
