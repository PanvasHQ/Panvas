import type { BoundingBox, Stroke, TextObject } from '../../components/notebook/engine/drawingTypes.ts';
import type {
  BeautifiedTextPlacement,
  ExistingHandwritingLinePlacement,
  HandwritingToolPreferences,
} from '../beautification/handwritingBeautification.ts';

export type HandwritingContinuationSide = 'append' | 'prepend' | 'overlap';

export interface GeneratedHandwritingLineMatch {
  text: TextObject;
  sourceBounds: BoundingBox;
  sourceBaseline: number;
  sourceLineHeight: number;
  side: HandwritingContinuationSide;
}

interface TextTypography {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sourceGeometry(text: TextObject): Omit<GeneratedHandwritingLineMatch, 'text' | 'side'> | null {
  const metadata = text.metadata;
  if (metadata?.generatedFrom !== 'handwriting-recognition') return null;
  const source = metadata.sourceBounds as Partial<BoundingBox> | undefined;
  const baseline = finiteNumber(metadata.sourceBaseline);
  const lineHeight = finiteNumber(metadata.sourceLineHeight) ?? finiteNumber(source?.height);
  if (
    !source
    || !Number.isFinite(source.x)
    || !Number.isFinite(source.y)
    || !Number.isFinite(source.width)
    || !Number.isFinite(source.height)
    || baseline === null
    || lineHeight === null
  ) return null;
  return {
    sourceBounds: source as BoundingBox,
    sourceBaseline: baseline,
    sourceLineHeight: Math.max(1, lineHeight),
  };
}

function horizontalGap(left: BoundingBox, right: BoundingBox): number {
  if (right.x > left.x + left.width) return right.x - (left.x + left.width);
  if (left.x > right.x + right.width) return left.x - (right.x + right.width);
  return 0;
}

/** Finds the nearest generated line using only persisted page-coordinate geometry. */
export function findSameGeneratedHandwritingLine(
  texts: readonly TextObject[],
  sourceBounds: BoundingBox,
  layerId: string | undefined,
  pageId: string | null,
): GeneratedHandwritingLineMatch | null {
  const sourceBaseline = sourceBounds.y + sourceBounds.height * 0.82;
  return texts.flatMap(text => {
    if (text.layerId !== layerId) return [];
    const geometry = sourceGeometry(text);
    if (!geometry) return [];
    const existingPageId = text.metadata?.sourcePageId;
    if (pageId && typeof existingPageId === 'string' && existingPageId !== pageId) return [];
    // A continuation's persisted sourceBounds is a union of every appended
    // group, so its height is not a trustworthy line-height tolerance.
    const scale = Math.max(1, sourceBounds.height, geometry.sourceLineHeight);
    const baselineDistance = Math.abs(sourceBaseline - geometry.sourceBaseline);
    const gap = horizontalGap(sourceBounds, geometry.sourceBounds);
    if (baselineDistance > scale * 0.58 || gap > scale * 5) return [];

    const tolerance = scale * 0.35;
    const side: HandwritingContinuationSide = sourceBounds.x + sourceBounds.width <= geometry.sourceBounds.x + tolerance
      ? 'prepend'
      : sourceBounds.x >= geometry.sourceBounds.x + geometry.sourceBounds.width - tolerance
        ? 'append'
        : 'overlap';
    return [{
      text,
      ...geometry,
      side,
      score: baselineDistance + gap * 0.02,
    }];
  }).sort((left, right) => left.score - right.score)[0] ?? null;
}

function firstTextStyle(content: any): TextTypography {
  const visit = (node: any): TextTypography | null => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'text' && Array.isArray(node.marks)) {
      const style = node.marks.find((mark: any) => mark?.type === 'textStyle')?.attrs;
      if (style) {
        const parsedSize = typeof style.fontSize === 'string' ? Number.parseFloat(style.fontSize) : style.fontSize;
        return {
          fontFamily: typeof style.fontFamily === 'string' ? style.fontFamily : undefined,
          fontSize: Number.isFinite(parsedSize) ? parsedSize : undefined,
          color: typeof style.color === 'string' ? style.color.toLowerCase() : undefined,
        };
      }
    }
    if (!Array.isArray(node.content)) return null;
    for (const child of node.content) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(content) ?? {};
}

export function hasMatchingHandwritingTypography(
  text: TextObject,
  preferences: HandwritingToolPreferences,
  resolvedFontSize: number,
): boolean {
  const typography = firstTextStyle(text.content);
  const existingFontSize = finiteNumber(text.metadata?.handwritingFontSize) ?? typography.fontSize;
  const sizeMatches = preferences.fontSize === 'auto'
    ? existingFontSize !== undefined
      && Math.abs(existingFontSize - resolvedFontSize) <= Math.max(2, existingFontSize * 0.2)
    : typography.fontSize === resolvedFontSize;
  return typography.fontFamily === preferences.fontFamily
    && sizeMatches
    && typography.color === preferences.color.toLowerCase();
}

function separator(left: string, right: string): string {
  if (!left || !right || /\s$/.test(left) || /^\s/.test(right)) return '';
  if (/^[,.;:!?%)\]}]/.test(right) || /[(\[{]$/.test(left)) return '';
  return ' ';
}

function edgeTextNode(content: any, side: Exclude<HandwritingContinuationSide, 'overlap'>): any | null {
  if (!content || typeof content !== 'object') return null;
  if (content.type === 'text') return content;
  if (!Array.isArray(content.content)) return null;
  const children = side === 'append' ? [...content.content].reverse() : content.content;
  for (const child of children) {
    const found = edgeTextNode(child, side);
    if (found) return found;
  }
  return null;
}

/** Preserves the existing TipTap tree and marks while extending its edge text node. */
export function extendHandwritingTipTapContent(
  content: any,
  phrase: string,
  side: Exclude<HandwritingContinuationSide, 'overlap'>,
): any {
  const next = structuredClone(content);
  const edge = edgeTextNode(next, side);
  if (!edge) return next;
  const existing = typeof edge.text === 'string' ? edge.text : '';
  edge.text = side === 'append'
    ? `${existing}${separator(existing, phrase)}${phrase}`
    : `${phrase}${separator(phrase, existing)}${existing}`;
  return next;
}

function unionBounds(left: BoundingBox, right: BoundingBox): BoundingBox {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const maxX = Math.max(left.x + left.width, right.x + right.width);
  const maxY = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: maxX - x, height: maxY - y };
}

export function createExtendedHandwritingLine(
  match: GeneratedHandwritingLineMatch,
  phrase: string,
  placement: BeautifiedTextPlacement,
  sourceStrokes: readonly Stroke[],
  batchId: string,
): TextObject | null {
  if (match.side === 'overlap') return null;
  const existing = match.text;
  const sourceBounds = unionBounds(match.sourceBounds, placement.bounds);
  const x = Math.min(existing.x, placement.x);
  const right = Math.max(existing.x + existing.width, placement.x + placement.width);
  const previousBatchIds = Array.isArray(existing.metadata?.continuationBatchIds)
    ? existing.metadata.continuationBatchIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const previousStrokeIds = Array.isArray(existing.metadata?.sourceStrokeIds)
    ? existing.metadata.sourceStrokeIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  return {
    ...structuredClone(existing),
    x,
    y: existing.y,
    width: Math.max(160, right - x),
    height: Math.max(existing.height ?? 0, placement.height),
    content: extendHandwritingTipTapContent(existing.content, phrase, match.side),
    metadata: {
      ...(structuredClone(existing.metadata) ?? {}),
      handwritingLineId: existing.metadata?.handwritingLineId ?? existing.metadata?.recognitionBatchId ?? existing.id,
      continuationBatchIds: [...previousBatchIds, batchId].filter((id, index, ids) => ids.indexOf(id) === index),
      sourceStrokeIds: [...previousStrokeIds, ...sourceStrokes.map(stroke => stroke.id)]
        .filter((id, index, ids) => ids.indexOf(id) === index),
      sourceBounds,
      sourceBaseline: match.sourceBaseline,
      sourceLineHeight: Math.max(match.sourceLineHeight, placement.bounds.height),
      sourceLeftX: sourceBounds.x,
      sourceRightX: sourceBounds.x + sourceBounds.width,
    },
  };
}

/** New physical lines retain source Y; only a nearby shared left margin may align. */
export function anchorNewHandwritingLinePlacement(
  placement: BeautifiedTextPlacement,
  existingLines: readonly ExistingHandwritingLinePlacement[],
): BeautifiedTextPlacement {
  const aligned = existingLines
    .flatMap(line => {
      const scale = Math.max(1, placement.bounds.height, line.sourceBounds.height);
      const baselineDistance = Math.abs(placement.baseline - line.sourceBaseline);
      if (
        baselineDistance < scale * 0.72
        || Math.abs(placement.bounds.x - line.sourceBounds.x) > scale * 1.25
      ) return [];
      return [{ line, baselineDistance }];
    })
    .sort((left, right) => left.baselineDistance - right.baselineDistance)[0];
  return aligned ? { ...placement, bounds: { ...placement.bounds }, x: aligned.line.x } : placement;
}

/** Different-format continuations stay separate but share the persisted source baseline. */
export function anchorSeparateSameLinePlacement(
  placement: BeautifiedTextPlacement,
  match: GeneratedHandwritingLineMatch,
): BeautifiedTextPlacement {
  const baselineOffset = placement.baseline - placement.y;
  const x = match.side === 'prepend'
    ? Math.min(placement.x, match.text.x - placement.width)
    : Math.max(placement.x, match.text.x + match.text.width);
  return {
    ...placement,
    bounds: { ...placement.bounds },
    x,
    y: Math.max(0, match.sourceBaseline - baselineOffset),
    baseline: match.sourceBaseline,
  };
}

export function getHandwritingText(content: any): string {
  if (!content || typeof content !== 'object') return '';
  if (content.type === 'text') return typeof content.text === 'string' ? content.text : '';
  if (!Array.isArray(content.content)) return '';
  return content.content.map((node: any) => getHandwritingText(node)).join(content.type === 'doc' ? '\n' : '');
}
