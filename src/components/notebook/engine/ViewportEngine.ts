// ============================================
// Panvas — Viewport Engine
// ============================================
// Manages the global infinite canvas viewport state (pan, zoom).
// This is decoupled from React state to allow 60fps panning via CSS transforms
// without forcing React render cycles.

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

type ViewportListener = (state: ViewportState) => void;

export class ViewportEngine {
  private x = 0;
  private y = 0;
  private zoom = 1.0; // Default to 100% scale
  private listeners = new Set<ViewportListener>();

  // Limits
  private readonly minZoom = 0.3;
  private readonly maxZoom = 3.0;

  constructor() {
    this.reset();
  }

  /**
   * Translates the viewport by dx, dy (in screen pixels).
   */
  pan(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.notify();
  }

  /**
   * Zooms the viewport by a scale factor, centered on screen coordinates (originX, originY).
   */
  zoomBy(factor: number, originX: number, originY: number): void {
    const oldZoom = this.zoom;
    let newZoom = this.zoom * factor;
    
    // Clamp zoom
    newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    
    const scaleChange = newZoom / oldZoom;
    
    // Adjust x and y so the point under the cursor remains stationary
    this.x = originX - (originX - this.x) * scaleChange;
    this.y = originY - (originY - this.y) * scaleChange;
    this.zoom = newZoom;
    
    this.notify();
  }

  /**
   * Set absolute zoom level directly.
   */
  setZoom(newZoom: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    this.notify();
  }

  /**
   * Reset viewport to default.
   */
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = 1.0;
    this.notify();
  }

  /**
   * Converts screen coordinates to absolute document coordinates.
   */
  screenToDocument(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.x) / this.zoom,
      y: (screenY - this.y) / this.zoom,
    };
  }

  /**
   * Converts absolute document coordinates to screen coordinates.
   */
  documentToScreen(docX: number, docY: number): { x: number; y: number } {
    return {
      x: docX * this.zoom + this.x,
      y: docY * this.zoom + this.y,
    };
  }

  getState(): ViewportState {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }

  subscribe(listener: ViewportListener): () => void {
    this.listeners.add(listener);
    // Immediately notify new subscriber with current state
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
