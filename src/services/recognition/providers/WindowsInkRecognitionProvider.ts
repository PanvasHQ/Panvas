import type { Stroke } from '@/components/notebook/engine/drawingTypes';
import type { HandwritingRecognitionProvider, RecognitionOptions, RecognitionResult } from '../types.ts';
import { UNSUPPORTED_RECOGNITION_MESSAGE } from './UnsupportedRecognitionProvider.ts';

export interface RecognitionBridge {
  recognize(strokes: Stroke[], options?: RecognitionOptions): Promise<RecognitionResult>;
}

function isWindowsElectron(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && /^win/i.test(navigator.platform)
    && typeof window.panvas?.recognition?.recognize === 'function';
}

export class WindowsInkRecognitionProvider implements HandwritingRecognitionProvider {
  readonly id = 'windows-ink';
  readonly name = 'Windows Ink';
  readonly isOffline = true as const;
  private readonly bridge: RecognitionBridge | null;

  constructor(bridge: RecognitionBridge | null = isWindowsElectron() ? window.panvas.recognition : null) {
    this.bridge = bridge;
  }

  async isAvailable(): Promise<boolean> {
    return this.bridge !== null;
  }

  async recognize(strokes: Stroke[], options?: RecognitionOptions): Promise<RecognitionResult> {
    if (!this.bridge) return { status: 'unavailable', text: '', isAvailable: false, error: UNSUPPORTED_RECOGNITION_MESSAGE };
    try {
      return await this.bridge.recognize(strokes, options);
    } catch (error) {
      return {
        status: 'error',
        text: '',
        isAvailable: true,
        error: error instanceof Error ? error.message : 'Windows handwriting recognition failed.',
      };
    }
  }
}
