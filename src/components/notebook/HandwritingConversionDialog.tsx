import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LoaderCircle, Sparkles, X } from 'lucide-react';
import type { Stroke } from './engine/drawingTypes';
import { getHandwritingRecognitionProvider } from '@/services/recognition';
import {
  createBulkHandwritingLinePlacements,
  formatHandwritingReviewText,
  recognizeHandwritingLines,
  segmentHandwritingStrokesIntoLines,
  type ReviewedHandwritingLine,
} from '@/services/recognition/bulkConversion';
import {
  sanitizeHandwritingToolPreferences,
  type HandwritingToolPreferences,
} from '@/services/beautification/handwritingBeautification';
import { TextFontPicker } from './TextFontPicker';

interface HandwritingConversionDialogProps {
  open: boolean;
  strokes: Stroke[];
  initialPreferences: Readonly<HandwritingToolPreferences>;
  onCancel: () => void;
  onConfirm: (
    lines: ReviewedHandwritingLine[],
    preferences: HandwritingToolPreferences,
    providerId: string,
  ) => void;
}

function lineError(line: ReviewedHandwritingLine): string | null {
  if (line.text.trim()) return null;
  if (line.status === 'error') return line.error || 'Recognition failed for this line. Enter the text manually to continue.';
  if (line.status === 'unavailable') return line.error || 'Recognition is unavailable for this line.';
  return 'No text was recognized for this line. Enter the text manually to continue.';
}

export function HandwritingConversionDialog({
  open,
  strokes,
  initialPreferences,
  onCancel,
  onConfirm,
}: HandwritingConversionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lines, setLines] = useState<ReviewedHandwritingLine[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState('unknown');
  const [preferences, setPreferences] = useState<HandwritingToolPreferences>(() => (
    sanitizeHandwritingToolPreferences(initialPreferences)
  ));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const batches = segmentHandwritingStrokesIntoLines(strokes);
    setIsLoading(true);
    setLines([]);
    setGlobalError(null);
    setPreferences(sanitizeHandwritingToolPreferences(initialPreferences));

    if (batches.length === 0) {
      setIsLoading(false);
      setGlobalError('The selection contains no eligible Pen or Pencil handwriting strokes.');
      return () => { cancelled = true; };
    }

    void (async () => {
      const provider = getHandwritingRecognitionProvider();
      setProviderId(provider.id);
      const reviewed = await recognizeHandwritingLines(provider, batches, {
        language: initialPreferences.language || undefined,
      });
      if (cancelled) return;
      setLines(reviewed);
      setIsLoading(false);
    })().catch(error => {
      if (cancelled) return;
      setIsLoading(false);
      setGlobalError(error instanceof Error ? error.message : 'Selected handwriting could not be recognized.');
    });

    return () => { cancelled = true; };
  }, [initialPreferences, open, strokes]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, open]);

  const updateLine = (index: number, text: string) => {
    setLines(previous => previous.map((line, lineIndex) => (
      lineIndex === index ? { ...line, text } : line
    )));
  };
  const unresolvedLines = lines.filter(line => !line.text.trim()).length;
  const reviewText = useMemo(() => formatHandwritingReviewText(lines), [lines]);
  const placements = useMemo(() => createBulkHandwritingLinePlacements(lines, preferences), [lines, preferences]);
  const previewLeft = placements.length > 0
    ? Math.min(...placements.map(item => item.line.bounds.x))
    : 0;

  if (!open) return null;

  return (
    <div className="panvas-layer-modal panvas-dialog-backdrop fixed inset-0 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="handwriting-conversion-title"
        className="panvas-handwriting-dialog panvas-dialog flex max-h-[90vh] w-full max-w-3xl flex-col"
      >
        <header className="flex items-center justify-between border-b border-panvas-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-panvas-accent-blue" aria-hidden="true" />
            <div>
              <h2 id="handwriting-conversion-title" className="text-base font-semibold text-panvas-text-primary">Convert to Text</h2>
              {!isLoading && lines.length > 0 && <p className="text-xs text-panvas-text-tertiary">{lines.length} handwritten {lines.length === 1 ? 'line' : 'lines'} detected</p>}
            </div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close handwriting conversion" className="rounded-lg p-1.5 text-panvas-text-secondary hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus-ring">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading && (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-panvas-text-secondary">
              <LoaderCircle className="animate-spin text-panvas-accent-blue" size={26} aria-hidden="true" />
              <span>Recognizing selected handwriting lines locally…</span>
            </div>
          )}

          {!isLoading && globalError && (
            <div className="rounded-xl border border-panvas-accent-amber/30 bg-panvas-accent-amber/10 p-4 text-sm text-panvas-text-primary">
              <p className="font-medium">Recognition needs attention</p>
              <p className="mt-1 leading-5 text-panvas-text-secondary">{globalError}</p>
            </div>
          )}

          {!isLoading && !globalError && lines.length > 0 && (
            <>
              {unresolvedLines > 0 && (
                <div className="flex gap-2 rounded-xl border border-panvas-accent-amber/30 bg-panvas-accent-amber/10 p-3 text-sm text-panvas-text-secondary">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-panvas-accent-amber" aria-hidden="true" />
                  <p>{unresolvedLines} {unresolvedLines === 1 ? 'line needs' : 'lines need'} a correction before conversion. No source ink will be removed until every detected line contains text.</p>
                </div>
              )}

              <div className="space-y-3" aria-label="Recognized handwriting lines">
                {lines.map((line, index) => {
                  const error = lineError(line);
                  return (
                    <div
                      key={line.id}
                      className="rounded-xl border border-panvas-border-subtle bg-panvas-bg-secondary p-3"
                      style={{ marginTop: index > 0 && line.blankLinesBefore > 0 ? `${Math.min(72, 12 + line.blankLinesBefore * 18)}px` : undefined }}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label className="text-xs font-medium text-panvas-text-secondary" htmlFor={`recognized-handwriting-line-${index}`}>Line {index + 1}</label>
                        <span className="text-2xs text-panvas-text-tertiary">{line.strokes.length} strokes</span>
                      </div>
                      <input
                        id={`recognized-handwriting-line-${index}`}
                        value={line.text}
                        onChange={event => updateLine(index, event.target.value)}
                        className="w-full rounded-lg border border-panvas-border-default bg-panvas-bg-primary px-3 py-2 text-sm text-panvas-text-primary outline-none focus:border-panvas-accent-blue focus-ring"
                        aria-invalid={error ? true : undefined}
                      />
                      {line.candidates.length > 1 && (
                        <label className="mt-2 block text-2xs font-medium text-panvas-text-tertiary">
                          Recognition alternatives
                          <select
                            value=""
                            onChange={event => { if (event.target.value) updateLine(index, event.target.value); }}
                            className="mt-1 block w-full rounded-lg border border-panvas-border-default bg-panvas-bg-primary px-2 py-1.5 text-xs text-panvas-text-primary"
                          >
                            <option value="">Keep reviewed line</option>
                            {line.candidates.filter(candidate => candidate !== line.text).map(candidate => <option key={candidate} value={candidate}>{candidate}</option>)}
                          </select>
                        </label>
                      )}
                      {error && <p className="mt-1.5 text-xs text-panvas-accent-amber">{error}</p>}
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-panvas-text-secondary">
                  Font
                  <TextFontPicker
                    ariaLabel="Conversion font"
                    value={preferences.fontFamily}
                    onChange={font => setPreferences(previous => sanitizeHandwritingToolPreferences({ ...previous, fontFamily: font || 'Inter, sans-serif' }))}
                    className="mt-1.5 block w-full"
                  />
                </label>
                <label className="text-xs font-medium text-panvas-text-secondary">
                  Font size
                  <select
                    value={String(preferences.fontSize)}
                    onChange={event => setPreferences(previous => sanitizeHandwritingToolPreferences({
                      ...previous,
                      fontSize: event.target.value === 'auto' ? 'auto' : Number(event.target.value),
                    }))}
                    className="mt-1.5 block w-full rounded-lg border border-panvas-border-default bg-panvas-bg-secondary px-2 py-1.5 text-sm text-panvas-text-primary"
                  >
                    <option value="auto">Auto</option>
                    {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96].map(size => <option key={size} value={size}>{size}px</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-panvas-text-secondary">
                  Text color
                  <input type="color" value={preferences.color} onChange={event => setPreferences(previous => sanitizeHandwritingToolPreferences({ ...previous, color: event.target.value }))} className="mt-1.5 block h-9 w-full rounded-lg border border-panvas-border-default bg-panvas-bg-secondary p-1" />
                </label>
              </div>

              <div className="panvas-empty-state overflow-x-auto p-4">
                <div className="mb-3 text-xs font-medium text-panvas-text-secondary">Complete preview</div>
                <div className="min-w-full" aria-label="Complete converted text preview" data-preview-text={reviewText}>
                  {placements.map(({ line, placement }, index) => (
                    <p
                      key={line.id}
                      className="whitespace-pre"
                      style={{
                        marginLeft: `${Math.min(96, Math.max(0, line.bounds.x - previewLeft))}px`,
                        marginTop: index === 0 ? 0 : `${Math.max(4, line.blankLinesBefore * placement.lineHeight)}px`,
                        fontFamily: preferences.fontFamily,
                        fontSize: `${placement.fontSize}px`,
                        color: preferences.color,
                      }}
                    >
                      {line.text || 'Unrecognized line'}
                    </p>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-panvas-border-subtle px-5 py-4">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-panvas-text-secondary hover:bg-panvas-bg-hover focus-ring">Cancel</button>
          {!isLoading && !globalError && lines.length > 0 && (
            <button
              type="button"
              onClick={() => onConfirm(lines, preferences, providerId)}
              disabled={unresolvedLines > 0}
              className="rounded-lg bg-panvas-text-primary px-3 py-2 text-sm font-medium text-panvas-bg-primary hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              Convert {lines.length} {lines.length === 1 ? 'line' : 'lines'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
