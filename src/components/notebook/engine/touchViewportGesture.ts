// ============================================
// Panvas — Two-finger viewport gestures
// ============================================
// The notebook and PDF surfaces deliberately use `touch-action: none` so a
// finger does not hand an in-progress drawing or selection gesture to the
// browser. This shared controller restores the expected two-finger viewport
// contract inside those surfaces without changing their data models.

export interface ViewportTouchPoint {
  x: number;
  y: number;
}

interface GestureAnchor {
  distance: number;
  scale: number;
  documentX: number;
  documentY: number;
}

export interface TwoFingerViewportResult {
  scale: number;
  scrollLeft: number;
  scrollTop: number;
}

export interface TwoFingerViewportGestureOptions {
  target: HTMLElement;
  getScale: () => number;
  setScale: (scale: number) => void;
  /** Stops a just-started single-finger draw/select gesture when a second finger lands. */
  cancelActivePointerInteraction: () => void;
  minScale?: number;
  maxScale?: number;
  /** Unscaled layout offsets (centering/padding) must not scale with content. */
  getContentOffset?: (scale: number) => ViewportTouchPoint;
}

function midpoint(first: ViewportTouchPoint, second: ViewportTouchPoint): ViewportTouchPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function distance(first: ViewportTouchPoint, second: ViewportTouchPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Keep the document point beneath the two-finger midpoint stable as it zooms. */
export function resolveTwoFingerViewport({
  anchor,
  currentDistance,
  currentCenter,
  bounds,
  minScale = 0.25,
  maxScale = 4,
  contentOffset = { x: 0, y: 0 },
}: {
  anchor: GestureAnchor;
  currentDistance: number;
  currentCenter: ViewportTouchPoint;
  bounds: Pick<DOMRect, 'left' | 'top'>;
  minScale?: number;
  maxScale?: number;
  contentOffset?: ViewportTouchPoint;
}): TwoFingerViewportResult {
  const ratio = anchor.distance > 0 ? currentDistance / anchor.distance : 1;
  const scale = clamp(anchor.scale * ratio, minScale, maxScale);
  return {
    scale,
    scrollLeft: anchor.documentX * scale + contentOffset.x - (currentCenter.x - bounds.left),
    scrollTop: anchor.documentY * scale + contentOffset.y - (currentCenter.y - bounds.top),
  };
}

/**
 * Attach two-finger pan/pinch to a scroll viewport. Capture-phase listeners
 * run before the page canvas input manager, letting a second finger promote an
 * in-progress one-finger edit into a pure viewport gesture.
 */
export function attachTwoFingerViewportGesture({
  target,
  getScale,
  setScale,
  cancelActivePointerInteraction,
  minScale = 0.25,
  maxScale = 4,
  getContentOffset = () => ({ x: 0, y: 0 }),
}: TwoFingerViewportGestureOptions): () => void {
  const pointers = new Map<number, ViewportTouchPoint>();
  let anchor: GestureAnchor | null = null;
  let pendingPosition: Pick<TwoFingerViewportResult, 'scrollLeft' | 'scrollTop'> | null = null;
  let frame: number | null = null;
  let suppressUntilAllLifted = false;

  const twoPointers = (): [ViewportTouchPoint, ViewportTouchPoint] | null => {
    const points = [...pointers.values()];
    return points.length >= 2 ? [points[0], points[1]] : null;
  };

  const applyPendingPosition = () => {
    frame = null;
    if (!pendingPosition) return;
    target.scrollLeft = pendingPosition.scrollLeft;
    target.scrollTop = pendingPosition.scrollTop;
  };

  const schedulePosition = (next: Pick<TwoFingerViewportResult, 'scrollLeft' | 'scrollTop'>) => {
    pendingPosition = next;
    target.scrollLeft = next.scrollLeft;
    target.scrollTop = next.scrollTop;
    if (frame === null && typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(applyPendingPosition);
    }
  };

  const begin = () => {
    const pair = twoPointers();
    if (!pair) return;
    const bounds = target.getBoundingClientRect();
    const center = midpoint(pair[0], pair[1]);
    const scale = getScale();
    const offset = getContentOffset(scale);
    anchor = {
      distance: Math.max(1, distance(pair[0], pair[1])),
      scale,
      documentX: (target.scrollLeft + center.x - bounds.left - offset.x) / scale,
      documentY: (target.scrollTop + center.y - bounds.top - offset.y) / scale,
    };
    cancelActivePointerInteraction();
    suppressUntilAllLifted = true;
    for (const id of pointers.keys()) {
      try { target.setPointerCapture(id); } catch { /* Synthetic events have no native capture. */ }
    }
  };

  const update = () => {
    const pair = twoPointers();
    if (!anchor || !pair) return;
    const next = resolveTwoFingerViewport({
      anchor,
      currentDistance: distance(pair[0], pair[1]),
      currentCenter: midpoint(pair[0], pair[1]),
      bounds: target.getBoundingClientRect(),
      minScale,
      maxScale,
      contentOffset: getContentOffset(clamp(anchor.scale * distance(pair[0], pair[1]) / anchor.distance, minScale, maxScale)),
    });
    setScale(next.scale);
    schedulePosition(next);
  };

  const record = (event: PointerEvent) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const isTouch = (event: PointerEvent) => event.pointerType === 'touch';

  const onPointerDown = (event: PointerEvent) => {
    if (!isTouch(event)) return;
    record(event);
    if (pointers.size < 2) return;
    event.preventDefault();
    event.stopPropagation();
    if (!anchor) begin();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isTouch(event) || !pointers.has(event.pointerId)) return;
    record(event);
    if (!anchor && !suppressUntilAllLifted) return;
    event.preventDefault();
    event.stopPropagation();
    update();
  };

  const finishPointer = (event: PointerEvent) => {
    if (!isTouch(event) || !pointers.has(event.pointerId)) return;
    const wasGesture = suppressUntilAllLifted;
    pointers.delete(event.pointerId);
    if (wasGesture) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (pointers.size < 2) anchor = null;
    if (pointers.size === 0) suppressUntilAllLifted = false;
  };

  target.addEventListener('pointerdown', onPointerDown, { capture: true });
  target.addEventListener('pointermove', onPointerMove, { capture: true });
  target.addEventListener('pointerup', finishPointer, { capture: true });
  target.addEventListener('pointercancel', finishPointer, { capture: true });

  return () => {
    target.removeEventListener('pointerdown', onPointerDown, { capture: true });
    target.removeEventListener('pointermove', onPointerMove, { capture: true });
    target.removeEventListener('pointerup', finishPointer, { capture: true });
    target.removeEventListener('pointercancel', finishPointer, { capture: true });
    if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  };
}
