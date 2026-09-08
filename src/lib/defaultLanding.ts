export interface DefaultLandingInput {
  initialDocumentRestoreComplete: boolean;
  isLoading: boolean;
  activePageId: string | null;
  activeCanvasId: string | null;
}

/**
 * Decides whether the `/app` document route should fall through to the
 * Library. Panvas is a serious workspace: a valid last document is restored
 * on boot, and `/app` without one belongs in the Library rather than a
 * dashboard.
 *
 * The fallthrough is only legal once the startup restore pass has settled.
 * While hydration or restore is in flight the persisted active page/canvas
 * ids are legitimately null, and redirecting then would race the restore and
 * flicker the route.
 */
export function shouldFallBackToLibrary(input: DefaultLandingInput): boolean {
  if (!input.initialDocumentRestoreComplete) return false;
  if (input.isLoading) return false;
  return !input.activePageId && !input.activeCanvasId;
}
