export type ImageToolbarPlacement = 'below' | 'above' | 'side';

export interface ImageToolbarPlacementInput {
  boundTop: number;
  boundBottom: number;
  centerX: number;
  controlWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  minTop?: number;
  toolbarHeight?: number;
  gap?: number;
  current?: ImageToolbarPlacement | null;
}

const HYSTERESIS = 24;

/**
 * Keep contextual image controls on one side while an image is transformed.
 * A placement changes only after it is genuinely inaccessible, with a small
 * hysteresis band preventing AABB rounding from making the toolbar jump.
 */
export function resolveImageToolbarPlacement({
  boundTop,
  boundBottom,
  centerX,
  controlWidth,
  viewportWidth,
  viewportHeight,
  minTop = 76,
  toolbarHeight = 40,
  gap = 10,
  current = null,
}: ImageToolbarPlacementInput): ImageToolbarPlacement {
  const belowTop = boundBottom + gap;
  const aboveBottom = boundTop - gap;
  const belowFits = belowTop + toolbarHeight <= viewportHeight - 8;
  const aboveFits = aboveBottom - toolbarHeight >= minTop;
  const sideFits = centerX + 24 + controlWidth <= viewportWidth - 8
    || centerX - controlWidth - 24 >= 8;

  if (current === 'below' && belowTop <= viewportHeight + HYSTERESIS) return 'below';
  if (current === 'above' && aboveBottom >= minTop - HYSTERESIS) return 'above';
  if (current === 'side' && sideFits) return 'side';

  if (belowFits) return 'below';
  if (aboveFits) return 'above';
  return 'side';
}
