// ============================================
// Panvas — Tool Manager
// ============================================
// Single source of truth for active tool state.
// React components read from this; engine modules consume it.

import type { ToolState, NotebookMode, DrawingToolId, EraserMode, ShapeToolMode } from './drawingTypes';
import { DEFAULT_TOOL_STATE } from './drawingTypes';

export type ToolStateChangeListener = (state: Readonly<ToolState>) => void;

export class ToolManager {
  private state: ToolState;
  private listeners: Set<ToolStateChangeListener> = new Set();

  constructor() {
    this.state = { ...DEFAULT_TOOL_STATE };
  }

  /** Get current tool state (read-only snapshot). */
  getState(): Readonly<ToolState> {
    return this.state;
  }

  /** Subscribe to tool state changes. Returns unsubscribe function. */
  subscribe(listener: ToolStateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshot = { ...this.state };
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  // ---- Mode ----

  setMode(mode: NotebookMode): void {
    if (this.state.mode === mode) return;
    this.state.mode = mode;
    this.notify();
  }

  // ---- Drawing Tool ----

  setDrawingTool(tool: DrawingToolId): void {
    this.state.drawingTool = tool;
    this.state.mode = 'draw';
    this.notify();
  }

  // ---- Eraser ----

  setEraserMode(mode: EraserMode): void {
    this.state.eraserMode = mode;
    this.state.mode = 'erase';
    this.notify();
  }

  // ---- Shape ----

  setShapeTool(shape: ShapeToolMode): void {
    this.state.shapeTool = shape;
    this.state.mode = 'shape';
    this.notify();
  }

  // ---- Ink Properties ----

  setColor(color: string): void {
    this.state.color = color;
    this.notify();
  }

  setThickness(thickness: number): void {
    this.state.thickness = Math.max(0.5, Math.min(50, thickness));
    this.notify();
  }

  setOpacity(opacity: number): void {
    this.state.opacity = Math.max(0, Math.min(1, opacity));
    this.notify();
  }

  setPressureSensitivity(enabled: boolean): void {
    this.state.pressureSensitivity = enabled;
    this.notify();
  }

  setStabilization(level: number): void {
    this.state.stabilization = Math.max(0, Math.min(100, level));
    this.notify();
  }

  /** Reset to defaults. */
  reset(): void {
    this.state = { ...DEFAULT_TOOL_STATE };
    this.notify();
  }
}
