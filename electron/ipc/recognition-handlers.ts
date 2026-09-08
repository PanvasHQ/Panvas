import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RecognitionOptions } from '../../src/services/recognition/types';
import { recognizeWindowsInkRequest } from './windows-ink-worker';

function requireTrustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url;
  let trusted = false;
  try {
    const sender = new URL(senderUrl ?? '');
    trusted = process.env.VITE_DEV_SERVER_URL
      ? sender.origin === new URL(process.env.VITE_DEV_SERVER_URL).origin
      : sender.href.split('#')[0] === pathToFileURL(path.join(app.getAppPath(), 'dist', 'index.html')).href;
  } catch {
    trusted = false;
  }
  if (!trusted) throw new Error('Untrusted IPC sender.');
}

export function registerRecognitionHandlers(): void {
  ipcMain.handle('recognition:recognizeStrokes', async (event, strokes: unknown, options?: RecognitionOptions) => {
    requireTrustedSender(event);
    return recognizeWindowsInkRequest(strokes, options);
  });
}
