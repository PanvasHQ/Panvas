import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { KnowledgeService } from './knowledge-service.js';
import type { FindRelatedInput, KnowledgeReferenceInput, KnowledgeSearchInput } from '../../src/types/knowledge';

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

function registerReadOnlyHandler(channel: string, handler: (input?: unknown) => unknown): void {
  ipcMain.handle(channel, (event, input?: unknown) => {
    requireTrustedSender(event);
    return handler(input);
  });
}

export function registerKnowledgeHandlers(): void {
  const service = new KnowledgeService();
  registerReadOnlyHandler('knowledge:search', (input) => service.search(input as KnowledgeSearchInput));
  registerReadOnlyHandler('knowledge:getNoteContext', (input) => service.getNoteContext(input as KnowledgeReferenceInput));
  registerReadOnlyHandler('knowledge:findRelated', (input) => service.findRelated(input as FindRelatedInput));
  registerReadOnlyHandler('knowledge:health', () => service.health());
  registerReadOnlyHandler('knowledge:getNoteRef', (input) => service.getNoteRef(input as KnowledgeReferenceInput));
}
