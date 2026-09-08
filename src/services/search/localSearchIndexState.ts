import type { LocalSearchDocument } from './LocalSearchIndex.ts';
import { extractPageSearchContent, normalizeSearchText } from './pageSearchContent.ts';
import { pdfAnnotationScopeKey, type PageSearchSaveEvent } from './searchIndexEvents.ts';

export interface CachedSearchPagePayload {
  content?: unknown;
  drawing?: unknown;
}

export interface SearchIndexMutationState {
  documents: LocalSearchDocument[];
  pagePayloads: Map<string, CachedSearchPagePayload>;
  pdfAnnotationPayloads: Map<string, unknown>;
}

/** A populated index can be reused only for the exact source-record scope. */
export function isSearchIndexValid(
  documents: readonly unknown[],
  indexedScopeKey: string | null,
  requestedScopeKey: string,
): boolean {
  return documents.length > 0 && indexedScopeKey === requestedScopeKey;
}

/** Applies one persisted page save without rebuilding unrelated index entries. */
export function applyPageSearchSave(state: SearchIndexMutationState, event: PageSearchSaveEvent): void {
  if (event.pdfOwnerPageId && Number.isInteger(event.pdfSourcePage)) {
    if (event.kind !== 'drawing') return;
    const sourcePage = event.pdfSourcePage as number;
    const annotationKey = pdfAnnotationScopeKey(event.workspaceId, event.notebookId, event.pdfOwnerPageId, sourcePage);
    state.pdfAnnotationPayloads.set(annotationKey, event.data);
    const annotation = extractPageSearchContent(undefined, event.data);
    state.documents = state.documents.map(document => {
      if (
        document.kind !== 'pdf'
        || document.workspaceId !== event.workspaceId
        || document.notebookId !== event.notebookId
        || document.pageId !== event.pdfOwnerPageId
        || document.pdfPageNumber !== sourcePage
      ) return document;
      const richText = normalizeSearchText(`${document.pdfEmbeddedText ?? ''} ${annotation.richText}`);
      const content = normalizeSearchText(`${annotation.handwritingText} ${richText}`);
      return {
        ...document,
        content,
        handwritingText: annotation.handwritingText,
        richText,
        snippet: content.slice(0, 220),
        updatedAt: Date.now(),
      };
    });
    return;
  }

  const payloads = state.pagePayloads.get(event.pageId) ?? {};
  payloads[event.kind] = event.data;
  state.pagePayloads.set(event.pageId, payloads);

  state.documents = state.documents.map(document => {
    if (document.kind !== 'page' || document.pageId !== event.pageId || document.workspaceId !== event.workspaceId) return document;
    const extracted = extractPageSearchContent(
      event.kind === 'content' ? event.data : payloads.content,
      event.kind === 'drawing' ? event.data : payloads.drawing,
    );
    return {
      ...document,
      ...extracted,
      updatedAt: Date.now(),
    };
  });
}
