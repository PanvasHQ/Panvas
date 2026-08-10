// ============================================
// Panvas — Drawing Engine
// ============================================
// Renders strokes onto an HTML5 Canvas.
// No React dependency — pure TypeScript class.

import type { Stroke, StrokePoint, DrawingToolId } from './drawingTypes';
import { ViewportManager } from './ViewportManager';
import { ShapeManager } from './ShapeManager';
import { ImageManager } from './ImageManager';
import { SelectionEngine } from './SelectionEngine';

export class DrawingEngine {
  private strokes: Stroke[] = [];
  private ctx: CanvasRenderingContext2D | null = null;
  private viewport: ViewportManager;
  private shapeManager: ShapeManager;
  private imageManager: ImageManager;
  private selectionEngine?: SelectionEngine;
  private canvas: HTMLCanvasElement | null = null;

  constructor(viewport: ViewportManager, shapeManager: ShapeManager, imageManager: ImageManager) {
    this.viewport = viewport;
    this.shapeManager = shapeManager;
    this.imageManager = imageManager;
  }
  
  setSelectionEngine(selectionEngine: SelectionEngine) {
    this.selectionEngine = selectionEngine;
  }

  /** Bind to a canvas element. Call after mount. */
  setCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): void {
    this.canvas = canvas;
    this.ctx = this.viewport.configureCanvas(canvas, cssWidth, cssHeight);
  }

  /** Resize the canvas (e.g., on window resize). */
  resize(cssWidth: number, cssHeight: number): void {
    if (!this.canvas) return;
    this.ctx = this.viewport.configureCanvas(this.canvas, cssWidth, cssHeight);
    this.redraw();
  }

  /** Get all strokes (for serialization). */
  getStrokes(): Stroke[] {
    return this.strokes;
  }

  /** Set strokes (from deserialization). Redraws. */
  setStrokes(strokes: Stroke[]): void {
    this.strokes = strokes;
    this.redraw();
  }

  /** Add a completed stroke. Does NOT redraw — caller should call redraw() or render incrementally. */
  addStroke(stroke: Stroke): void {
    this.strokes.push(stroke);
  }

  /** Remove a stroke by ID. Returns the removed stroke or undefined. */
  removeStroke(id: string): Stroke | undefined {
    const index = this.strokes.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    const [removed] = this.strokes.splice(index, 1);
    return removed;
  }

  /** Remove multiple strokes by ID. Returns removed strokes. */
  removeStrokes(ids: Set<string>): Stroke[] {
    const removed: Stroke[] = [];
    this.strokes = this.strokes.filter(s => {
      if (ids.has(s.id)) {
        removed.push(s);
        return false;
      }
      return true;
    });
    return removed;
  }

  /** Clear all strokes. Returns removed strokes for undo. */
  clearStrokes(): Stroke[] {
    const removed = this.strokes;
    this.strokes = [];
    return removed;
  }

  /** Full redraw of all strokes. */
  redraw(): void {
    if (!this.ctx || !this.canvas) return;
    const dpr = this.viewport.getDevicePixelRatio();
    const cssWidth = this.canvas.width / dpr;
    const cssHeight = this.canvas.height / dpr;

    this.ctx.clearRect(0, 0, cssWidth, cssHeight);
    
    // Save context state before applying viewport transform
    this.ctx.save();
    this.viewport.applyTransform(this.ctx);

    // Render images first (bottom layer)
    this.imageManager.renderImages(this.ctx);

    for (const stroke of this.strokes) {
      this.renderStroke(this.ctx, stroke);
    }
    
    // Render shapes
    this.shapeManager.renderShapes(this.ctx);

    // Restore context to undo viewport transform before rendering selection boxes
    // Actually SelectionEngine handles viewport transform internally, so we restore first.
    this.ctx.restore();
    
    if (this.selectionEngine) {
      this.selectionEngine.renderSelection(this.ctx);
    }
  }

  /**
   * Render a single stroke onto a context.
   * Used for both full redraws and live drawing previews.
   */
  renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
    const { points, color, thickness, opacity, tool } = stroke;
    if (points.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    switch (tool) {
      case 'pen':
        this.renderPenStroke(ctx, points, color, thickness);
        break;
      case 'pencil':
        this.renderPencilStroke(ctx, points, color, thickness);
        break;
      case 'highlighter':
        this.renderHighlighterStroke(ctx, points, color, thickness);
        break;
      case 'marker':
        this.renderMarkerStroke(ctx, points, color, thickness);
        break;
      case 'eraser':
        this.renderEraserStroke(ctx, points, thickness);
        break;
    }

    ctx.restore();
  }

  // ---- Pen: smooth pressure-variable strokes ----

  private renderPenStroke(ctx: CanvasRenderingContext2D, points: StrokePoint[], color: string, baseThickness: number): void {
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = 'source-over';

    // Draw variable-width segments
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const width = baseThickness * curr.pressure * 2;

      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, width);
      ctx.moveTo(prev.x, prev.y);

      // Use quadratic curve for smoothness if we have a next point
      if (i + 1 < points.length) {
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      } else {
        ctx.lineTo(curr.x, curr.y);
      }

      ctx.stroke();
    }
  }

  // ---- Pencil: jittered edges, slightly grainy ----

  private renderPencilStroke(ctx: CanvasRenderingContext2D, points: StrokePoint[], color: string, baseThickness: number): void {
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha *= 0.75; // Pencil is slightly transparent

    // Draw multiple thin overlapping lines for grainy effect
    const passes = 2;
    for (let pass = 0; pass < passes; pass++) {
      ctx.beginPath();
      const jitterScale = 0.5 * (pass + 1);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const width = baseThickness * p.pressure * 1.5;
        ctx.lineWidth = Math.max(0.3, width / passes);

        // Deterministic jitter based on index and pass
        const jx = p.x + Math.sin(i * 7.3 + pass * 13.7) * jitterScale;
        const jy = p.y + Math.cos(i * 11.1 + pass * 17.3) * jitterScale;

        if (i === 0) {
          ctx.moveTo(jx, jy);
        } else {
          ctx.lineTo(jx, jy);
        }
      }
      ctx.stroke();
    }
  }

  // ---- Highlighter: multiply blending, wide semi-transparent ----

  private renderHighlighterStroke(ctx: CanvasRenderingContext2D, points: StrokePoint[], color: string, baseThickness: number): void {
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha *= 0.4;
    ctx.lineWidth = Math.max(8, baseThickness * 6);
    ctx.lineCap = 'square';

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  // ---- Marker: solid wide strokes, flat caps, no pressure ----

  private renderMarkerStroke(ctx: CanvasRenderingContext2D, points: StrokePoint[], color: string, baseThickness: number): void {
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = Math.max(4, baseThickness * 3);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'bevel';

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  // ---- Eraser: pixel punch-out ----

  private renderEraserStroke(ctx: CanvasRenderingContext2D, points: StrokePoint[], baseThickness: number): void {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = Math.max(2, baseThickness * 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 1;

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
  }

  // ---- Live Drawing Preview ----

  /**
   * Draw a stroke-in-progress onto the canvas without adding it to the stroke list.
   * Call this during pointermove for live feedback.
   * After pointerup, call addStroke() and redraw().
   */
  renderLiveStroke(points: StrokePoint[], tool: DrawingToolId, color: string, thickness: number, opacity: number): void {
    if (!this.ctx || !this.canvas) return;

    // Redraw everything first (clears the previous live preview)
    this.redraw();

    // Then draw the live stroke on top
    this.ctx.save();
    this.viewport.applyTransform(this.ctx);
    this.renderStroke(this.ctx, {
      id: '__live__',
      type: 'stroke',
      tool,
      points,
      color,
      thickness,
      opacity,
      createdAt: 0,
    });
    this.ctx.restore();
  }

  // ---- Hit Testing (for eraser and selection) ----

  /**
   * Find all stroke IDs that are within `radius` CSS pixels of the given point.
   */
  findStrokesNearPoint(x: number, y: number, radius: number): string[] {
    const radiusSq = radius * radius;
    const hits: string[] = [];

    for (const stroke of this.strokes) {
      for (const point of stroke.points) {
        const dx = point.x - x;
        const dy = point.y - y;
        if (dx * dx + dy * dy <= radiusSq) {
          hits.push(stroke.id);
          break; // Only need to hit one point per stroke
        }
      }
    }

    return hits;
  }

  /**
   * Find all stroke IDs that have any point inside the given bounding box.
   */
  findStrokesInRect(x: number, y: number, width: number, height: number): string[] {
    const x2 = x + width;
    const y2 = y + height;
    const hits: string[] = [];

    for (const stroke of this.strokes) {
      for (const point of stroke.points) {
        if (point.x >= x && point.x <= x2 && point.y >= y && point.y <= y2) {
          hits.push(stroke.id);
          break;
        }
      }
    }

    return hits;
  }
}
