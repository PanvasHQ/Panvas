import type { Stroke, Shape, EraserMode, StrokePoint } from './drawingTypes';
import type { DrawingEngine } from './DrawingEngine';
import type { HistoryManager } from './HistoryManager';
import type { ShapeManager } from './ShapeManager';

// Use a simple ID generator for split strokes
const generateId = (prefix = 'strk') => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

export class EraserEngine {
  private drawingEngine: DrawingEngine;
  private historyManager: HistoryManager;
  private shapeManager?: ShapeManager;

  // State for the current erasing session
  private erasedStrokes: Stroke[] = [];
  private erasedShapes: Shape[] = [];
  private spawnedStrokes: Stroke[] = [];
  private processedIds: Set<string> = new Set();
  
  constructor(drawingEngine: DrawingEngine, historyManager: HistoryManager) {
    this.drawingEngine = drawingEngine;
    this.historyManager = historyManager;
  }
  
  setShapeManager(shapeManager: ShapeManager) {
    this.shapeManager = shapeManager;
  }

  /** Begin an erasing session (pointer down). */
  startErasing(mode: EraserMode): void {
    this.erasedStrokes = [];
    this.erasedShapes = [];
    this.spawnedStrokes = [];
    this.processedIds = new Set();

    if (mode === 'all') {
      const removedStrokes = this.drawingEngine.clearStrokes();
      this.erasedStrokes.push(...removedStrokes);
      
      if (this.shapeManager) {
        const removedShapes = this.shapeManager.clearShapes();
        this.erasedShapes.push(...removedShapes);
      }
      
      this.drawingEngine.redraw();
    }
  }

  /** Erase at a specific point (pointer move/down). */
  eraseAt(x: number, y: number, mode: EraserMode, radius: number = 12): void {
    if (mode === 'all') return;

    if (mode === 'stroke') {
      const hits = this.drawingEngine.findStrokesNearPoint(x, y, radius);
      for (const id of hits) {
        if (!this.processedIds.has(id)) {
          this.processedIds.add(id);
          const stroke = this.drawingEngine.removeStroke(id);
          if (stroke) {
            this.erasedStrokes.push(stroke);
            this.drawingEngine.redraw();
          }
        }
      }

      if (this.shapeManager) {
        const shapeHits = this.shapeManager.findShapesNearPoint(x, y, radius);
        for (const id of shapeHits) {
          if (!this.processedIds.has(id)) {
            this.processedIds.add(id);
            const shape = this.shapeManager.removeShape(id);
            if (shape) {
              this.erasedShapes.push(shape);
              this.drawingEngine.redraw();
            }
          }
        }
      }
    } else if (mode === 'pixel') {
      const actualRadius = radius / 2;
      
      // Vector stroke splitting
      const hits = this.drawingEngine.findStrokesNearPoint(x, y, actualRadius);
      let didModify = false;

      for (const id of hits) {
        if (!this.processedIds.has(id)) {
          const stroke = this.drawingEngine.getStrokes().find(s => s.id === id);
          if (stroke) {
            this.processedIds.add(id);
            const removed = this.drawingEngine.removeStroke(id);
            if (removed) {
              this.erasedStrokes.push(removed);

              // Split stroke into segments based on distance from eraser
              const segments: Stroke[] = [];
              let currentSegment: StrokePoint[] = [];

              for (const p of stroke.points) {
                const dist = Math.hypot(p.x - x, p.y - y);
                if (dist <= actualRadius) {
                  // Point inside eraser radius, terminate current segment
                  if (currentSegment.length > 0) {
                    segments.push({ ...stroke, id: generateId(), points: currentSegment });
                    currentSegment = [];
                  }
                } else {
                  currentSegment.push(p);
                }
              }

              if (currentSegment.length > 0) {
                segments.push({ ...stroke, id: generateId(), points: currentSegment });
              }

              for (const seg of segments) {
                this.drawingEngine.addStroke(seg);
                this.spawnedStrokes.push(seg);
              }
              
              didModify = true;
            }
          }
        }
      }

      // Allow erasing the newly spawned strokes in the same session
      // if they are hit again, they can be split further!
      const spawnedHits = this.drawingEngine.findStrokesNearPoint(x, y, actualRadius);
      for (const id of spawnedHits) {
        if (this.spawnedStrokes.some(s => s.id === id) && !this.processedIds.has(id)) {
          const stroke = this.drawingEngine.getStrokes().find(s => s.id === id);
          if (stroke) {
            this.processedIds.add(id);
            const removed = this.drawingEngine.removeStroke(id);
            if (removed) {
              // Note: since this was a spawned stroke in THIS session, we don't add it to erasedStrokes.
              // We just remove it from spawnedStrokes because it shouldn't exist after this session finishes.
              this.spawnedStrokes = this.spawnedStrokes.filter(s => s.id !== id);

              const segments: Stroke[] = [];
              let currentSegment: StrokePoint[] = [];
              for (const p of stroke.points) {
                const dist = Math.hypot(p.x - x, p.y - y);
                if (dist <= actualRadius) {
                  if (currentSegment.length > 0) {
                    segments.push({ ...stroke, id: generateId(), points: currentSegment });
                    currentSegment = [];
                  }
                } else {
                  currentSegment.push(p);
                }
              }
              if (currentSegment.length > 0) {
                segments.push({ ...stroke, id: generateId(), points: currentSegment });
              }

              for (const seg of segments) {
                this.drawingEngine.addStroke(seg);
                this.spawnedStrokes.push(seg);
              }
              didModify = true;
            }
          }
        }
      }

      // Also erase shapes for pixel mode (treat as stroke erasure for shapes since they are objects)
      if (this.shapeManager) {
        const shapeHits = this.shapeManager.findShapesNearPoint(x, y, actualRadius);
        for (const id of shapeHits) {
          if (!this.processedIds.has(id)) {
            this.processedIds.add(id);
            const shape = this.shapeManager.removeShape(id);
            if (shape) {
              this.erasedShapes.push(shape);
              didModify = true;
            }
          }
        }
      }

      if (didModify) {
        this.drawingEngine.redraw();
      }
    }
  }

  /** Finish an erasing session (pointer up) and push to history. */
  finishErasing(): boolean {
    if (this.erasedStrokes.length === 0 && this.erasedShapes.length === 0) return false;

    const originalStrokesToRemove = [...this.erasedStrokes];
    const originalShapesToRemove = [...this.erasedShapes];
    const newStrokesToAdd = [...this.spawnedStrokes];
    
    this.historyManager.pushExecuted({
      description: 'Erase',
      execute: () => {
        const strokeIdsToRemove = new Set(originalStrokesToRemove.map(s => s.id));
        this.drawingEngine.removeStrokes(strokeIdsToRemove);
        
        if (this.shapeManager) {
          const shapeIdsToRemove = new Set(originalShapesToRemove.map(s => s.id));
          this.shapeManager.removeShapes(shapeIdsToRemove);
        }

        // We also need to remove any intermediate spawned strokes if this is a redo,
        // Wait, on redo, we remove original and add the final new ones.
        for (const stroke of newStrokesToAdd) {
          this.drawingEngine.addStroke(stroke);
        }
        
        this.drawingEngine.redraw();
      },
      undo: () => {
        // Remove the split segments
        const newStrokeIds = new Set(newStrokesToAdd.map(s => s.id));
        this.drawingEngine.removeStrokes(newStrokeIds);

        // Restore original
        for (const stroke of originalStrokesToRemove) {
          this.drawingEngine.addStroke(stroke);
        }
        if (this.shapeManager) {
          for (const shape of originalShapesToRemove) {
            this.shapeManager.addShape(shape);
          }
        }
        this.drawingEngine.redraw();
      }
    });

    this.erasedStrokes = [];
    this.erasedShapes = [];
    this.spawnedStrokes = [];
    this.processedIds = new Set();
    
    return true;
  }
}
