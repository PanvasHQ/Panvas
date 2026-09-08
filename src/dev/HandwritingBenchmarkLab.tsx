import React, { useRef, useState } from 'react';
import { FlaskConical, Upload } from 'lucide-react';
import {
  BENCHMARK_SAMPLE_HINTS,
  runLocalHandwritingBenchmark,
  type BenchmarkReport,
  type BenchmarkSampleInput,
} from '@/services/recognition/benchmark/runBenchmark';
import { BENCHMARK_CANDIDATES } from '@/services/recognition/benchmark/candidateRegistry';

/**
 * Developer-only evaluation lab for local handwriting-fallback candidates.
 * Not linked from any product surface: reachable only at
 * /app/dev/handwriting-benchmark. All inference stays on-device.
 */
export function HandwritingBenchmarkLab() {
  const [expectedText, setExpectedText] = useState('hello');
  const [image, setImage] = useState<BenchmarkSampleInput['image'] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const bitmap = await createImageBitmap(file);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement('canvas'), { width: bitmap.width, height: bitmap.height });
    const context = (canvas as OffscreenCanvas | HTMLCanvasElement).getContext('2d');
    if (!context) return;
    context.drawImage(bitmap as unknown as CanvasImageSource, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    setImage({ data: imageData.data, width: imageData.width, height: imageData.height });
    setFileName(file.name);
  };

  const run = async () => {
    if (!image || !expectedText.trim() || busy) return;
    setBusy(true);
    try {
      const result = await runLocalHandwritingBenchmark([
        { expectedText, image, source: 'image-file', fileName: fileName ?? undefined },
      ]);
      setReport(result);
    } finally {
      setBusy(false);
    }
  };

  const candidateResult = report?.candidates.find(candidate => candidate.status !== 'skipped');

  return (
    <main className="mx-auto max-w-2xl bg-panvas-bg-primary px-5 py-8 text-panvas-text-primary">
      <div className="mb-6 flex items-center gap-3">
        <FlaskConical size={20} className="text-panvas-text-tertiary" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold">Handwriting fallback benchmark</h1>
          <p className="text-xs text-panvas-text-tertiary">Developer-only · on-device inference · nothing is uploaded</p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 text-xs">
        <h2 className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Candidates</h2>
        <ul className="space-y-2">
          {BENCHMARK_CANDIDATES.map(candidate => (
            <li key={candidate.id} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium">
                <span className={
                  candidate.status === 'rejected' ? 'rounded bg-panvas-bg-hover px-1.5 py-0.5 text-[10px] font-semibold text-panvas-accent-rose'
                    : candidate.status === 'verified' ? 'rounded bg-panvas-bg-active px-1.5 py-0.5 text-[10px] font-semibold text-panvas-text-primary'
                      : 'rounded border border-panvas-border-default px-1.5 py-0.5 text-[10px] font-semibold text-panvas-text-secondary'
                }>{candidate.status}</span>
                {candidate.label}
                {candidate.approximateDownloadMb !== null && <span className="text-panvas-text-tertiary">~{candidate.approximateDownloadMb} MB</span>}
              </span>
              <span className="text-panvas-text-secondary">{candidate.notes}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4">
        <label className="block text-xs">
          <span className="mb-1 block text-2xs font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Expected text</span>
          <input
            value={expectedText}
            onChange={event => setExpectedText(event.target.value)}
            className="h-9 w-full rounded-md border border-panvas-border-default bg-panvas-bg-primary px-2 text-sm text-panvas-text-primary focus-ring"
            placeholder="hello"
          />
        </label>
        <p className="text-2xs text-panvas-text-tertiary">Suggested suite: {BENCHMARK_SAMPLE_HINTS.join(' · ')}</p>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="panvas-action-button panvas-action-button--secondary focus-ring"
          >
            <Upload size={14} />{fileName ?? 'Choose handwriting image'}
          </button>
          <button
            type="button"
            disabled={!image || busy || !expectedText.trim()}
            onClick={() => void run()}
            className="panvas-action-button panvas-action-button--primary disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {busy ? 'Running…' : 'Run benchmark'}
          </button>
        </div>
        <p className="text-2xs text-panvas-text-tertiary">
          Tip: write each sample in Panvas first, screenshot/derive a clean line image (dark ink on white), then feed it here.
        </p>
      </section>

      {candidateResult && (
        <section className="mt-6 rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 text-xs">
          <h2 className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-panvas-text-tertiary">Report · {candidateResult.candidateId}</h2>
          <div className="mb-2 flex gap-4 text-panvas-text-secondary">
            <span>samples: {candidateResult.summary.samples}</span>
            <span>mean CER: {(candidateResult.summary.meanCer * 100).toFixed(1)}%</span>
            <span>mean WER: {(candidateResult.summary.meanWer * 100).toFixed(1)}%</span>
            <span>mean latency: {Math.round(candidateResult.summary.meanLatencyMs)} ms</span>
          </div>
          <table className="w-full text-left">
            <thead className="text-2xs uppercase tracking-wider text-panvas-text-tertiary">
              <tr><th className="py-1">Expected</th><th className="py-1">Recognized</th><th className="py-1">CER</th><th className="py-1">ms</th></tr>
            </thead>
            <tbody>
              {candidateResult.samples.map((sample, index) => (
                <tr key={index} className="border-t border-panvas-border-subtle">
                  <td className="py-1 pr-3">{sample.expected}</td>
                  <td className="py-1 pr-3 font-medium">{sample.recognized || '—'}</td>
                  <td className="py-1 pr-3">{(sample.cer * 100).toFixed(0)}%</td>
                  <td className="py-1">{sample.latencyMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {candidateResult.error && <p className="mt-2 text-panvas-accent-rose">{candidateResult.error}</p>}
        </section>
      )}
    </main>
  );
}

export default HandwritingBenchmarkLab;
