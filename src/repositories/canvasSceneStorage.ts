/**
 * Pure decision helpers for Electron canonical canvas scene storage.
 * Kept dependency-free (no Dexie, no Electron) so the arbitration and payload
 * assembly can be unit-tested directly.
 */
import type { CanvasData, CustomBlock } from '../types/canvas';

/** A loadable canonical scene must at least identify itself and carry elements. */
export function isValidCanvasScenePayload(value: unknown): value is CanvasData {
  return Boolean(
    value && typeof value === 'object'
    && typeof (value as CanvasData).canvasFileId === 'string'
    && Array.isArray((value as CanvasData).elements),
  );
}

export interface CanonicalSceneDecision {
  /** The scene that must be served to the user and treated as canonical. */
  scene: CanvasData | null;
  /**
   * True when the legacy IndexedDB scene won and must be written forward to
   * the filesystem exactly once (including adopting a legacy-only scene into
   * a missing canonical file). The reverse overwrite never happens.
   */
  writeForwardLegacy: boolean;
}

/**
 * Newest-wins arbitration between the canonical filesystem scene and a legacy
 * IndexedDB scene. Ties and unknown timestamps go to the filesystem.
 */
export function selectCanonicalCanvasScene(
  fileScene: CanvasData | null,
  legacyScene: CanvasData | null,
): CanonicalSceneDecision {
  if (!isValidCanvasScenePayload(fileScene)) {
    return { scene: legacyScene, writeForwardLegacy: Boolean(legacyScene) };
  }
  if (!isValidCanvasScenePayload(legacyScene)) {
    return { scene: fileScene, writeForwardLegacy: false };
  }
  const legacyNewer = (legacyScene.updatedAt ?? 0) > (fileScene.updatedAt ?? 0);
  return legacyNewer
    ? { scene: legacyScene, writeForwardLegacy: true }
    : { scene: fileScene, writeForwardLegacy: false };
}

/**
 * Assembles the complete canonical payload for a save: partial scene input is
 * merged over the previous canonical scene so a partial autosave can never
 * drop fields, and the renderer's custom blocks are embedded so the single
 * file fully reconstructs the canvas (scene + markdown/latex/pdf/audio
 * blocks).
 */
export function buildCanonicalCanvasPayload(
  data: Partial<CanvasData> & { canvasFileId: string },
  previous: CanvasData | null,
  customBlocks: readonly CustomBlock[],
  userId: string | null,
  now: number,
): CanvasData {
  return {
    canvasFileId: data.canvasFileId,
    elements: data.elements ?? previous?.elements ?? [],
    appState: data.appState ?? previous?.appState ?? {},
    files: data.files ?? previous?.files ?? {},
    customBlocks: [...customBlocks],
    version: (previous?.version ?? 0) + 1,
    updatedAt: now,
    userId,
  };
}
