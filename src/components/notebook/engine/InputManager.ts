// ============================================
// Panvas — Input Manager
// ============================================
// Handles pointer events on the drawing canvas and routes them
// to the appropriate engine module based on the active tool.
// No React dependency — attaches directly to DOM elements.

import type { StrokePoint, DrawingToolId } from './drawingTypes';
import type { ToolManager } from './ToolManager';
import type { ViewportManager } from './ViewportManager';
import type { DrawingEngine } from './DrawingEngine';
import type { EraserEngine } from './EraserEngine';
import type { ShapeManager } from './ShapeManager';
import type { SelectionEngine } from './SelectionEngine';
import type { HistoryManager } from './HistoryManager';
import type { TextManager } from './TextManager';
import { generateId } from '@/lib/utils/id';

export type DrawingChangeListener = () => void;

export class InputManager {
  private toolManager: ToolManager;
  private viewport: ViewportManager;
  private drawingEngine: DrawingEngine;
  private eraserEngine: EraserEngine;
  private shapeManager: ShapeManager;
  private selectionEngine: SelectionEngine;
  private historyManager: HistoryManager;
  private textManager: TextManager;
  private canvas: HTMLCanvasElement | null = null;

  // Live drawing state
  private isDrawing = false;
  private lastClickTime = 0;
  private strokeStartTime: number = 0;
  private currentPoints: StrokePoint[] = [];

  private isPanningOverride = false;

  // Change listeners (for autosave)
  private changeListeners: Set<DrawingChangeListener> = new Set();

  constructor(
    toolManager: ToolManager,
    viewport: ViewportManager,
    drawingEngine: DrawingEngine,
    eraserEngine: EraserEngine,
    shapeManager: ShapeManager,
    selectionEngine: SelectionEngine,
    historyManager: HistoryManager,
    textManager: TextManager,
  ) {
    this.toolManager = toolManager;
    this.viewport = viewport;
    this.drawingEngine = drawingEngine;
    this.eraserEngine = eraserEngine;
    this.shapeManager = shapeManager;
    this.selectionEngine = selectionEngine;
    this.historyManager = historyManager;
    this.textManager = textManager;
  }

  /** Subscribe to drawing data changes (for autosave). Returns unsubscribe. */
  onDrawingChange(listener: DrawingChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  /** Attach event listeners to a canvas element. Call on mount. */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointerleave', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    // Prevent touch scrolling on the canvas
    canvas.style.touchAction = 'none';
  }

  /** Detach event listeners. Call on unmount. */
  detach(): void {
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointerleave', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas = null;
  }

  // ---- Event Handlers (bound as arrow functions for stable references) ----

  private handlePointerDown = (e: PointerEvent): void => {
    const toolState = this.toolManager.getState();
    const now = Date.now();
    
    // Check for double click to edit text box
    if (now - this.lastClickTime < 300) {
      if (toolState.mode === 'select') {
        const point = this.getCanvasPoint(e);
        this.selectionEngine.selectAt(point.x, point.y, false);
        const hit = this.selectionEngine.getSelectedElements()[0];
        if (hit && hit.type === 'text') {
           this.toolManager.setMode('text');
           document.dispatchEvent(new CustomEvent('panvas:focus-text', { detail: { id: hit.id } }));
           this.lastClickTime = 0; // reset
           return;
        }
      }
    }
    this.lastClickTime = now;

    // Handle middle-click pan override
    if (e.button === 1) {
      e.preventDefault();
      this.isPanningOverride = true;
      this.startPanning(e);
      return;
    }

    if (toolState.mode === 'draw') {
      this.startDrawing(e);
    } else if (toolState.mode === 'erase') {
      this.startErasing(e);
    } else if (toolState.mode === 'shape') {
      this.startShape(e);
    } else if (toolState.mode === 'select') {
      this.startSelection(e);
    } else if (toolState.mode === 'text') {
      this.createTextBox(e);
    } else if (toolState.mode === 'hand') {
      this.startPanning(e);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (this.isPanningOverride) {
      this.continuePanning(e);
      return;
    }

    const toolState = this.toolManager.getState();

    if (toolState.mode === 'draw' && this.isDrawing) {
      this.continueDrawing(e);
    } else if (toolState.mode === 'erase' && this.isDrawing) {
      this.continueErasing(e);
    } else if (toolState.mode === 'shape' && this.isDrawing) {
      this.continueShape(e);
    } else if (toolState.mode === 'select' && this.isDrawing) {
      this.continueSelection(e);
    } else if (toolState.mode === 'hand' && this.isDrawing) {
      this.continuePanning(e);
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.isPanningOverride) {
      this.isPanningOverride = false;
      this.finishPanning(e);
      if (this.canvas) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
      return;
    }

    const toolState = this.toolManager.getState();
    if (this.canvas) {
      this.canvas.releasePointerCapture(e.pointerId);
    }

    if (toolState.mode === 'draw' && this.isDrawing) {
      this.finishDrawing(e);
    } else if (toolState.mode === 'erase' && this.isDrawing) {
      this.finishErasing();
    } else if (toolState.mode === 'shape' && this.isDrawing) {
      this.finishShape();
    } else if (toolState.mode === 'select' && this.isDrawing) {
      this.finishSelection(e);
    } else if (toolState.mode === 'hand' && this.isDrawing) {
      this.finishPanning(e);
    }
  };

  private createTextBox(e: PointerEvent): void {
    const point = this.getCanvasPoint(e);
    
    // Check if we hit an existing text box first
    this.selectionEngine.selectAt(point.x, point.y, false);
    const hit = this.selectionEngine.getSelectedElements()[0];
    if (hit && hit.type === 'text') {
      document.dispatchEvent(new CustomEvent('panvas:focus-text', { detail: { id: hit.id } }));
      return;
    }

    const newText = {
      id: generateId(),
      type: 'text' as const,
      x: point.x,
      y: point.y,
      width: 300,
      content: { 
        type: 'doc', 
        content: [{ 
          type: 'paragraph', 
          content: [{
            type: 'text',
            text: '',
            marks: [{ type: 'textStyle', attrs: { color: this.toolManager.getState().color } }]
          }] 
        }] 
      },
      createdAt: Date.now(),
    };
    this.textManager.addText(newText);
    this.selectionEngine.clearSelection();
    this.selectionEngine.selectAt(point.x, point.y, false);
    this.notifyChange();
    this.toolManager.setMode('select'); // Switch to select to interact with it
    
    // Dispatch a custom event to notify the React tree to focus this editor
    document.dispatchEvent(new CustomEvent('panvas:focus-text', { detail: { id: newText.id } }));
  }

  // ---- Selection ----

  private startSelection(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    const point = this.getCanvasPoint(e);
    
    // Check if we hit an already selected element to start dragging
    const hitExisting = this.selectionEngine.getSelectedElements().length > 0;
    // If not, or if we want to change selection:
    if (!hitExisting || !this.selectionEngine.selectAt(point.x, point.y, e.shiftKey)) {
      this.selectionEngine.selectAt(point.x, point.y, e.shiftKey);
    }

    if (this.selectionEngine.getSelectedElements().length > 0) {
      this.isDrawing = true;
      this.selectionEngine.startDrag(point.x, point.y);
    }
  }

  private continueSelection(e: PointerEvent): void {
    const point = this.getCanvasPoint(e);
    this.selectionEngine.dragTo(point.x, point.y);
    if (this.selectionEngine.getSelectedElements().some(el => el.type === 'text')) {
      this.notifyChange();
    }
  }

  private finishSelection(e: PointerEvent): void {
    this.isDrawing = false;
    const point = this.getCanvasPoint(e);
    const moved = this.selectionEngine.finishDrag(point.x, point.y);
    if (moved) {
      this.notifyChange();
    }
  }

  // ---- Panning ----
  private panStartX = 0;
  private panStartY = 0;

  private startPanning(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    this.isDrawing = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
  }

  private continuePanning(e: PointerEvent): void {
    if (!this.isDrawing) return;
    const dx = e.clientX - this.panStartX;
    const dy = e.clientY - this.panStartY;
    this.viewport.pan(dx, dy);
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
  }

  private finishPanning(e: PointerEvent): void {
    this.isDrawing = false;
  }

  // ---- Drawing ----

  private getCanvasPoint(e: PointerEvent): StrokePoint {
    if (!this.canvas) return { x: 0, y: 0, pressure: 0.5, t: 0 };

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const { x, y } = this.viewport.screenToPage(screenX, screenY);

    // Native pressure: mouse = 0.5, stylus = actual pressure
    const pressure = e.pointerType === 'mouse' ? 0.5 : e.pressure;

    return {
      x,
      y,
      pressure: Math.max(0.01, pressure),
      t: Date.now() - this.strokeStartTime,
    };
  }

  private startDrawing(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    this.isDrawing = true;
    this.strokeStartTime = Date.now();
    this.currentPoints = [this.getCanvasPoint(e)];
  }

  private continueDrawing(e: PointerEvent): void {
    const point = this.getCanvasPoint(e);
    this.currentPoints.push(point);

    const toolState = this.toolManager.getState();
    this.drawingEngine.renderLiveStroke(
      this.currentPoints,
      toolState.drawingTool,
      toolState.color,
      toolState.thickness,
      toolState.opacity,
    );
  }

  private finishDrawing(_e: PointerEvent): void {
    this.isDrawing = false;
    if (this.currentPoints.length < 2) {
      this.currentPoints = [];
      this.drawingEngine.redraw();
      return;
    }

    const toolState = this.toolManager.getState();
    const stroke = {
      id: generateId('strk'),
      type: 'stroke' as const,
      tool: toolState.drawingTool as DrawingToolId,
      points: [...this.currentPoints],
      color: toolState.color,
      thickness: toolState.thickness,
      opacity: toolState.opacity,
      createdAt: Date.now(),
    };

    // Add stroke to engine
    this.drawingEngine.addStroke(stroke);
    this.drawingEngine.redraw();

    // Push to unified history (already executed, so use pushExecuted)
    this.historyManager.pushExecuted({
      description: `Draw ${stroke.tool} stroke`,
      execute: () => {
        this.drawingEngine.addStroke(stroke);
        this.drawingEngine.redraw();
        this.notifyChange();
      },
      undo: () => {
        this.drawingEngine.removeStroke(stroke.id);
        this.drawingEngine.redraw();
        this.notifyChange();
      },
    });

    this.currentPoints = [];
    this.notifyChange();
  }

  // ---- Erasing ----

  private startErasing(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    this.isDrawing = true;
    
    const toolState = this.toolManager.getState();
    this.eraserEngine.startErasing(toolState.eraserMode);
    
    if (toolState.eraserMode !== 'all') {
      this.eraseAt(e, toolState.eraserMode);
    }
  }

  private continueErasing(e: PointerEvent): void {
    const toolState = this.toolManager.getState();
    if (toolState.eraserMode !== 'all') {
      this.eraseAt(e, toolState.eraserMode);
    }
  }

  private eraseAt(e: PointerEvent, mode: 'stroke' | 'pixel' | 'all'): void {
    const point = this.getCanvasPoint(e);
    this.eraserEngine.eraseAt(point.x, point.y, mode);
  }

  private finishErasing(): void {
    this.isDrawing = false;
    const changed = this.eraserEngine.finishErasing();
    this.drawingEngine.redraw();
    if (changed) {
      this.notifyChange();
    }
  }

  // ---- Shape Drawing ----
  private shapeStartPoint = { x: 0, y: 0 };
  private activeShapeId: string | null = null;

  private startShape(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    this.isDrawing = true;
    this.shapeStartPoint = this.getCanvasPoint(e);
    
    const toolState = this.toolManager.getState();
    this.activeShapeId = generateId('shp');
    
    // Draw an initial tiny shape
    this.shapeManager.addShape({
      id: this.activeShapeId,
      type: 'shape',
      shapeType: toolState.shapeTool,
      x: this.shapeStartPoint.x,
      y: this.shapeStartPoint.y,
      width: 0,
      height: 0,
      color: toolState.color,
      strokeWidth: toolState.thickness,
      fill: toolState.shapeFillEnabled ? toolState.color : null,
      rotation: 0,
      createdAt: Date.now(),
    });
    this.drawingEngine.redraw();
  }

  private continueShape(e: PointerEvent): void {
    if (!this.activeShapeId) return;
    const point = this.getCanvasPoint(e);
    const shape = this.shapeManager.getShapes().find(s => s.id === this.activeShapeId);
    if (!shape) return;

    // Standard behavior: dragging right/down increases width/height
    // To support drag left/up, we adjust x/y and make width/height positive
    shape.x = Math.min(this.shapeStartPoint.x, point.x);
    shape.y = Math.min(this.shapeStartPoint.y, point.y);
    shape.width = Math.abs(point.x - this.shapeStartPoint.x);
    shape.height = Math.abs(point.y - this.shapeStartPoint.y);

    this.drawingEngine.redraw();
  }

  private finishShape(): void {
    this.isDrawing = false;
    if (!this.activeShapeId) return;
    
    const shape = this.shapeManager.getShapes().find(s => s.id === this.activeShapeId);
    this.activeShapeId = null;

    if (!shape) return;

    // If it's too small, remove it
    if (shape.width < 5 && shape.height < 5) {
      this.shapeManager.removeShape(shape.id);
      this.drawingEngine.redraw();
      return;
    }

    const finalShape = { ...shape };

    this.historyManager.pushExecuted({
      description: 'Draw shape',
      execute: () => {
        this.shapeManager.addShape(finalShape);
        this.drawingEngine.redraw();
        this.notifyChange();
      },
      undo: () => {
        this.shapeManager.removeShape(finalShape.id);
        this.drawingEngine.redraw();
        this.notifyChange();
      }
    });

    this.notifyChange();
  }
}
