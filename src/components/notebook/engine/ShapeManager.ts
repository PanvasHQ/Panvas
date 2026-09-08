// ============================================
// Panvas — Shape Manager
// ============================================
// Handles drawing and rendering of vector shapes (rectangle, ellipse, etc).

import type { Shape, ShapeType } from './drawingTypes.ts';
import { DEFAULT_PAGE_LAYER_ID } from './drawingTypes.ts';
import type { ViewportManager } from './ViewportManager.ts';
import { LayerManager } from './LayerManager.ts';

export class ShapeManager {
  private shapes: Shape[] = [];
  private viewport: ViewportManager;
  private layerManager: LayerManager;

  constructor(viewport: ViewportManager, layerManager: LayerManager = new LayerManager()) {
    this.viewport = viewport;
    this.layerManager = layerManager;
  }

  getShapes(): Shape[] {
    return this.shapes;
  }

  setShapes(shapes: Shape[]): void {
    this.shapes = shapes;
  }

  addShape(shape: Shape): void {
    shape.layerId ??= this.layerManager.getActiveLayerId();
    this.shapes.push(shape);
  }

  removeShape(id: string): Shape | undefined {
    const index = this.shapes.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    const [removed] = this.shapes.splice(index, 1);
    return removed;
  }

  removeShapes(ids: Set<string>): Shape[] {
    const removed: Shape[] = [];
    this.shapes = this.shapes.filter(s => {
      if (ids.has(s.id)) {
        removed.push(s);
        return false;
      }
      return true;
    });
    return removed;
  }

  clearShapes(): Shape[] {
    const removed = this.shapes;
    this.shapes = [];
    return removed;
  }

  /** Render all shapes onto the given context. */
  renderShapes(ctx: CanvasRenderingContext2D, layerId?: string): void {
    for (const shape of this.shapes) {
      if (layerId && shape.layerId !== layerId) continue;
      const shapeLayerId = shape.layerId ?? DEFAULT_PAGE_LAYER_ID;
      if (layerId && shapeLayerId !== layerId) continue;
      this.renderShape(ctx, shape);
    }
  }

  /** Render a single shape (used for final rendering and live preview). */
  renderShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
    ctx.save();
    
    // Apply rotation around center
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((shape.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);

    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.globalAlpha = Math.max(0, Math.min(1, shape.opacity ?? 1));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (shape.fill) {
      ctx.fillStyle = shape.fill;
    }

    ctx.beginPath();

    switch (shape.shapeType) {
      case 'rectangle':
        ctx.rect(shape.x, shape.y, shape.width, shape.height);
        break;
      case 'rounded-rectangle': {
        const radius = Math.min(16, Math.abs(shape.width) / 4, Math.abs(shape.height) / 4);
        ctx.roundRect(shape.x, shape.y, shape.width, shape.height, radius);
        break;
      }
      case 'ellipse':
        ctx.ellipse(cx, cy, Math.abs(shape.width) / 2, Math.abs(shape.height) / 2, 0, 0, 2 * Math.PI);
        break;
      case 'triangle':
        ctx.moveTo(cx, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.lineTo(shape.x, shape.y + shape.height);
        ctx.closePath();
        break;
      case 'diamond':
        ctx.moveTo(cx, shape.y);
        ctx.lineTo(shape.x + shape.width, cy);
        ctx.lineTo(cx, shape.y + shape.height);
        ctx.lineTo(shape.x, cy);
        ctx.closePath();
        break;
      case 'line':
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        break;
      case 'arrow':
        // A simple arrow
        const angle = Math.atan2(shape.height, shape.width);
        const headlen = 15;
        const x2 = shape.x + shape.width;
        const y2 = shape.y + shape.height;
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(x2, y2);
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        break;
    }

    if (shape.fill && shape.shapeType !== 'line' && shape.shapeType !== 'arrow') {
      ctx.fill();
    }
    ctx.stroke();
    
    ctx.restore();
  }

  // ---- Hit Testing ----

  findShapesNearPoint(x: number, y: number, radius: number): string[] {
    const hits: string[] = [];
    const radiusSq = radius * radius;

    for (const shape of this.shapes) {
      if (!this.layerManager.isEditable(shape.layerId)) continue;
      // Very basic hit testing for now (bounding box + radius)
      // For precise selection, we'd need type-specific geometry math.
      const minX = Math.min(shape.x, shape.x + shape.width) - radius;
      const maxX = Math.max(shape.x, shape.x + shape.width) + radius;
      const minY = Math.min(shape.y, shape.y + shape.height) - radius;
      const maxY = Math.max(shape.y, shape.y + shape.height) + radius;

      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        hits.push(shape.id);
      }
    }
    return hits;
  }
}
