import { ipcMain } from 'electron';
import { KnowledgeService } from './knowledge-service.js';
import type { FindRelatedInput, KnowledgeReferenceInput, KnowledgeSearchInput } from '../../src/types/knowledge';
import { requireTrustedSender } from './security.js';

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
