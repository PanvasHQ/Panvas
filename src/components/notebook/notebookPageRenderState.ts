import type { DrawingData } from './engine/drawingTypes';

export type NotebookPageDataCache = Readonly<Record<string, DrawingData>>;
export type PagePropertyChangeSource = 'load' | 'user';

export interface PageOwnedDrawing {
  documentId: string;
  sheetId: string;
  renderedSheetId: string;
  sceneOwnerSheetId: string;
  saveTargetSheetId: string;
  drawingRevision: number;
  data: DrawingData;
}

/** Capture one immutable sheet-owned payload before any persistence step. */
export function capturePageOwnedDrawing(
  documentId: string,
  sheetId: string,
  sceneOwnerSheetId: string,
  drawingRevision: number,
  data: DrawingData,
  renderedSheetId = sheetId,
): PageOwnedDrawing | null {
  if (!documentId || !sheetId || sheetId !== sceneOwnerSheetId || sheetId !== renderedSheetId) return null;
  return {
    documentId,
    sheetId,
    renderedSheetId,
    sceneOwnerSheetId,
    saveTargetSheetId: sheetId,
    drawingRevision,
    data: structuredClone(data),
  };
}

export function hasValidPageDrawingOwnership(snapshot: PageOwnedDrawing): boolean {
  return snapshot.sheetId === snapshot.renderedSheetId
    && snapshot.sheetId === snapshot.sceneOwnerSheetId
    && snapshot.sheetId === snapshot.saveTargetSheetId;
}

/** Loading a page updates rendering, but must never be mistaken for an edit. */
export function mayPersistPagePropertyChange(source: PagePropertyChangeSource): boolean {
  return source === 'user';
}

/**
 * Repository reads are snapshots. They may fill a cache gap, but must never
 * replace data captured from the live engine while the read was in flight.
 */
export function mergeLoadedPageData(
  current: NotebookPageDataCache,
  loaded: NotebookPageDataCache,
): Record<string, DrawingData> {
  return { ...loaded, ...current };
}

/** Resolve one stable page identity to its active or inactive render data. */
export function resolveNotebookPageRenderData(
  pageId: string,
  focusedPageId: string,
  cache: NotebookPageDataCache,
  focusedData?: DrawingData,
  sceneOwnerPageId = focusedPageId,
): DrawingData | undefined {
  return pageId === focusedPageId && pageId === sceneOwnerPageId && focusedData
    ? focusedData
    : cache[pageId];
}

/** A completed focused-page read may only mutate the engine it was requested for. */
export function mayApplyPageLoadToEngine(
  requestedPageId: string,
  currentFocusedPageId: string,
  requestGeneration: number,
  latestGeneration: number,
): boolean {
  return requestedPageId === currentFocusedPageId && requestGeneration === latestGeneration;
}
