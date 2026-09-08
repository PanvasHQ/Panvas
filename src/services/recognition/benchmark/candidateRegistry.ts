/**
 * Registry of local handwriting-fallback candidates under evaluation.
 * Strict, versioned ids double as cache revisions. Statuses are evidence-based:
 * a candidate only becomes `verified` after the USER accuracy benchmark passes.
 */

export type CandidateStatus = 'rejected' | 'pending-verification' | 'verified';

export interface CandidateDescriptor {
  readonly id: string;
  readonly label: string;
  readonly status: CandidateStatus;
  readonly inputKind: 'raster-line' | 'stroke-sequence';
  readonly approximateDownloadMb: number | null;
  readonly notes: string;
}

/**
 * REJECTED 2026-08-29 — user-verified catastrophic accuracy on real Windows
 * Chrome handwriting ("hello" → "vteVol."). Kept registered so the harness can
 * still reproduce the failure for comparison.
 */
export const TROCR_SMALL_CANDIDATE_ID = 'panvas-handwriting-en-trocr-small';

export const BENCHMARK_CANDIDATES: readonly CandidateDescriptor[] = [
  {
    id: TROCR_SMALL_CANDIDATE_ID,
    label: 'TrOCR-small handwritten (int8)',
    status: 'rejected',
    inputKind: 'raster-line',
    approximateDownloadMb: 64,
    notes: 'REJECTED — user-verified accuracy failure (real "hello" recognized as "vteVol." etc.). Infrastructure kept for benchmark comparison only.',
  },
  {
    id: 'panvas-handwriting-en-trocr-base',
    label: 'TrOCR-base handwritten (int8)',
    status: 'rejected',
    inputKind: 'raster-line',
    approximateDownloadMb: 338,
    notes: 'REJECTED at evaluation stage — encoder 88.1 MB + decoder 250 MB int8 (verified on HF). Hundreds of MB and autoregressive decoding are not a mobile-web trade Panvas accepts. Only reconsider with a much smaller distilled variant.',
  },
  {
    id: 'panvas-handwriting-en-ppocrv5-mobile',
    label: 'PP-OCRv5 mobile English recognition',
    status: 'pending-verification',
    inputKind: 'raster-line',
    approximateDownloadMb: null,
    notes: 'Candidate A: @paddleocr/paddleocr-js 0.4.2 (Apache-2.0, verified on npm). Real-line text recognition is print-leaning — expected weaker on cursive; must be measured on Panvas handwriting samples before any decision.',
  },
  {
    id: 'panvas-handwriting-en-stroke-ctc-v1',
    label: 'Custom Panvas stroke-sequence CTC (IAM-OnDB-class)',
    status: 'pending-verification',
    inputKind: 'stroke-sequence',
    approximateDownloadMb: null,
    notes: 'Candidate C / long-term direction: consumes Panvas vector strokes directly (x, y, stroke boundaries, order/time). Closest real prior art: PellelNitram/OnlineHTR (PyTorch, IAM-OnDB, CTC, pretrained weights, no browser/ONNX export shipped). Would require Panvas-specific export/finetuning work.',
  },
];

export function candidateById(id: string): CandidateDescriptor | undefined {
  return BENCHMARK_CANDIDATES.find(candidate => candidate.id === id);
}
