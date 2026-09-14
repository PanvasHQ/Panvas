export interface PdfPageFrame {
  page: number;
  top: number;
  bottom: number;
}

/**
 * Resolve the page that owns the viewport. The previous page keeps a small
 * score advantage so a shared page gap cannot make selection flicker.
 */
export function resolveActivePdfPage(
  frames: readonly PdfPageFrame[],
  viewportTop: number,
  viewportBottom: number,
  previousPage?: number,
): number | undefined {
  if (frames.length === 0) return undefined;
  const viewportHeight = Math.max(1, viewportBottom - viewportTop);
  const viewportCenter = (viewportTop + viewportBottom) / 2;
  let bestPage = frames[0].page;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const frame of frames) {
    const intersection = Math.max(0, Math.min(frame.bottom, viewportBottom) - Math.max(frame.top, viewportTop));
    const center = (frame.top + frame.bottom) / 2;
    const distancePenalty = Math.abs(center - viewportCenter) / viewportHeight;
    const retainedPageBonus = frame.page === previousPage ? 0.08 : 0;
    const score = intersection / viewportHeight - distancePenalty * 0.05 + retainedPageBonus;
    if (score > bestScore) {
      bestScore = score;
      bestPage = frame.page;
    }
  }
  return bestPage;
}
