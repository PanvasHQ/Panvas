import type { ImageObject, Shape, Stroke, StrokePoint, TextObject } from './drawingTypes.ts';

export type MixedPlacementObject = Stroke | Shape | TextObject | ImageObject;
export type PositionSnapshot = StrokePoint[] | { x: number; y: number };
export type ZOrderAction = 'front' | 'back' | 'forward' | 'backward';

/** Applies one shared page-space delta to an object from its drag-start data. */
export function applyGroupedTranslation(
  object: MixedPlacementObject,
  original: PositionSnapshot,
  dx: number,
  dy: number,
): void {
  if (object.type === 'stroke') {
    if (!Array.isArray(original)) return;
    object.points.forEach((point, index) => {
      const source = original[index];
      if (!source) return;
      point.x = source.x + dx;
      point.y = source.y + dy;
    });
    return;
  }

  if (Array.isArray(original)) return;
  object.x = original.x + dx;
  object.y = original.y + dy;
}

/**
 * Reorders only selected peers inside their own layer. Objects on other
 * layers keep both their order and their positions in the manager queue.
 */
export function reorderQueueWithinLayers<T extends { id: string; layerId?: string }>(
  items: readonly T[],
  selectedIds: ReadonlySet<string>,
  action: ZOrderAction,
): T[] {
  const next = [...items];
  const selectedLayerIds = new Set(
    items.filter(item => selectedIds.has(item.id)).map(item => item.layerId ?? ''),
  );

  for (const layerId of selectedLayerIds) {
    const indices = next.reduce<number[]>((result, item, index) => {
      if ((item.layerId ?? '') === layerId) result.push(index);
      return result;
    }, []);
    const layerItems = indices.map(index => next[index]);
    const isSelected = (item: T) => selectedIds.has(item.id);
    let reordered = [...layerItems];

    if (action === 'front') {
      reordered = [...layerItems.filter(item => !isSelected(item)), ...layerItems.filter(isSelected)];
    } else if (action === 'back') {
      reordered = [...layerItems.filter(isSelected), ...layerItems.filter(item => !isSelected(item))];
    } else if (action === 'forward') {
      for (let index = reordered.length - 2; index >= 0; index -= 1) {
        if (isSelected(reordered[index]) && !isSelected(reordered[index + 1])) {
          [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        }
      }
    } else {
      for (let index = 1; index < reordered.length; index += 1) {
        if (isSelected(reordered[index]) && !isSelected(reordered[index - 1])) {
          [reordered[index], reordered[index - 1]] = [reordered[index - 1], reordered[index]];
        }
      }
    }

    indices.forEach((index, itemIndex) => {
      next[index] = reordered[itemIndex];
    });
  }

  return next;
}
