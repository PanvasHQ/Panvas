import { ipcMain } from 'electron';
import type { RecognitionOptions } from '../../src/services/recognition/types';
import { recognizeWindowsInkRequest } from './windows-ink-worker';
import { requireTrustedSender } from './security.js';

export function registerRecognitionHandlers(): void {
  ipcMain.handle('recognition:recognizeStrokes', async (event, strokes: unknown, options?: RecognitionOptions) => {
    requireTrustedSender(event);
    return recognizeWindowsInkRequest(strokes, options);
  });
}
