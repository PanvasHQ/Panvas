/**
 * Pure ink rasterization for the local neural handwriting provider.
 *
 * This module is deliberately DOM-free: it computes a normalized bitmap
 * specification (bounds, uniform scale, pen-off gaps) from raw Panvas
 * strokes so the geometry can be unit-tested in Node and painted onto an
 * OffscreenCanvas/canvas by the runtime layer. It never mutates input
 * strokes and never touches page/viewport transforms.
 */

export interface RasterizerPoint {
  x: number;
  y: number;
}

export interface RasterizerStroke {
  points: readonly RasterizerPoint[];
}

export interface InkLineSpec {
  /** Tight ink bounds before padding (rounded to integers). */
  readonly width: number;
  readonly height: number;
  readonly strokes: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
}

const MIN_DIMENSION = 1;
const RELATIVE_PADDING = 0.08;

/** First-pass bounds: tight ink box with relative outer padding. */
export function computeInkLineSpec(strokes: readonly RasterizerStroke[]): InkLineSpec | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasInk = false;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      hasInk = true;
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!hasInk) return null;

  const rawWidth = Math.max(minX, maxX) - Math.min(minX, maxX);
  const rawHeight = Math.max(minY, maxY) - Math.min(minY, maxY);
  const padX = Math.max(4, rawWidth * RELATIVE_PADDING);
  const padY = Math.max(4, rawHeight * RELATIVE_PADDING);

  const left = Math.min(minX, maxX) - padX;
  const top = Math.min(minY, maxY) - padY;
  const width = Math.max(MIN_DIMENSION, rawWidth + padX * 2);
  const height = Math.max(MIN_DIMENSION, rawHeight + padY * 2);

  const translated = strokes.map(stroke =>
    stroke.points
      .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map(point => ({ x: point.x - left, y: point.y - top })),
  ).filter(stroke => stroke.length > 0);

  return {
    width: Math.round(width),
    height: Math.round(height),
    strokes: translated,
  };
}

export interface NormalizedLineImage {
  readonly imageData: ImageData;
  readonly width: number;
  readonly height: number;
}

/**
 * Target geometry for TrOCR: the processor itself rescales to 384×384 while
 * preserving aspect, so we only need a uniformly scaled bitmap whose longest
 * edge lands near the processor's input size. Never stretches X/Y
 * independently.
 */
const TARGET_LONG_EDGE = 384;
const MIN_LONG_EDGE = 64;

export interface BitmapSurface {
  createImageData(width: number, height: number): ImageData;
}

/**
 * Renders the ink spec into an RGBA buffer: dark handwriting on a clean
 * light background, antialiased strokes, uniform scale. Pure given a
 * surface, so tests can verify bounds, aspect, and whitespace without a
 * real canvas.
 */
export function renderNormalizedLineImage(
  spec: InkLineSpec,
  surface: BitmapSurface,
): NormalizedLineImage {
  const longEdge = Math.max(spec.width, spec.height);
  const scale = Math.max(
    MIN_LONG_EDGE / Math.max(1, longEdge),
    Math.min(1, TARGET_LONG_EDGE / Math.max(1, longEdge)),
  );
  const width = Math.max(1, Math.round(spec.width * scale));
  const height = Math.max(1, Math.round(spec.height * scale));
  const imageData = surface.createImageData(width, height);
  const data = imageData.data;

  // Clean light background (the model's IAM training domain).
  for (let index = 0; index < data.length; index += 4) {
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }

  const setPixel = (x: number, y: number, alpha: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    data[offset] = Math.round(data[offset] * (1 - alpha));
    data[offset + 1] = Math.round(data[offset + 1] * (1 - alpha));
    data[offset + 2] = Math.round(data[offset + 2] * (1 - alpha));
  };

  // Draw each pen-down path as antialiased segments. Inter-word and
  // inter-stroke gaps are preserved because the pen is never connected
  // between strokes — only points inside one stroke are joined.
  for (const stroke of spec.strokes) {
    for (let index = 1; index < stroke.length; index += 1) {
      drawAntialiasedSegment(
        setPixel,
        stroke[index - 1].x * scale,
        stroke[index - 1].y * scale,
        stroke[index].x * scale,
        stroke[index].y * scale,
      );
    }
    // Single-point taps still leave a dot.
    if (stroke.length === 1) {
      drawAntialiasedSegment(setPixel, stroke[0].x * scale, stroke[0].y * scale, stroke[0].x * scale + 0.01, stroke[0].y * scale);
    }
  }

  return { imageData, width, height };
}

/** Bresenham-style walk with 1px-radius coverage; cheap and adequate for ink. */
function drawAntialiasedSegment(
  setPixel: (x: number, y: number, alpha: number) => void,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  for (let step = 0; step <= steps; step += 1) {
    const x = x0 + (dx * step) / steps;
    const y = y0 + (dy * step) / steps;
    const baseX = Math.floor(x);
    const baseY = Math.floor(y);
    const fracX = x - baseX;
    const fracY = y - baseY;
    setPixel(baseX, baseY, (1 - fracX) * (1 - fracY));
    setPixel(baseX + 1, baseY, fracX * (1 - fracY));
    setPixel(baseX, baseY + 1, (1 - fracX) * fracY);
    setPixel(baseX + 1, baseY + 1, fracX * fracY);
  }
}
