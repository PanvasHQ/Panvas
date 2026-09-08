import type { Stroke } from '@/components/notebook/engine/drawingTypes';
import type { HandwritingRecognitionProvider, RecognitionOptions, RecognitionResult } from '../types.ts';

export const UNSUPPORTED_RECOGNITION_MESSAGE = 'Handwriting recognition is not supported on this platform.';

export class UnsupportedRecognitionProvider implements HandwritingRecognitionProvider {
  readonly id = 'unsupported';
  readonly name = 'Unavailable';
  readonly isOffline = true as const;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async recognize(_strokes: Stroke[], _options?: RecognitionOptions): Promise<RecognitionResult> {
    return { status: 'unavailable', text: '', isAvailable: false, error: UNSUPPORTED_RECOGNITION_MESSAGE };
  }
}
