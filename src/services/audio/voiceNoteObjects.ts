import { generateId } from '../../lib/utils/id.ts';
import { DEFAULT_PAGE_LAYER_ID, type AudioNote, type TextObject } from '../../components/notebook/engine/drawingTypes.ts';
import type { CustomBlock } from '../../types/canvas.ts';
import type { PageAudioOwner } from './audioLifecycle.ts';

export const VOICE_NOTE_WIDTH = 300;
export const VOICE_NOTE_HEIGHT = 132;
export const VOICE_NOTE_MIN_WIDTH = 156;
export const VOICE_NOTE_MIN_HEIGHT = 84;

export function clampVoiceNoteSize(width: number, height: number): { width: number; height: number } {
  return { width: Math.max(VOICE_NOTE_MIN_WIDTH, width), height: Math.max(VOICE_NOTE_MIN_HEIGHT, height) };
}

export type VoiceNoteObject = TextObject & {
  metadata: NonNullable<TextObject['metadata']> & {
    isVoiceNote: true;
    audioNoteId: string;
    audioFileId?: string;
  };
};

export function isVoiceNoteObject(value: unknown): value is VoiceNoteObject {
  const object = value as TextObject | undefined;
  return object?.type === 'text' && object.metadata?.isVoiceNote === true && typeof object.metadata.audioNoteId === 'string';
}

export function createVoiceNoteObject(note: AudioNote, index = 0): VoiceNoteObject {
  return {
    id: generateId('voice'), type: 'text', x: 72 + (index % 3) * 24, y: 92 + (index % 5) * 28,
    width: VOICE_NOTE_WIDTH, height: VOICE_NOTE_HEIGHT, createdAt: note.createdAt,
    layerId: DEFAULT_PAGE_LAYER_ID,
    content: { type: 'doc', content: [] },
    metadata: { isVoiceNote: true, audioNoteId: note.id, audioFileId: note.fileId },
  };
}

/** Creates the persisted custom-block payload for a canvas voice note. The
 * canvas id is supplied by the recording session's immutable owner. */
export function createCanvasVoiceNoteBlock(
  canvasId: string,
  audioFileId: string,
  audioNoteId: string,
  fileName: string,
  mimeType: string,
  durationMs: number,
  index = 0,
  position?: { x: number; y: number },
): Omit<CustomBlock, 'id' | 'createdAt' | 'updatedAt' | 'userId'> {
  return {
    canvasFileId: canvasId,
    type: 'audio',
    x: position?.x ?? 120 + (index % 3) * 24,
    y: position?.y ?? 120 + (index % 5) * 28,
    width: VOICE_NOTE_WIDTH,
    height: VOICE_NOTE_HEIGHT,
    content: fileName,
    metadata: { audioNoteId, audioFileId, mimeType, durationMs },
  };
}

export function isActiveCanvasAudioOwner(activeCanvasId: string | null, owner: PageAudioOwner): boolean {
  return activeCanvasId === owner.pageId;
}

export function getCanvasVoiceNoteViewportPosition(
  viewport: { width: number; height: number },
  transform: { scrollX?: number; scrollY?: number; zoom?: number | { value?: number } },
): { x: number; y: number } {
  const rawZoom = typeof transform.zoom === 'number' ? transform.zoom : transform.zoom?.value;
  const zoom = Number.isFinite(rawZoom) && Number(rawZoom) > 0 ? Number(rawZoom) : 1;
  return {
    x: viewport.width / (2 * zoom) - (transform.scrollX ?? 0) - VOICE_NOTE_WIDTH / 2,
    y: viewport.height / (2 * zoom) - (transform.scrollY ?? 0) - VOICE_NOTE_HEIGHT / 2,
  };
}
