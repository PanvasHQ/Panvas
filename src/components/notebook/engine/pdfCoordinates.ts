import type { PdfPageRotation } from '@/types/notebook';

export interface PdfPageDimensions {
  width: number;
  height: number;
}

export interface PdfPoint {
  x: number;
  y: number;
}

export interface PdfSourceRect extends PdfPoint {
  width: number;
  height: number;
}

export interface PdfVisualRect extends PdfSourceRect {}

/**
 * Return the dimensions of a page after applying its clockwise visual rotation.
 * PDF annotations remain stored in the unrotated source-page coordinate system.
 */
export function visualPageDimensions(dimensions: PdfPageDimensions, rotation: PdfPageRotation): PdfPageDimensions {
  return rotation === 90 || rotation === 270
    ? { width: dimensions.height, height: dimensions.width }
    : { ...dimensions };
}

/** Map a persisted source-page point into the rotated visual page. */
export function sourceToVisual(point: PdfPoint, dimensions: PdfPageDimensions, rotation: PdfPageRotation): PdfPoint {
  if (rotation === 90) return { x: dimensions.height - point.y, y: point.x };
  if (rotation === 180) return { x: dimensions.width - point.x, y: dimensions.height - point.y };
  if (rotation === 270) return { x: point.y, y: dimensions.width - point.x };
  return { ...point };
}

/** Map a rotated visual-page point back to the persisted source-page coordinate system. */
export function visualToSource(point: PdfPoint, dimensions: PdfPageDimensions, rotation: PdfPageRotation): PdfPoint {
  if (rotation === 90) return { x: point.y, y: dimensions.height - point.x };
  if (rotation === 180) return { x: dimensions.width - point.x, y: dimensions.height - point.y };
  if (rotation === 270) return { x: dimensions.width - point.y, y: point.x };
  return { ...point };
}

/**
 * Convert a visual-page movement delta to the canonical source-page axes.
 * Unlike points, deltas are translation vectors and therefore do not include
 * the page-size translation used to place a rotated page in the first quadrant.
 */
export function visualDeltaToSource(delta: PdfPoint, rotation: PdfPageRotation): PdfPoint {
  if (rotation === 90) return { x: delta.y, y: -delta.x };
  if (rotation === 180) return { x: -delta.x, y: -delta.y };
  if (rotation === 270) return { x: -delta.y, y: delta.x };
  return { ...delta };
}

/**
 * Transform an axis-aligned source rectangle into the visual page's enclosing
 * rectangle. This is used by DOM overlays, whose layout boxes cannot represent
 * a rotated rectangle directly.
 */
export function sourceRectToVisual(rect: PdfSourceRect, dimensions: PdfPageDimensions, rotation: PdfPageRotation): PdfVisualRect {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ].map(point => sourceToVisual(point, dimensions, rotation));
  const xs = corners.map(point => point.x);
  const ys = corners.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Canvas 2D matrix for source-page coordinates to visual-page coordinates. */
export function pdfRotationMatrix(
  rotation: PdfPageRotation,
  dimensions: PdfPageDimensions,
): [a: number, b: number, c: number, d: number, e: number, f: number] {
  if (rotation === 90) return [0, 1, -1, 0, dimensions.height, 0];
  if (rotation === 180) return [-1, 0, 0, -1, dimensions.width, dimensions.height];
  if (rotation === 270) return [0, -1, 1, 0, 0, dimensions.width];
  return [1, 0, 0, 1, 0, 0];
}

/** Apply the canonical source-to-visual transform to a Canvas 2D context. */
export function applyPdfRotationTransform(
  ctx: CanvasRenderingContext2D,
  rotation: PdfPageRotation,
  dimensions: PdfPageDimensions,
): void {
  ctx.transform(...pdfRotationMatrix(rotation, dimensions));
}
