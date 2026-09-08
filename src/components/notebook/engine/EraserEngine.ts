import type { Stroke, Shape, EraserMode } from './drawingTypes.ts';
import type { DrawingEngine } from './DrawingEngine.ts';
import type { HistoryManager } from './HistoryManager.ts';
import type { ShapeManager } from './ShapeManager.ts';
import type { RulerManager } from './RulerManager.ts';
import { cutStroke, eraserCapsule, exposedEraser, regionIntersects, strokeRegion, type InkPoint } from './inkRegion.ts';

export class EraserEngine {
  private shapeManager?: ShapeManager;
  private rulerManager?: RulerManager;
  private changes = new Map<string, { before: Stroke; after: Stroke | null }>();
  private erasedShapes: Shape[] = [];
  private strokeOrder: string[] = [];
  private historyChangeCallback: (() => void) | null = null;

  private drawingEngine: DrawingEngine;
  private historyManager: HistoryManager;
  constructor(drawingEngine: DrawingEngine, historyManager: HistoryManager) {
    this.drawingEngine = drawingEngine;
    this.historyManager = historyManager;
  }

  setShapeManager(manager: ShapeManager): void { this.shapeManager = manager; }
  setRulerManager(manager: RulerManager): void { this.rulerManager = manager; }
  setHistoryChangeCallback(callback: () => void): void { this.historyChangeCallback = callback; }

  startErasing(mode: EraserMode): void {
    this.changes.clear();
    this.erasedShapes = [];
    this.strokeOrder = this.drawingEngine.getStrokes().map(stroke => stroke.id);
    if (mode === 'all') {
      const body = this.rulerManager?.getBodyPolygon() ?? [];
      for (const stroke of [...this.drawingEngine.getStrokes()]) {
        this.applyCut(stroke, cutStroke(stroke, exposedEraser(strokeRegion(stroke), body)));
      }
      if (!body.length && this.shapeManager) this.erasedShapes = this.shapeManager.clearShapes();
      this.drawingEngine.redraw();
    }
  }

  private applyCut(stroke: Stroke, next: Stroke | null | undefined): boolean {
    if (next === undefined) return false;
    const previous = this.changes.get(stroke.id);
    this.changes.set(stroke.id, { before: previous?.before ?? structuredClone(stroke), after: next });
    const strokes = this.drawingEngine.getStrokes();
    const index = strokes.findIndex(candidate => candidate.id === stroke.id);
    // Keep object order: translucent overlaps must not change after an erase.
    if (index >= 0) strokes.splice(index, 1, ...(next ? [next] : []));
    return true;
  }

  eraseAt(x: number, y: number, mode: EraserMode, radius = 12, redraw = true): boolean {
    return this.eraseSweep({ x, y }, { x, y }, mode, radius, redraw);
  }

  /** Continuous capsule minus the full ruler polygon. Original pressure paths stay
   * intact; saved vector contours cut their coverage without generating new caps. */
  eraseSweep(start: InkPoint, end: InkPoint, mode: EraserMode, radius = 12, redraw = true): boolean {
    if (mode === 'all') return false;
    const body = this.rulerManager?.getBodyPolygon() ?? [];
    const sweep = eraserCapsule(start, end, Math.max(0.01, radius));
    const exposed = exposedEraser(sweep, body);
    if (!exposed.length) return false;
    // Sampling discovers candidates only. Subtraction uses the entire capsule.
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / Math.max(2, radius / 2)));
    const hits = new Set<string>();
    const shapeHits = new Set<string>();
    for (let i = 0; i <= steps; i++) {
      const x = start.x + (end.x - start.x) * i / steps;
      const y = start.y + (end.y - start.y) * i / steps;
      this.drawingEngine.findStrokesNearPoint(x, y, radius).forEach(id => hits.add(id));
      if (mode !== 'highlighter') this.shapeManager?.findShapesNearPoint(x, y, radius).forEach(id => shapeHits.add(id));
    }
    let changed = false;
    for (const stroke of [...this.drawingEngine.getStrokes()]) {
      if (!hits.has(stroke.id) || (mode === 'highlighter' && stroke.tool !== 'highlighter')) continue;
      if (!regionIntersects(strokeRegion(stroke), exposed)) continue;
      // Whole-stroke modes must also retain ink protected by the ruler.
      const erase = mode === 'pixel' ? exposed : exposedEraser(strokeRegion(stroke), body);
      changed = this.applyCut(stroke, cutStroke(stroke, erase)) || changed;
    }
    for (const id of shapeHits) {
      const shape = this.shapeManager?.getShapes().find(candidate => candidate.id === id);
      if (!shape) continue;
      // Shapes have object-level erasure. Do not delete an intersecting shape
      // through the ruler; partial shape geometry is outside the stroke model.
      const diagonal = Math.hypot(shape.width, shape.height) / 2 + shape.strokeWidth;
      const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
      if (body.length && regionIntersects(eraserCapsule(center, center, Math.max(1, diagonal)), body)) continue;
      const removed = this.shapeManager?.removeShape(id);
      if (removed) { this.erasedShapes.push(removed); changed = true; }
    }
    if (changed && redraw) this.drawingEngine.redraw();
    return changed;
  }

  finishErasing(): boolean {
    if (!this.changes.size && !this.erasedShapes.length) return false;
    const changes = structuredClone([...this.changes]);
    const shapes = structuredClone(this.erasedShapes);
    const order = new Map(this.strokeOrder.map((id, index) => [id, index]));
    const apply = (redo: boolean) => {
      const strokes = this.drawingEngine.getStrokes();
      for (const [id, change] of changes) {
        const index = strokes.findIndex(stroke => stroke.id === id);
        if (index >= 0) strokes.splice(index, 1);
        const value = redo ? change.after : change.before;
        if (value) strokes.push(structuredClone(value));
      }
      strokes.sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
      if (redo) this.shapeManager?.removeShapes(new Set(shapes.map(shape => shape.id)));
      else shapes.forEach(shape => this.shapeManager?.addShape(structuredClone(shape)));
      this.drawingEngine.redraw();
      this.historyChangeCallback?.();
    };
    this.historyManager.pushExecuted({ description: 'Erase', execute: () => apply(true), undo: () => apply(false) });
    this.changes.clear();
    this.erasedShapes = [];
    return true;
  }

  /** Remove a known set of strokes as one undoable gesture command. */
  eraseStrokeIds(ids: Set<string>, description = 'Scribble erase'): boolean {
    if (ids.size === 0) return false;
    const erasedStrokes = this.drawingEngine.removeStrokes(ids);
    if (erasedStrokes.length === 0) return false;
    const erasedIds = new Set(erasedStrokes.map(stroke => stroke.id));
    this.drawingEngine.redraw();
    this.historyManager.pushExecuted({
      description,
      execute: () => { this.drawingEngine.removeStrokes(erasedIds); this.drawingEngine.redraw(); this.historyChangeCallback?.(); },
      undo: () => { erasedStrokes.forEach(stroke => this.drawingEngine.addStroke(stroke)); this.drawingEngine.redraw(); this.historyChangeCallback?.(); },
    });
    return true;
  }
}
