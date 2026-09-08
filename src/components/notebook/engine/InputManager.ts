// ============================================
// Panvas — Input Manager
// ============================================
// Handles pointer events on the drawing canvas and routes them
// to the appropriate engine module based on the active tool.
// No React dependency — attaches directly to DOM elements.

import type { StrokePoint, DrawingToolId, Shape, Stroke, NotebookMode } from './drawingTypes';
import { resolveDrawingStrokeContext, type DrawingStrokeContext, type ToolManager } from './ToolManager.ts';
import type { ViewportManager } from './ViewportManager';
import type { DrawingEngine } from './DrawingEngine';
import type { EraserEngine } from './EraserEngine';
import { analyzeScribble, findScribbleTargets } from './scribbleGesture.ts';
import { analyzeCircleGesture } from './circleSelectGesture.ts';
import { recognizeStraightLine } from './straightLineGesture.ts';
import { recognizeRoughShape } from './roughShapeGesture.ts';
import type { ShapeManager } from './ShapeManager';
import type { SelectionEngine } from './SelectionEngine';
import type { HistoryManager } from './HistoryManager';
import type { TextManager } from './TextManager';
import { generateId } from '../../../lib/utils/id.ts';
import { constrainShapeDrag } from './shapeGeometry.ts';
import type { RulerHit, RulerManager } from './RulerManager.ts';
import type { LaserManager } from './LaserManager.ts';
import { InkInputFilter, mapPointerPressure } from './inkInput.ts';

export type DrawingChangeListener = () => void;
export type InkStrokeLifecycleEvent =
  | { type: 'start'; instrument: 'pen' | 'pencil' }
  | { type: 'cancel'; instrument: 'pen' | 'pencil' }
  | { type: 'complete'; instrument: 'pen' | 'pencil'; stroke: Stroke };

const SELECTION_CURSORS = new Set([
  'default',
  'nwse-resize',
  'nesw-resize',
  'ns-resize',
  'ew-resize',
  'grab',
]);

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
  private unsubscribeToolState: (() => void) | null = null;

  // Live drawing state
  private isDrawing = false;
  private lastClickTime = 0;
  private strokeStartTime: number = 0;
  private currentPoints: StrokePoint[] = [];
  private inkInputFilter = new InkInputFilter();
  /** Immutable owner of the active canvas gesture. Cleared on every finish. */
  private strokeModeAtStart: NotebookMode | null = null;
  private strokeContextAtStart: DrawingStrokeContext | null = null;

  // Select-mode pointer routing. Transform gestures continue to be owned by
  // SelectionEngine; lasso only records the freehand enclosure passed to its existing
  // selectWithinLoop() implementation.
  private selectionDragMode: 'none' | 'transform' | 'lasso' = 'none';
  private lassoPoints: StrokePoint[] = [];

  private rulerManager: RulerManager;
  private rulerDragMode: Exclude<RulerHit, null> | null = null;
  private rulerPointerStart = { x: 0, y: 0 };
  private rulerCenterStart = { x: 0, y: 0 };
  private rulerRotationOffset = 0;
  private laserManager: LaserManager;
  private laserPointerActive = false;

  private isPanningOverride = false;

  // Change listeners (for autosave)
  private changeListeners: Set<DrawingChangeListener> = new Set();
  private strokeLifecycleListeners: Set<(event: InkStrokeLifecycleEvent) => void> = new Set();

  constructor(
    toolManager: ToolManager,
    viewport: ViewportManager,
    drawingEngine: DrawingEngine,
    eraserEngine: EraserEngine,
    shapeManager: ShapeManager,
    selectionEngine: SelectionEngine,
    historyManager: HistoryManager,
    textManager: TextManager,
    rulerManager: RulerManager,
    laserManager: LaserManager,
  ) {
    this.toolManager = toolManager;
    this.viewport = viewport;
    this.drawingEngine = drawingEngine;
    this.eraserEngine = eraserEngine;
    this.shapeManager = shapeManager;
    this.selectionEngine = selectionEngine;
    this.historyManager = historyManager;
    this.textManager = textManager;
    this.rulerManager = rulerManager;
    this.eraserEngine.setRulerManager(rulerManager);
    this.laserManager = laserManager;
    this.eraserEngine.setHistoryChangeCallback(() => this.notifyChange());
  }

  /** Subscribe to drawing data changes (for autosave). Returns unsubscribe. */
  onDrawingChange(listener: DrawingChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  onInkStrokeLifecycle(listener: (event: InkStrokeLifecycleEvent) => void): () => void {
    this.strokeLifecycleListeners.add(listener);
    return () => this.strokeLifecycleListeners.delete(listener);
  }

  private notifyStrokeLifecycle(event: InkStrokeLifecycleEvent): void {
    for (const listener of this.strokeLifecycleListeners) listener(event);
  }

  notifyChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  /** DOM text surfaces yield to the existing canvas gesture owner for ink and upper-layer hits. */
  routeOverlayPointerDown(event: PointerEvent): void {
    this.handlePointerDown(event);
  }

  /** Attach event listeners to a canvas element. Call on mount. */
  attach(canvas: HTMLCanvasElement): void {
    // Idempotent. Previously a second attach() without a matching detach() left the
    // old listeners bound to a stale canvas while `this.canvas` pointed at the new one,
    // so every coordinate lookup and pointer-capture call targeted the wrong element.
    if (this.canvas) this.detach();

    this.canvas = canvas;
    this.rulerManager.setEnabled(this.toolManager.getState().rulerEnabled);
    this.unsubscribeToolState = this.toolManager.subscribe((state) => {
      if (state.mode !== 'select') this.clearSelectionCursor();
      if (state.mode !== 'draw' || state.drawingTool !== 'laser') {
        this.laserPointerActive = false;
        this.laserManager.clear();
      }
      if (this.rulerManager.setEnabled(state.rulerEnabled)) {
        if (!state.rulerEnabled) this.rulerDragMode = null;
        this.drawingEngine.redraw();
      }
    });
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    // NOTE: `pointerleave` is deliberately NOT wired to handlePointerUp. Every gesture
    // start below calls setPointerCapture on this canvas, so `pointerup` is guaranteed
    // to be delivered here even when the button is released outside the element.
    // Ending the gesture on a boundary crossing only ever truncated live gestures.
    canvas.style.touchAction = 'none';
    if (typeof window !== 'undefined') window.addEventListener('blur', this.cancelTransientInteraction);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /** Detach event listeners. Call on unmount. */
  detach(): void {
    this.unsubscribeToolState?.();
    this.unsubscribeToolState = null;
    if (!this.canvas) return;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    if (typeof window !== 'undefined') window.removeEventListener('blur', this.cancelTransientInteraction);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.clearSelectionCursor();
    this.rulerDragMode = null;
    this.laserPointerActive = false;
    this.isDrawing = false;
    this.strokeModeAtStart = null;
    this.strokeContextAtStart = null;
    this.selectionDragMode = 'none';
    this.lassoPoints = [];
    this.laserManager.clear();
    this.canvas = null;
  }

  private clearSelectionCursor(): void {
    if (this.canvas && SELECTION_CURSORS.has(this.canvas.style.cursor)) {
      this.canvas.style.removeProperty('cursor');
    }
  }

  // ---- Event Handlers (bound as arrow functions for stable references) ----

  private handlePointerDown = (e: PointerEvent): void => {
    const toolState = this.toolManager.getState();
    if (toolState.rulerEnabled && e.button === 0) {
      const point = this.getCanvasPoint(e);
      const rulerHit = this.rulerManager.hitTest(point.x, point.y);
      if (rulerHit && toolState.mode !== 'erase') {
        this.startRulerInteraction(e, point, rulerHit);
        return;
      }
    }
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
      if (!this.ownsPanning(e)) return; // handled by the viewport-level controller
      e.preventDefault();
      this.isPanningOverride = true;
      this.startPanning(e);
      return;
    }

    // Ignore hover/barrel/right-button pointer events. On Windows, returning to the app
    // can otherwise surface a stale pen event that looks like a new drawing gesture.
    if (e.button !== 0) return;

    if (toolState.mode === 'draw' && toolState.drawingTool === 'laser') {
      if (e.button === 0) this.startLaser(e);
      return;
    }

    if (['draw', 'shape', 'text'].includes(toolState.mode) && !this.drawingEngine.canEditActiveLayer()) return;

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
      if (this.ownsPanning(e)) this.startPanning(e);
    }
  };

  private handlePointerMove = (e: PointerEvent): void => {
    // A pointerup can be swallowed while the native window is inactive. Mouse/pen hover
    // reports no pressed buttons, so cancel the orphaned transient gesture before routing
    // the move. Touch does not expose the same buttons contract.
    if ((e.pointerType === 'mouse' || e.pointerType === 'pen') && e.buttons === 0 && (this.isDrawing || this.laserPointerActive)) {
      this.cancelTransientInteraction();
      return;
    }
    if (this.rulerDragMode) {
      this.continueRulerInteraction(e);
      return;
    }
    if (this.laserPointerActive) {
      this.continueLaser(e);
      return;
    }
    if (this.isPanningOverride) {
      this.continuePanning(e);
      return;
    }

    if (this.strokeModeAtStart === 'draw' && this.isDrawing) {
      this.continueDrawing(e);
    } else if (this.strokeModeAtStart === 'erase' && this.isDrawing) {
      this.continueErasing(e);
    } else if (this.strokeModeAtStart === 'shape' && this.isDrawing) {
      this.continueShape(e);
    } else if (this.strokeModeAtStart === 'select' && this.isDrawing) {
      this.continueSelection(e);
    } else if (this.strokeModeAtStart === 'hand' && this.isPanning) {
      this.continuePanning(e);
    } else if (this.toolManager.getState().mode === 'select') {
      if (this.isDrawing) {
        this.continueSelection(e);
      } else if (this.canvas) {
        const point = this.getCanvasPoint(e);
        const handleHit = this.selectionEngine.getHandleAt(point.x, point.y);
        if (handleHit) {
          switch (handleHit.handle) {
            case 'tl':
            case 'br':
              this.canvas.style.cursor = 'nwse-resize';
              break;
            case 'tr':
            case 'bl':
              this.canvas.style.cursor = 'nesw-resize';
              break;
            case 'tc':
            case 'bc':
              this.canvas.style.cursor = 'ns-resize';
              break;
            case 'ml':
            case 'mr':
              this.canvas.style.cursor = 'ew-resize';
              break;
            case 'rotate':
              this.canvas.style.cursor = 'grab';
              break;
            default:
              this.clearSelectionCursor();
          }
        } else {
          this.clearSelectionCursor();
        }
      }
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (this.rulerDragMode) {
      this.finishRulerInteraction(e);
      return;
    }
    if (this.laserPointerActive) {
      this.finishLaser(e);
      return;
    }
    if (this.isPanningOverride) {
      this.isPanningOverride = false;
      this.finishPanning(e);
      if (this.canvas) {
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch (err) {
          // Ignore DOMException if capture is already lost
        }
      }
      return;
    }

    if (this.canvas) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignore DOMException if capture is already lost
      }
    }

    if (this.strokeModeAtStart === 'draw' && this.isDrawing) {
      this.finishDrawing(e);
    } else if (this.strokeModeAtStart === 'erase' && this.isDrawing) {
      this.finishErasing();
    } else if (this.strokeModeAtStart === 'shape' && this.isDrawing) {
      this.finishShape();
    } else if (this.strokeModeAtStart === 'select' && this.isDrawing) {
      this.finishSelection(e);
    } else if (this.strokeModeAtStart === 'hand' && this.isPanning) {
      this.finishPanning(e);
    }
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.cancelTransientInteraction();
  };

  private cancelTransientInteraction = (): void => {
    const cancelledContext = this.strokeContextAtStart;
    const wasDrawingInk = this.isDrawing && this.strokeModeAtStart === 'draw';

    this.isDrawing = false;
    this.strokeModeAtStart = null;
    this.strokeContextAtStart = null;
    this.currentPoints = [];
    this.lastEraserPoint = null;
    this.selectionDragMode = 'none';
    this.lassoPoints = [];
    this.rulerDragMode = null;
    this.isPanningOverride = false;
    this.isPanning = false;
    this.panScrollTarget = null;
    this.laserPointerActive = false;
    this.laserManager.clear();
    this.drawingEngine.redraw();

    if (wasDrawingInk && cancelledContext?.recognitionEligible) {
      this.notifyStrokeLifecycle({
        type: 'cancel',
        instrument: cancelledContext.tool as 'pen' | 'pencil',
      });
    }
  };

  // ---- Transient Ruler Interaction ----

  private startRulerInteraction(e: PointerEvent, point: StrokePoint, mode: Exclude<RulerHit, null>): void {
    if (this.canvas) this.canvas.setPointerCapture(e.pointerId);
    this.rulerDragMode = mode;
    this.rulerPointerStart = { x: point.x, y: point.y };
    const state = this.rulerManager.getState();
    this.rulerCenterStart = { ...state.center };
    if (mode === 'rotate') {
      const pointerAngle = Math.atan2(point.y - state.center.y, point.x - state.center.x);
      this.rulerRotationOffset = state.angle - pointerAngle;
    }
  }

  private continueRulerInteraction(e: PointerEvent): void {
    if (!this.rulerDragMode) return;
    const point = this.getCanvasPoint(e);
    if (this.rulerDragMode === 'move') {
      this.rulerManager.setCenter(
        this.rulerCenterStart.x + point.x - this.rulerPointerStart.x,
        this.rulerCenterStart.y + point.y - this.rulerPointerStart.y,
      );
    } else if (this.rulerDragMode === 'rotate') {
      const center = this.rulerManager.getState().center;
      const pointerAngle = Math.atan2(point.y - center.y, point.x - center.x);
      this.rulerManager.setAngle(pointerAngle + this.rulerRotationOffset, true);
    } else {
      const state = this.rulerManager.getState();
      const dx = point.x - state.center.x;
      const dy = point.y - state.center.y;
      const localX = dx * Math.cos(state.angle) + dy * Math.sin(state.angle);
      this.rulerManager.setWidth(Math.abs(localX) * 2);
    }
    this.drawingEngine.redraw();
  }

  private finishRulerInteraction(e: PointerEvent): void {
    this.continueRulerInteraction(e);
    this.rulerDragMode = null;
    if (this.canvas) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already have ended after cancellation.
      }
    }
    this.drawingEngine.redraw();
  }

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
    // Keep Text mode active. The selected object is durable state consumed by
    // FloatingTextEditor after React mounts it; dispatching focus here raced that mount and
    // switching to Select simultaneously disabled the editor that was meant to receive it.
  }

  // ---- Selection ----

  private startSelection(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    const point = this.getCanvasPoint(e);

    this.isDrawing = true;
    this.strokeModeAtStart = 'select';
    this.lassoPoints = [];

    // getHandleAt() and selectAt() preserve the existing handle, active-bounds,
    // click-to-select, and Shift+click behavior. Only a genuine empty-canvas hit starts
    // lasso collection.
    const handleHit = this.selectionEngine.getHandleAt(point.x, point.y);
    const hitSelectionOrElement = Boolean(handleHit)
      || this.selectionEngine.selectAt(point.x, point.y, e.shiftKey);

    if (hitSelectionOrElement) {
      this.selectionDragMode = 'transform';
      this.selectionEngine.startDrag(point.x, point.y);
      return;
    }

    this.selectionDragMode = 'lasso';
    this.lassoPoints = [point];
    this.drawingEngine.renderLasso(this.lassoPoints);
  }

  private continueSelection(e: PointerEvent): void {
    const point = this.getCanvasPoint(e);
    if (this.selectionDragMode === 'lasso') {
      this.lassoPoints.push(point);
      this.drawingEngine.renderLasso(this.lassoPoints);
      return;
    }

    if (this.selectionDragMode !== 'transform') return;
    this.selectionEngine.dragTo(point.x, point.y);
    if (this.selectionEngine.getSelectedElements().some(el => el.type === 'text')) {
      this.notifyChange();
    }
  }

  private finishSelection(e: PointerEvent): void {
    this.isDrawing = false;
    this.strokeModeAtStart = null;
    const point = this.getCanvasPoint(e);

    if (this.selectionDragMode === 'lasso') {
      this.lassoPoints.push(point);
      const completedLoop = this.lassoPoints;
      this.lassoPoints = [];
      this.selectionDragMode = 'none';
      if (completedLoop.length >= 3) {
        this.selectionEngine.selectWithinLoop(completedLoop);
      }
      // selectWithinLoop intentionally does not redraw when nothing is enclosed; always
      // redraw here so the transient lasso disappears for both hit and miss outcomes.
      this.drawingEngine.redraw();
      return;
    }

    this.selectionDragMode = 'none';
    const moved = this.selectionEngine.finishDrag(point.x, point.y);
    if (moved) {
      this.notifyChange();
    }
  }

  // ---- Panning ----
  //
  // Panning ownership is split deliberately. In the notebook, the `.notebook-viewport`
  // scroll container owns mouse/pen panning (see NotebookRenderer) because a hand drag
  // must work when it starts on an inter-page gap, a side margin, or a non-focused page
  // — none of which are this canvas. Two cases still belong to the canvas:
  //   * The PDF workspace has no `.notebook-viewport`; it pans a shared CSS camera.
  //   * Touch, because `touch-action: none` (set in attach) suppresses native scrolling
  //     on this canvas, while the viewport controller leaves touch to native scrolling.
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;
  private panStartOffsetX = 0;
  private panStartOffsetY = 0;
  private panScrollTarget: Element | null = null;

  private ownsPanning(e: PointerEvent): boolean {
    if (!this.canvas) return false;
    if (e.pointerType === 'touch') return true;
    return !this.canvas.closest('.notebook-viewport');
  }

  private startPanning(e: PointerEvent): void {
    if (!this.canvas) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore DOMException if the pointer is already gone
    }
    this.isPanning = true;
    this.strokeModeAtStart = 'hand';
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;

    this.panScrollTarget = this.canvas.closest('.notebook-viewport');
    if (this.panScrollTarget) {
      this.panStartScrollLeft = this.panScrollTarget.scrollLeft;
      this.panStartScrollTop = this.panScrollTarget.scrollTop;
    } else {
      const state = this.viewport.getState();
      this.panStartOffsetX = state.offsetX;
      this.panStartOffsetY = state.offsetY;
    }
  }

  private continuePanning(e: PointerEvent): void {
    if (!this.isPanning) return;

    // Absolute target from the gesture anchor. The previous implementation rebased the
    // anchor on every move, so any motion the scroller clamped away or rounded off was
    // permanently discarded instead of deferred — the cause of the content lagging
    // behind the cursor, worst at fractional display scaling.
    const dx = e.clientX - this.panStartX;
    const dy = e.clientY - this.panStartY;

    if (this.panScrollTarget) {
      this.panScrollTarget.scrollLeft = this.panStartScrollLeft - dx;
      this.panScrollTarget.scrollTop = this.panStartScrollTop - dy;
    } else {
      this.viewport.setPan(this.panStartOffsetX + dx, this.panStartOffsetY + dy);
    }
  }

  private finishPanning(_e: PointerEvent): void {
    this.isPanning = false;
    this.strokeModeAtStart = null;
    this.panScrollTarget = null;
  }

  // ---- Drawing ----

  private startLaser(e: PointerEvent): void {
    if (this.canvas) this.canvas.setPointerCapture(e.pointerId);
    this.laserPointerActive = true;
    this.strokeStartTime = Date.now();
    this.laserManager.addPoint(this.getCanvasPoint(e));
  }

  private continueLaser(e: PointerEvent): void {
    if (!this.laserPointerActive) return;
    this.laserManager.addPoint(this.getCanvasPoint(e));
  }

  private finishLaser(e: PointerEvent): void {
    this.continueLaser(e);
    this.laserPointerActive = false;
    if (this.canvas) {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already have ended after cancellation.
      }
    }
  }

  private getCanvasPoint(e: PointerEvent): StrokePoint {
    if (!this.canvas) return { x: 0, y: 0, pressure: 0.5, t: 0 };

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0, pressure: 0.5, t: 0 };

    // Base document CSS dimensions of the canvas
    const cssWidth = this.canvas.clientWidth || (this.canvas.width / (window.devicePixelRatio || 1));
    const cssHeight = this.canvas.clientHeight || (this.canvas.height / (window.devicePixelRatio || 1));

    // First map client pixels into the canvas CSS box. PDF canvases use zoomed CSS
    // dimensions and apply the same zoom in the drawing context, so ViewportManager then
    // removes that render scale. Notebook canvases render in base coordinates and pass
    // through unchanged. DPR never enters this conversion.
    const canvasX = ((e.clientX - rect.left) / rect.width) * cssWidth;
    const canvasY = ((e.clientY - rect.top) / rect.height) * cssHeight;
    const { x, y } = this.viewport.canvasToPage(canvasX, canvasY);

    // Native pressure: mouse = 0.5, stylus = actual pressure
    const pressure = mapPointerPressure(
      e.pointerType,
      e.pressure,
      this.strokeContextAtStart?.pressureSensitivity ?? true,
    );

    return {
      x,
      y,
      pressure,
      t: Date.now() - this.strokeStartTime,
    };
  }

  private startDrawing(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    this.isDrawing = true;
    const toolState = this.toolManager.getState();
    this.strokeModeAtStart = toolState.mode;
    this.strokeContextAtStart = resolveDrawingStrokeContext(toolState);
    this.strokeStartTime = Date.now();
    this.inkInputFilter.reset();
    this.currentPoints = [this.inkInputFilter.push(this.getRulerConstrainedPoint(e), this.strokeContextAtStart.stabilization)];
    if (this.strokeContextAtStart.recognitionEligible) {
      this.notifyStrokeLifecycle({
        type: 'start',
        instrument: this.strokeContextAtStart.tool as 'pen' | 'pencil',
      });
    }
  }

  private continueDrawing(e: PointerEvent): void {
    const strokeContext = this.strokeContextAtStart ?? resolveDrawingStrokeContext(this.toolManager.getState());
    const point = this.inkInputFilter.push(this.getRulerConstrainedPoint(e), strokeContext.stabilization);
    this.currentPoints.push(point);
    this.drawingEngine.renderLiveStroke(
      this.currentPoints,
      strokeContext.tool,
      strokeContext.color,
      strokeContext.thickness,
      strokeContext.opacity,
      strokeContext.strokePattern,
    );
  }

  private getRulerConstrainedPoint(e: PointerEvent): StrokePoint {
    const point = this.getCanvasPoint(e);
    return this.rulerManager.snapPointToEdge(point).point;
  }

  private finishDrawing(_e: PointerEvent): void {
    this.isDrawing = false;
    const gestureMode = this.strokeModeAtStart;
    this.strokeModeAtStart = null;
    const strokeContext = this.strokeContextAtStart ?? resolveDrawingStrokeContext(this.toolManager.getState());
    this.strokeContextAtStart = null;
    if (this.currentPoints.length < 2) {
      this.currentPoints = [];
      this.drawingEngine.redraw();
      if (strokeContext.recognitionEligible) {
        this.notifyStrokeLifecycle({
          type: 'cancel',
          instrument: strokeContext.tool as 'pen' | 'pencil',
        });
      }
      return;
    }

    const toolState = this.toolManager.getState();
    if (
      !strokeContext.recognitionEligible
      && gestureMode === 'draw'
      && toolState.scribbleToErase
      && (strokeContext.tool === 'pen' || strokeContext.tool === 'pencil')
      && analyzeScribble(this.currentPoints).isScribble
    ) {
      const targets = findScribbleTargets(
        this.currentPoints,
        (x, y, radius) => this.drawingEngine.findStrokesNearPoint(x, y, radius),
        Math.max(3, strokeContext.thickness),
      );
      if (this.eraserEngine.eraseStrokeIds(targets)) {
        this.currentPoints = [];
        this.notifyChange();
        return;
      }
    }

    if (
      !strokeContext.recognitionEligible
      && gestureMode === 'draw'
      && toolState.circleToSelect
      && (strokeContext.tool === 'pen' || strokeContext.tool === 'pencil')
      && analyzeCircleGesture(this.currentPoints).isCircle
      && this.selectionEngine.selectWithinLoop(this.currentPoints) > 0
    ) {
      this.currentPoints = [];
      this.toolManager.setMode('select');
      return;
    }

    const recognizedLine = !strokeContext.recognitionEligible && gestureMode === 'draw' && toolState.straightLineRecognition
      ? recognizeStraightLine(this.currentPoints, toolState.snapRecognizedLines)
      : null;
    const recognizedShape = !recognizedLine?.isLine
      && gestureMode === 'draw'
      && !strokeContext.recognitionEligible
      && toolState.roughShapeRecognition
      && (strokeContext.tool === 'pen' || strokeContext.tool === 'pencil')
      ? recognizeRoughShape(this.currentPoints, toolState.snapRecognizedShapes)
      : null;

    if (recognizedShape?.isShape && recognizedShape.shapeType) {
      const shape: Shape = {
        id: generateId('shp'),
        type: 'shape',
        shapeType: recognizedShape.shapeType,
        x: recognizedShape.x,
        y: recognizedShape.y,
        width: recognizedShape.width,
        height: recognizedShape.height,
        color: strokeContext.color,
        strokeWidth: strokeContext.thickness,
        fill: null,
        rotation: 0,
        opacity: strokeContext.opacity,
        createdAt: Date.now(),
      };
      this.shapeManager.addShape(shape);
      this.drawingEngine.redraw();
      this.recordCommittedShape(shape, `Recognize ${shape.shapeType}`);
      this.currentPoints = [];
      return;
    }

    const committedPoints = recognizedLine?.isLine
      ? recognizedLine.points
      : [...this.currentPoints];

    const stroke = {
      id: generateId('strk'),
      type: 'stroke' as const,
      tool: strokeContext.tool,
      points: committedPoints,
      color: strokeContext.color,
      thickness: strokeContext.thickness,
      opacity: strokeContext.opacity,
      pattern: strokeContext.strokePattern,
      createdAt: Date.now(),
    };

    // Add stroke to engine
    this.drawingEngine.addStroke(stroke);
    this.drawingEngine.redraw();

    // Push to unified history (already executed, so use pushExecuted)
    this.historyManager.pushExecuted({
      description: `Draw ${stroke.tool} stroke`,
      createdObjectIds: [stroke.id],
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
    if (strokeContext.recognitionEligible) {
      this.notifyStrokeLifecycle({
        type: 'complete',
        instrument: strokeContext.tool as 'pen' | 'pencil',
        stroke: structuredClone(stroke),
      });
    }
  }

  // ---- Erasing ----
  private lastEraserPoint: { x: number; y: number } | null = null;

  private startErasing(e: PointerEvent): void {
    if (this.canvas) {
      this.canvas.setPointerCapture(e.pointerId);
    }
    this.isDrawing = true;
    this.strokeModeAtStart = 'erase';
    
    const toolState = this.toolManager.getState();
    this.eraserEngine.startErasing(toolState.eraserMode);
    
    const point = this.getCanvasPoint(e);
    const radius = Math.max(3, toolState.thickness || 12);

    this.lastEraserPoint = { x: point.x, y: point.y };

    if (toolState.eraserMode !== 'all') {
      this.eraserEngine.eraseAt(point.x, point.y, toolState.eraserMode, radius);
    }
  }

  private continueErasing(e: PointerEvent): void {
    const toolState = this.toolManager.getState();
    if (toolState.eraserMode === 'all') return;

    const point = this.getCanvasPoint(e);
    const radius = Math.max(3, toolState.thickness || 12);
    const didModify = this.eraserEngine.eraseSweep(this.lastEraserPoint ?? point, point, toolState.eraserMode, radius, false);

    if (didModify) this.drawingEngine.redraw();
    this.lastEraserPoint = { x: point.x, y: point.y };
  }

  private finishErasing(): void {
    this.isDrawing = false;
    this.strokeModeAtStart = null;
    this.lastEraserPoint = null;
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
    this.strokeModeAtStart = 'shape';
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
      opacity: toolState.opacity,
      createdAt: Date.now(),
    });
    this.drawingEngine.redraw();
  }

  private continueShape(e: PointerEvent): void {
    if (!this.activeShapeId) return;
    const point = this.getCanvasPoint(e);
    const shape = this.shapeManager.getShapes().find(s => s.id === this.activeShapeId);
    if (!shape) return;

    Object.assign(shape, constrainShapeDrag(shape.shapeType, this.shapeStartPoint, point, e.shiftKey));

    this.drawingEngine.redraw();
  }

  private finishShape(): void {
    this.isDrawing = false;
    this.strokeModeAtStart = null;
    if (!this.activeShapeId) return;
    
    const shape = this.shapeManager.getShapes().find(s => s.id === this.activeShapeId);
    this.activeShapeId = null;

    if (!shape) return;

    // If it's too small, remove it
    if (Math.hypot(shape.width, shape.height) < 5) {
      this.shapeManager.removeShape(shape.id);
      this.drawingEngine.redraw();
      return;
    }

    this.recordCommittedShape(shape, 'Draw shape');
  }

  private recordCommittedShape(shape: Shape, description: string): void {
    // Deep clone the final shape for undo/redo history safety because the live shape can
    // be modified or removed by later selection actions.
    const finalShape: Shape = JSON.parse(JSON.stringify(shape));
    this.historyManager.pushExecuted({
      description,
      execute: () => {
        // If we redo, we must add a fresh clone of finalShape
        this.shapeManager.addShape(JSON.parse(JSON.stringify(finalShape)));
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
