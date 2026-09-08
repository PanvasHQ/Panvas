export type PageSearchPayloadKind = 'content' | 'drawing';

export { pdfAnnotationStorageId } from '../../lib/pdfAnnotationStorage.ts';

/** Additional identity for drawing payloads that belong to a source PDF page.
 *
 * PDF annotations are stored in the existing notebook drawing store using a
 * stable owner-page/source-page pair. Carrying that pair explicitly with the
 * save event keeps index updates unambiguous without parsing storage keys.
 */
export interface PageSearchSaveContext {
  pdfOwnerPageId?: string;
  pdfSourcePage?: number;
}

export interface PageSearchSaveEvent {
  workspaceId: string;
  notebookId: string;
  pageId: string;
  kind: PageSearchPayloadKind;
  data: unknown;
  pdfOwnerPageId?: string;
  pdfSourcePage?: number;
}

type PageSearchSaveListener = (event: PageSearchSaveEvent) => void;

const listeners = new Set<PageSearchSaveListener>();

export function subscribeToPageSearchSaves(listener: PageSearchSaveListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Queue index maintenance after persistence so saves never wait on search work. */
export function queuePageSearchSave(event: PageSearchSaveEvent): void {
  const notify = () => listeners.forEach(listener => listener(event));
  if (typeof queueMicrotask === 'function') queueMicrotask(notify);
  else void Promise.resolve().then(notify);
}

/** Canonical in-memory key for PDF annotation payloads. */
export function pdfAnnotationScopeKey(
  workspaceId: string,
  notebookId: string,
  ownerPageId: string,
  sourcePage: number,
): string {
  return `${workspaceId}\u0000${notebookId}\u0000${ownerPageId}\u0000${sourcePage}`;
}
