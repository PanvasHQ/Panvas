// ============================================
// Panvas — Notebook Engine (Orchestrator)
// ============================================
// Ties all managers together into one notebook engine instance.
// React components interact with this single object.

import type { DrawingData, Stroke, Shape, PageProperties } from './drawingTypes';
import { createEmptyDrawingData } from './drawingTypes';
import { ViewportManager } from './ViewportManager';
import { ToolManager } from './ToolManager';
import { HistoryManager } from './HistoryManager';
import { DrawingEngine } from './DrawingEngine';
import { EraserEngine } from './EraserEngine';
import { ShapeManager } from './ShapeManager';
import { TextManager } from './TextManager';
import { ImageManager } from './ImageManager';
import { SelectionEngine } from './SelectionEngine';
import { InputManager } from './InputManager';

export class NotebookEngine {
  readonly viewport: ViewportManager;
  readonly tools: ToolManager;
  readonly history: HistoryManager;
  readonly drawing: DrawingEngine;
  readonly eraser: EraserEngine;
  readonly shapes: ShapeManager;
  readonly texts: TextManager;
  readonly images: ImageManager;
  readonly selection: SelectionEngine;
  readonly input: InputManager;

  private properties: PageProperties;
  private propertiesListeners: Set<(props: Readonly<PageProperties>) => void> = new Set();

  constructor() {
    this.viewport = new ViewportManager();
    this.tools = new ToolManager();
    this.history = new HistoryManager();
    this.shapes = new ShapeManager(this.viewport);
    this.texts = new TextManager();
    this.images = new ImageManager(this.viewport);
    this.drawing = new DrawingEngine(this.viewport, this.shapes, this.images);
    this.eraser = new EraserEngine(this.drawing, this.history);
    this.eraser.setShapeManager(this.shapes);
    this.selection = new SelectionEngine(this.drawing, this.shapes, this.history, this.viewport, this.texts, this.images);
    this.drawing.setSelectionEngine(this.selection);
    this.input = new InputManager(this.tools, this.viewport, this.drawing, this.eraser, this.shapes, this.selection, this.history, this.texts);
    this.properties = createEmptyDrawingData().properties;
    
    // Wire up redraw callback
    this.images.setRedrawCallback(() => this.drawing.redraw());
  }

  // ---- Canvas Lifecycle ----

  /** Bind the engine to a canvas element. Call once after the canvas mounts. */
  mount(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): void {
    this.drawing.setCanvas(canvas, cssWidth, cssHeight);
    this.input.attach(canvas);
    this.drawing.redraw();
  }

  /** Unbind input from a canvas remount without discarding page resources. */
  unmount(): void {
    this.input.detach();
  }

  /** Handle canvas resize. */
  resize(cssWidth: number, cssHeight: number): void {
    this.drawing.resize(cssWidth, cssHeight);
  }

  // ---- Data Serialization ----

  /** Get all drawing data for persistence. */
  getDrawingData(): DrawingData {
    return {
      version: 2,
      objects: [
        ...this.drawing.getStrokes(),
        ...this.shapes.getShapes(),
        ...this.texts.getTexts(),
        ...this.images.getImages(),
      ],
      properties: { ...this.properties },
    };
  }

  /** Load drawing data (e.g., from disk). Replaces current state. */
  setDrawingData(data: DrawingData | null): void {
    if (!data) {
      this.drawing.setStrokes([]);
      this.shapes.setShapes([]);
      this.texts.setTexts([]);
      this.images.clearImages();
      this.properties = createEmptyDrawingData().properties;
    } else {
      if (data.version === 1) {
        this.drawing.setStrokes(data.strokes || []);
        this.shapes.setShapes(data.shapes || []);
        this.texts.setTexts([]);
        this.images.clearImages();
      } else {
        const objects = data.objects || [];
        this.drawing.setStrokes(objects.filter(o => o.type === 'stroke') as Stroke[]);
        this.shapes.setShapes(objects.filter(o => o.type === 'shape') as Shape[]);
        this.texts.setTexts(objects.filter(o => o.type === 'text') as any[]);
        this.images.setImages(objects.filter(o => o.type === 'image') as any[]);
      }
      this.properties = { ...createEmptyDrawingData().properties, ...(data.properties || {}) };
    }
    this.history.clear();
    this.drawing.redraw();
    this.notifyPropertiesChange();
  }

  // ---- Page Properties ----

  getProperties(): Readonly<PageProperties> {
    return this.properties;
  }

  setProperties(updates: Partial<PageProperties>): void {
    this.properties = { ...this.properties, ...updates };
    this.notifyPropertiesChange();
  }

  onPropertiesChange(listener: (props: Readonly<PageProperties>) => void): () => void {
    this.propertiesListeners.add(listener);
    return () => this.propertiesListeners.delete(listener);
  }

  private notifyPropertiesChange(): void {
    this.propertiesListeners.forEach(listener => listener(this.properties));
  }

  // ---- Cleanup ----

  destroy(): void {
    this.unmount();
    this.images.destroy();
    this.history.clear();
    this.tools.reset();
  }
}
