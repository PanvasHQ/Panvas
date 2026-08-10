// ============================================
// Panvas — Viewport Manager
// ============================================
// Manages coordinate transforms between screen space and page space.
// Currently supports 100% zoom only, but the abstraction is designed
// so that pan, zoom, fit-width, fit-page, and multi-page support
// can be added without modifying the drawing engine.

import type { ViewportState } from './drawingTypes';
import { DEFAULT_VIEWPORT_STATE } from './drawingTypes';

export type ViewportChangeListener = (state: Readonly<ViewportState>) => void;

export class ViewportManager {
  private state: ViewportState;
  private dpr: number;
  private listeners: Set<ViewportChangeListener> = new Set();

  constructor() {
    this.state = { ...DEFAULT_VIEWPORT_STATE };
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  /** Subscribe to viewport state changes. Returns unsubscribe function. */
  subscribe(listener: ViewportChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = { ...this.state };
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }


  /** Current device pixel ratio. */
  getDevicePixelRatio(): number {
    return this.dpr;
  }

  /** Update DPR (e.g., when window moves between monitors). */
  updateDevicePixelRatio(): void {
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  /** Get current viewport state. */
  getState(): Readonly<ViewportState> {
    return this.state;
  }

  /** Set zoom level (1 = 100%). Clamped to [0.25, 4]. */
  setZoom(scale: number): void {
    this.state.scale = Math.max(0.25, Math.min(4, scale));
    this.notify();
  }


  /** Set pan offset. */
  setPan(offsetX: number, offsetY: number): void {
    this.state.offsetX = offsetX;
    this.state.offsetY = offsetY;
    this.notify();
  }

  /**
   * Translates the viewport by dx, dy (in screen pixels).
   */
  pan(dx: number, dy: number): void {
    this.state.offsetX += dx;
    this.state.offsetY += dy;
    this.notify();
  }

  /**
   * Zooms the viewport by a scale factor, centered on screen coordinates (originX, originY).
   */
  zoomBy(factor: number, originX: number, originY: number): void {
    const oldZoom = this.state.scale;
    let newZoom = this.state.scale * factor;
    
    // Clamp zoom
    newZoom = Math.max(0.25, Math.min(4.0, newZoom));
    
    const scaleChange = newZoom / oldZoom;
    
    // In this architecture, DOM positioning centers the page container.
    // Therefore, changing zoom scales out from the center organically.
    // We do NOT mutate offsetX/Y to manually track the cursor here,
    // as it conflicts with DOM centering and causes page jumping.
    this.state.scale = newZoom;
    
    this.notify();
  }


  /** Reset to default viewport (no pan, 100% zoom). */
  reset(): void {
    this.state = { ...DEFAULT_VIEWPORT_STATE };
    this.notify();
  }


  /**
   * Convert a screen-space coordinate (from a PointerEvent relative to the canvas element)
   * to page-space coordinate (used by the drawing engine).
   *
   * This accounts for zoom, pan, and device pixel ratio.
   */
  screenToPage(screenX: number, screenY: number): { x: number; y: number } {
    const { scale } = this.state;
    return {
      x: screenX / scale,
      y: screenY / scale,
    };
  }

  /**
   * Convert a page-space coordinate to screen-space coordinate.
   * Used for rendering selection handles, tooltips, etc.
   */
  pageToScreen(pageX: number, pageY: number): { x: number; y: number } {
    const { scale } = this.state;
    return {
      x: pageX * scale,
      y: pageY * scale,
    };
  }

  /**
   * Configure an HTML5 canvas element for HiDPI rendering.
   * Sets canvas.width/height to CSS dimensions * devicePixelRatio,
   * and scales the context accordingly.
   *
   * Returns the 2D context.
   */
  configureCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D {
    this.updateDevicePixelRatio();
    const dpr = this.dpr;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    return ctx;
  }

  /**
   * Apply viewport transform to a canvas context before drawing.
   * Call this at the start of each render frame.
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    const { scale } = this.state;
    ctx.scale(scale, scale);
  }

  /** Get the CSS dimensions that the canvas should occupy, accounting for zoom. */
  getCanvasCSSSize(pageWidth: number, pageHeight: number): { width: number; height: number } {
    return {
      width: pageWidth * this.state.scale,
      height: pageHeight * this.state.scale,
    };
  }
}
