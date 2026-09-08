import type { HistoryCommand, SelectedElement, Stroke, TextObject } from '../../components/notebook/engine/drawingTypes.ts';

export interface HandwritingConversionState {
  getStrokes(): Stroke[];
  setStrokes(strokes: Stroke[]): void;
  addText(text: TextObject): void;
  removeText(id: string): void;
  setSelection(elements: SelectedElement[]): void;
  redraw(): void;
}

export interface HandwritingConversionOptions {
  updateSelection?: boolean;
  sourceSelection?: SelectedElement[];
  replacementSelection?: SelectedElement[];
}

export interface HandwritingContinuationState {
  getStrokes(): Stroke[];
  setStrokes(strokes: Stroke[]): void;
  replaceText(text: TextObject): boolean;
  redraw(): void;
}

/**
 * Produces the one command that performs a confirmed conversion. Its closure
 * stores a full vector snapshot, so cancellation and recognition failures can
 * never affect ink and undo exactly restores the source stroke order.
 */
export function createHandwritingConversionCommand(
  state: HandwritingConversionState,
  strokesToConvert: Stroke[],
  replacementText: TextObject | readonly TextObject[],
  options: HandwritingConversionOptions = {},
): HistoryCommand {
  const strokeIds = new Set(strokesToConvert.map(stroke => stroke.id));
  const originalStrokeOrder = structuredClone(state.getStrokes());
  const sourceStrokes = new Map(strokesToConvert.map(stroke => [stroke.id, structuredClone(stroke)]));
  const originalIds = new Set(originalStrokeOrder.map(stroke => stroke.id));
  const convertedTexts = structuredClone(Array.isArray(replacementText) ? replacementText : [replacementText]);
  const sourceSelection: SelectedElement[] = structuredClone(
    options.sourceSelection ?? strokesToConvert.map(stroke => ({ type: 'stroke', id: stroke.id })),
  );
  const replacementSelection: SelectedElement[] = structuredClone(
    options.replacementSelection ?? convertedTexts.map(text => ({ type: 'text', id: text.id })),
  );
  const updateSelection = options.updateSelection !== false;

  return {
    description: 'Convert handwriting to text',
    execute: () => {
      state.setStrokes(state.getStrokes().filter(stroke => !strokeIds.has(stroke.id)));
      convertedTexts.forEach(text => state.removeText(text.id));
      convertedTexts.forEach(text => state.addText(structuredClone(text)));
      if (updateSelection) state.setSelection(structuredClone(replacementSelection));
      state.redraw();
    },
    undo: () => {
      convertedTexts.forEach(text => state.removeText(text.id));
      const currentStrokes = state.getStrokes().filter(stroke => !strokeIds.has(stroke.id));
      const currentById = new Map(currentStrokes.map(stroke => [stroke.id, stroke]));
      const restoredOriginalOrder = originalStrokeOrder.flatMap(original => {
        const source = sourceStrokes.get(original.id);
        if (source) return [structuredClone(source)];
        const current = currentById.get(original.id);
        return current ? [structuredClone(current)] : [];
      });
      const laterStrokes = currentStrokes
        .filter(stroke => !originalIds.has(stroke.id))
        .map(stroke => structuredClone(stroke));
      state.setStrokes([...restoredOriginalOrder, ...laterStrokes]);
      if (updateSelection) state.setSelection(structuredClone(sourceSelection));
      state.redraw();
    },
  };
}

/** Atomically replaces a generated line while consuming only the new source ink. */
export function createHandwritingContinuationCommand(
  state: HandwritingContinuationState,
  strokesToConvert: readonly Stroke[],
  previousText: TextObject,
  nextText: TextObject,
): HistoryCommand {
  const strokeIds = new Set(strokesToConvert.map(stroke => stroke.id));
  const originalStrokeOrder = structuredClone(state.getStrokes());
  const sourceStrokes = new Map(strokesToConvert.map(stroke => [stroke.id, structuredClone(stroke)]));
  const originalIds = new Set(originalStrokeOrder.map(stroke => stroke.id));
  const before = structuredClone(previousText);
  const after = structuredClone(nextText);

  return {
    description: 'Continue handwriting text line',
    execute: () => {
      if (!state.replaceText(structuredClone(after))) return;
      state.setStrokes(state.getStrokes().filter(stroke => !strokeIds.has(stroke.id)));
      state.redraw();
    },
    undo: () => {
      state.replaceText(structuredClone(before));
      const currentStrokes = state.getStrokes().filter(stroke => !strokeIds.has(stroke.id));
      const currentById = new Map(currentStrokes.map(stroke => [stroke.id, stroke]));
      const restoredOriginalOrder = originalStrokeOrder.flatMap(original => {
        const source = sourceStrokes.get(original.id);
        if (source) return [structuredClone(source)];
        const current = currentById.get(original.id);
        return current ? [structuredClone(current)] : [];
      });
      const laterStrokes = currentStrokes
        .filter(stroke => !originalIds.has(stroke.id))
        .map(stroke => structuredClone(stroke));
      state.setStrokes([...restoredOriginalOrder, ...laterStrokes]);
      state.redraw();
    },
  };
}
