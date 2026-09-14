import type { BoundingBox, Stroke } from '@/components/notebook/engine/drawingTypes';
import { PANVAS_TEXT_FONT_FAMILIES } from '../../components/notebook/textFonts.ts';
export { HANDWRITING_FONT_FAMILIES, PANVAS_TEXT_FONT_FAMILIES, STANDARD_TEXT_FONT_FAMILIES } from '../../components/notebook/textFonts.ts';

export type HandwritingFontFamily = typeof PANVAS_TEXT_FONT_FAMILIES[number];

export interface HandwritingTypography {
  fontFamily: HandwritingFontFamily;
  fontSize: number;
  color: string;
}

export interface HandwritingToolPreferences {
  fontFamily: HandwritingFontFamily;
  fontSize: 'auto' | number;
  color: string;
  thickness: number;
  recentColors: string[];
  /** BCP-47 language tag. Empty means the browser/OS default language. */
  language: string;
}

/** Recognition languages exposed by the active local pipeline. Keep this
 * deliberately small until additional language models are actually shipped. */
export const SUPPORTED_HANDWRITING_RECOGNITION_LANGUAGES = [
  { value: 'en-US', label: 'English' },
] as const;

export function normalizeHandwritingRecognitionLanguage(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return '';
  // Keep the persisted shape stable while safely migrating every legacy
  // non-English selection to the one model currently available.
  return 'en-US';
}

export interface BeautifiedTextPlacement {
  bounds: BoundingBox;
  baseline: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
}

export interface ExistingHandwritingLinePlacement {
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  sourceBounds: BoundingBox;
  sourceBaseline: number;
}

export const DEFAULT_HANDWRITING_TYPOGRAPHY: HandwritingTypography = {
  fontFamily: "'Patrick Hand', cursive",
  fontSize: 24,
  color: '#20242a',
};

export const DEFAULT_HANDWRITING_TOOL_PREFERENCES: HandwritingToolPreferences = {
  fontFamily: DEFAULT_HANDWRITING_TYPOGRAPHY.fontFamily,
  fontSize: 'auto',
  color: DEFAULT_HANDWRITING_TYPOGRAPHY.color,
  thickness: 2.4,
  recentColors: ['#20242a', '#2563eb', '#dc2626', '#16a34a', '#7c3aed'],
  language: '',
};

function safeTypography(options: Partial<HandwritingTypography>): HandwritingTypography {
  const fontFamily = PANVAS_TEXT_FONT_FAMILIES.includes(options.fontFamily as HandwritingFontFamily)
    ? options.fontFamily
    : DEFAULT_HANDWRITING_TYPOGRAPHY.fontFamily;
  const fontSize = Number.isFinite(options.fontSize)
    ? Math.min(96, Math.max(10, Math.round(options.fontSize as number)))
    : DEFAULT_HANDWRITING_TYPOGRAPHY.fontSize;
  const color = typeof options.color === 'string' && /^#[0-9a-f]{6}$/i.test(options.color)
    ? options.color
    : DEFAULT_HANDWRITING_TYPOGRAPHY.color;
  return { fontFamily, fontSize, color } as HandwritingTypography;
}

export function sanitizeHandwritingToolPreferences(input: unknown): HandwritingToolPreferences {
  const value = input && typeof input === 'object' ? input as Partial<HandwritingToolPreferences> : {};
  const fontFamily = PANVAS_TEXT_FONT_FAMILIES.includes(value.fontFamily as HandwritingFontFamily)
    ? value.fontFamily as HandwritingFontFamily
    : DEFAULT_HANDWRITING_TOOL_PREFERENCES.fontFamily;
  const fontSize = value.fontSize === 'auto'
    ? 'auto'
    : Number.isFinite(value.fontSize)
      ? Math.min(96, Math.max(10, Math.round(value.fontSize as number)))
      : DEFAULT_HANDWRITING_TOOL_PREFERENCES.fontSize;
  const color = typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)
    ? value.color
    : DEFAULT_HANDWRITING_TOOL_PREFERENCES.color;
  const thickness = Number.isFinite(value.thickness)
    ? Math.min(20, Math.max(0.5, value.thickness as number))
    : DEFAULT_HANDWRITING_TOOL_PREFERENCES.thickness;
  const suppliedColors = Array.isArray(value.recentColors) ? value.recentColors : [];
  const recentColors = [color, ...suppliedColors]
    .filter((candidate): candidate is string => typeof candidate === 'string' && /^#[0-9a-f]{6}$/i.test(candidate))
    .filter((candidate, index, colors) => colors.findIndex(item => item.toLowerCase() === candidate.toLowerCase()) === index)
    .slice(0, 5);
  const language = typeof value.language === 'string' && value.language.length <= 35
    ? normalizeHandwritingRecognitionLanguage(value.language)
    : DEFAULT_HANDWRITING_TOOL_PREFERENCES.language;
  return { fontFamily, fontSize, color, thickness, recentColors, language };
}

export interface HandwritingInkStyleTarget {
  setHandwritingInkStyle(color: string, thickness: number): void;
}

/** Applies the recognition mode's independent raw-ink style to canonical engine state. */
export function applyHandwritingInkPreferences(
  target: HandwritingInkStyleTarget,
  preferences: unknown,
): HandwritingToolPreferences {
  const sanitized = sanitizeHandwritingToolPreferences(preferences);
  target.setHandwritingInkStyle(sanitized.color, sanitized.thickness);
  return sanitized;
}

export function getHandwritingBounds(strokes: readonly Stroke[]): BoundingBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return Number.isFinite(minX)
    ? { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
    : null;
}

interface MeasuredLine {
  width: number;
  ascent: number;
  descent: number;
}

function measureLine(text: string, fontFamily: string, fontSize: number): MeasuredLine {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = `${fontSize}px ${fontFamily}`;
      const metrics = context.measureText(text || 'Mg');
      return {
        width: metrics.width,
        ascent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
        descent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
      };
    }
  }
  // SSR/tests do not expose a canvas. Runtime placement always takes the
  // measured branch above; this deterministic fallback keeps pure logic usable.
  return { width: text.length * fontSize * 0.56, ascent: fontSize * 0.8, descent: fontSize * 0.2 };
}

function resolveAutoFontSize(text: string, fontFamily: string, sourceHeight: number): number {
  const sample = text.split(/\r?\n/).find(line => line.trim()) || 'Mg';
  const targetHeight = Math.max(10, sourceHeight);
  let low = 10;
  let high = 96;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const mid = (low + high) / 2;
    const metrics = measureLine(sample, fontFamily, mid);
    if (metrics.ascent + metrics.descent < targetHeight) low = mid;
    else high = mid;
  }
  return Math.round(Math.min(96, Math.max(10, (low + high) / 2)));
}

/**
 * Derives a text box from page-coordinate ink geometry. Font metrics come from
 * the browser canvas at runtime, so zoom and device pixel ratio never enter the
 * calculation and the first text baseline stays close to the source ink.
 */
export function createBeautifiedTextPlacement(
  text: string,
  strokes: readonly Stroke[],
  preferences: HandwritingToolPreferences,
): BeautifiedTextPlacement | null {
  const bounds = getHandwritingBounds(strokes);
  if (!bounds) return null;
  const fontSize = preferences.fontSize === 'auto'
    ? resolveAutoFontSize(text, preferences.fontFamily, bounds.height)
    : preferences.fontSize;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const metrics = lines.map(line => measureLine(line || ' ', preferences.fontFamily, fontSize));
  const lineHeight = Math.ceil(fontSize * 1.2);
  const baseline = bounds.y + bounds.height * 0.82;
  const firstAscent = metrics[0]?.ascent ?? fontSize * 0.8;
  const measuredWidth = Math.max(...metrics.map(metric => metric.width), 0);
  return {
    bounds,
    baseline,
    x: bounds.x,
    // FloatingTextEditor contributes 4px content padding.
    y: Math.max(0, baseline - firstAscent - 4),
    width: Math.max(160, Math.ceil(bounds.width), Math.ceil(measuredWidth + 12)),
    height: Math.max(72, Math.ceil(lines.length * lineHeight + 8)),
    fontSize,
    lineHeight,
  };
}

/**
 * Preserves source placement first, then applies only the minimum page-space
 * correction needed to align a shared handwritten margin and prevent glyph
 * bands from overlapping earlier generated handwriting lines.
 */
export function resolveHandwritingLinePlacement(
  placement: BeautifiedTextPlacement,
  existingLines: readonly ExistingHandwritingLinePlacement[],
): BeautifiedTextPlacement {
  const resolved = { ...placement, bounds: { ...placement.bounds } };
  const alignedLine = existingLines
    .filter(line => {
      const scale = Math.max(1, placement.bounds.height, line.sourceBounds.height);
      const verticalSeparation = Math.abs(placement.baseline - line.sourceBaseline);
      return verticalSeparation >= scale * 0.65
        && Math.abs(placement.bounds.x - line.sourceBounds.x) <= scale * 1.25;
    })
    .sort((left, right) => (
      Math.abs(placement.baseline - left.sourceBaseline)
      - Math.abs(placement.baseline - right.sourceBaseline)
    ))[0];
  if (alignedLine) resolved.x = alignedLine.x;

  const priorLines = existingLines
    .filter(line => line.sourceBaseline < placement.baseline)
    .sort((left, right) => left.sourceBaseline - right.sourceBaseline);
  for (const line of priorLines) {
    const overlapsHorizontally = resolved.x < line.x + line.width && resolved.x + resolved.width > line.x;
    if (!overlapsHorizontally) continue;
    const sourceScale = Math.max(1, placement.bounds.height, line.sourceBounds.height);
    if (placement.baseline - line.sourceBaseline < sourceScale * 0.65) continue;

    const visualTop = resolved.y + 4;
    const priorVisualBottom = line.y + 4 + line.lineHeight;
    const naturalGap = Math.max(1, Math.min(placement.lineHeight, line.lineHeight) * 0.18);
    if (visualTop < priorVisualBottom + naturalGap) {
      resolved.y += priorVisualBottom + naturalGap - visualTop;
    }
  }
  return resolved;
}

/** Pure transformation from reviewed text to Panvas' established TipTap textStyle document. */
export function createHandwritingTipTapContent(text: string, options: Partial<HandwritingTypography> = {}): any {
  const typography = safeTypography(options);
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return {
    type: 'doc',
    content: lines.map(line => ({
      type: 'paragraph',
      content: line ? [{
        type: 'text',
        text: line,
        marks: [{
          type: 'textStyle',
          attrs: {
            fontFamily: typography.fontFamily,
            fontSize: `${typography.fontSize}px`,
            color: typography.color,
          },
        }],
      }] : [],
    })),
  };
}
