/** Formats the small page counter shown on note and PDF pages. */
export function formatPageIndicator(currentPage: number, totalPages: number): string {
  const current = Number.isFinite(currentPage) ? Math.max(1, Math.floor(currentPage)) : 1;
  const total = Number.isFinite(totalPages) ? Math.max(current, Math.floor(totalPages)) : current;
  return `${current} / ${total}`;
}
