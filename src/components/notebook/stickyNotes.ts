import type { TextObject } from './engine/drawingTypes.ts';

export const STICKY_NOTE_WIDTH = 220;
export const STICKY_NOTE_MIN_HEIGHT = 180;
export const DEFAULT_STICKY_NOTE_COLOR = '#fef08a';

export const STICKY_NOTE_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Blue', value: '#bae6fd' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Peach', value: '#fed7aa' },
  { name: 'Warm Yellow', value: '#fef08a' },
  { name: 'Soft Green', value: '#bbf7d0' },
  { name: 'Sky Blue', value: '#bae6fd' },
  { name: 'Rose Pink', value: '#fbcfe8' },
  { name: 'Lavender', value: '#e9d5ff' },
  { name: 'Warm Peach', value: '#fed7aa' },
  { name: 'Neutral Gray', value: '#e5e7eb' },
] as const;

export const STICKY_NOTE_SHAPES = [
  { id: 'rounded-rect', label: 'Rounded' },
  { id: 'square', label: 'Square' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'oval', label: 'Oval' },
  { id: 'star', label: 'Star' },
] as const;

export type StickyNoteShape = (typeof STICKY_NOTE_SHAPES)[number]['id'];
export const DEFAULT_STICKY_NOTE_SHAPE: StickyNoteShape = 'rounded-rect';

export function isValidHexColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

export const isStickyNoteColor = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return STICKY_NOTE_COLORS.some(color => color.value.toLowerCase() === normalized) || isValidHexColor(value);
};

export const isStickyNote = (object: Pick<TextObject, 'metadata'>): boolean =>
  object.metadata?.isStickyNote === true;

/** Older starter stickies stored their prompt as document content instead of a placeholder. */
export function isLegacyStickyPlaceholderContent(content: unknown): boolean {
  const text = (content as { content?: Array<{ content?: Array<{ text?: unknown }> }> })?.content
    ?.flatMap(paragraph => paragraph.content ?? [])
    .map(node => typeof node.text === 'string' ? node.text : '')
    .join('')
    .trim();
  return text === 'Add a thought...' || text === 'Add a thought…' || text === 'Take a note...';
}

export function getStickyNoteColor(object: Pick<TextObject, 'metadata'>): string {
  return isStickyNoteColor(object.metadata?.color)
    ? (object.metadata!.color as string)
    : DEFAULT_STICKY_NOTE_COLOR;
}

export function getStickyNoteOpacity(object: Pick<TextObject, 'metadata'>): number {
  const opacity = object.metadata?.opacity;
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    return Math.max(0, Math.min(1, opacity));
  }
  return 1;
}

export function getStickyNoteShape(object: Pick<TextObject, 'metadata'>): StickyNoteShape {
  const shape = object.metadata?.shape;
  if (
    shape === 'square' ||
    shape === 'rounded-rect' ||
    shape === 'rectangle' ||
    shape === 'circle' ||
    shape === 'oval' ||
    shape === 'star'
  ) {
    return shape;
  }
  return DEFAULT_STICKY_NOTE_SHAPE;
}

export function getShapeBorderRadius(shape: StickyNoteShape): string {
  switch (shape) {
    case 'square':
    case 'rectangle':
      return '0px';
    case 'circle':
      return '9999px';
    case 'oval':
      return '50%';
    case 'rounded-rect':
    default:
      return '12px';
  }
}

export function hexToRgba(hex: string, opacity: number): string {
  const cleanHex = hex.replace('#', '').trim();
  let r = 254;
  let g = 240;
  let b = 138;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length >= 6) {
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  }
  const safeAlpha = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
}

export function createStickyNote({
  id,
  x,
  y,
  color = DEFAULT_STICKY_NOTE_COLOR,
  opacity = 1,
  shape = DEFAULT_STICKY_NOTE_SHAPE,
  createdAt = Date.now(),
}: {
  id: string;
  x: number;
  y: number;
  color?: string;
  opacity?: number;
  shape?: StickyNoteShape;
  createdAt?: number;
}): TextObject {
  let width = STICKY_NOTE_WIDTH;
  let height = STICKY_NOTE_MIN_HEIGHT;
  if (shape === 'square' || shape === 'circle') {
    width = 200;
    height = 200;
  } else if (shape === 'rectangle') {
    width = 240;
    height = 160;
  } else if (shape === 'star') {
    width = 220;
    height = 220;
  }

  return {
    id,
    type: 'text',
    x,
    y,
    width,
    height,
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    },
    createdAt,
    metadata: {
      isStickyNote: true,
      color: isStickyNoteColor(color) ? color : DEFAULT_STICKY_NOTE_COLOR,
      opacity: Math.max(0, Math.min(1, opacity)),
      shape,
    },
  };
}

export function updateStickyNote(
  object: TextObject,
  updates: { color?: string; opacity?: number; shape?: StickyNoteShape }
): TextObject {
  const nextColor =
    updates.color !== undefined
      ? isStickyNoteColor(updates.color)
        ? updates.color
        : getStickyNoteColor(object)
      : getStickyNoteColor(object);
  const nextOpacity =
    updates.opacity !== undefined
      ? Math.max(0, Math.min(1, updates.opacity))
      : getStickyNoteOpacity(object);
  const nextShape = updates.shape !== undefined ? updates.shape : getStickyNoteShape(object);

  return {
    ...object,
    metadata: {
      ...(object.metadata ?? {}),
      isStickyNote: true,
      color: nextColor,
      opacity: nextOpacity,
      shape: nextShape,
    },
  };
}

export function updateStickyNoteColor(object: TextObject, color: string): TextObject {
  return updateStickyNote(object, { color });
}
