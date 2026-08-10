// ============================================
// Panvas — Selection Engine
// ============================================
// Handles selecting, moving, resizing, and deleting strokes/shapes.

import type { SelectedElement, BoundingBox, Stroke } from './drawingTypes';
import type { DrawingEngine } from './DrawingEngine';
import type { ShapeManager } from './ShapeManager';
import type { HistoryManager } from './HistoryManager';
import type { ViewportManager } from './ViewportManager';
import type { TextManager } from './TextManager';
import type { ImageManager } from './ImageManager';
import { generateId } from '@/lib/utils/id';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | null;

export class SelectionEngine {
  private drawingEngine: DrawingEngine;
  private shapeManager: ShapeManager;
  private historyManager: HistoryManager;
  private viewport: ViewportManager;
  private textManager: TextManager;
  private imageManager: ImageManager;

  private selectedIds: Set<string> = new Set();
  private selectedElements: SelectedElement[] = [];
  
  // Drag state
  private isDragging = false;
  private dragMode: 'move' | ResizeHandle = 'move';
  private dragStartX = 0;
  private dragStartY = 0;
  
  // Undo state
  private originalPositions: Map<string, any> = new Map();
  private originalBox: BoundingBox | null = null;

  constructor(drawingEngine: DrawingEngine, shapeManager: ShapeManager, historyManager: HistoryManager, viewport: ViewportManager, textManager: TextManager, imageManager: ImageManager) {
    this.drawingEngine = drawingEngine;
    this.shapeManager = shapeManager;
    this.historyManager = historyManager;
    this.viewport = viewport;
    this.textManager = textManager;
    this.imageManager = imageManager;
  }

  getSelectedElements(): SelectedElement[] {
    return this.selectedElements;
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.selectedElements = [];
    this.drawingEngine.redraw();
  }

  deleteSelection(): void {
    if (this.selectedElements.length === 0) return;
    const elements = [...this.selectedElements];
    
    // Store exact references for undo
    const strokesToRestore: any[] = [];
    const shapesToRestore: any[] = [];
    const imagesToRestore: any[] = [];

    this.historyManager.push({
      description: 'Delete selection',
      execute: () => {
        const strokeIds = new Set<string>();
        const shapeIds = new Set<string>();
        const textIds = new Set<string>();
        const imageIds = new Set<string>();
        for (const el of elements) {
          if (el.type === 'stroke') strokeIds.add(el.id);
          else if (el.type === 'shape') shapeIds.add(el.id);
          else if (el.type === 'text') textIds.add(el.id);
          else if (el.type === 'image') imageIds.add(el.id);
        }
        const removedStrokes = this.drawingEngine.removeStrokes(strokeIds);
        strokesToRestore.length = 0;
        strokesToRestore.push(...removedStrokes);
        
        const removedShapes = this.shapeManager.removeShapes(shapeIds);
        shapesToRestore.length = 0;
        shapesToRestore.push(...removedShapes);

        const removedTexts = this.textManager.removeTexts(textIds);
        
        const removedImages = this.imageManager.removeImages(imageIds);
        imagesToRestore.length = 0;
        imagesToRestore.push(...removedImages);

        this.clearSelection();
      },
      undo: () => {
        for (const s of strokesToRestore) this.drawingEngine.addStroke(s);
        for (const s of shapesToRestore) this.shapeManager.addShape(s);
        for (const img of imagesToRestore) this.imageManager.addImage(img);
        this.selectedElements = [...elements];
        this.selectedIds = new Set(elements.map(e => e.id));
        this.drawingEngine.redraw();
      }
    });
  }

  changeColor(color: string, toolFilter?: string): boolean {
    if (this.selectedElements.length === 0) return false;

    const elements = [...this.selectedElements];
    const origMap = new Map<string, string>();
    const finalMap = new Map<string, string>();

    for (const el of elements) {
      if (el.type === 'stroke') {
        const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
        if (stroke && (!toolFilter || stroke.tool === toolFilter)) {
          origMap.set(el.id, stroke.color);
          finalMap.set(el.id, color);
          stroke.color = color;
        }
      }
    }

    if (origMap.size === 0) return false;

    this.historyManager.push({
      description: 'Change color',
      execute: () => {
        for (const el of elements) {
          const finalColor = finalMap.get(el.id);
          if (!finalColor) continue;
          if (el.type === 'stroke') {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) stroke.color = finalColor;
          }
        }
        this.drawingEngine.redraw();
      },
      undo: () => {
        for (const el of elements) {
          const origColor = origMap.get(el.id);
          if (!origColor) continue;
          if (el.type === 'stroke') {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) stroke.color = origColor;
          }
        }
        this.drawingEngine.redraw();
      }
    });

    this.drawingEngine.redraw();
    return true;
  }

  changeThickness(thickness: number, toolFilter?: string): boolean {
    if (this.selectedElements.length === 0) return false;

    const elements = [...this.selectedElements];
    const origMap = new Map<string, number>();
    const finalMap = new Map<string, number>();

    for (const el of elements) {
      if (el.type === 'stroke') {
        const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
        if (stroke && (!toolFilter || stroke.tool === toolFilter)) {
          origMap.set(el.id, stroke.thickness);
          finalMap.set(el.id, thickness);
          stroke.thickness = thickness;
        }
      }
    }

    if (origMap.size === 0) return false;

    this.historyManager.pushExecuted({
      description: 'Change thickness',
      execute: () => {
        for (const el of elements) {
          const finalThickness = finalMap.get(el.id);
          if (finalThickness === undefined) continue;
          if (el.type === 'stroke') {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) stroke.thickness = finalThickness;
          }
        }
        this.drawingEngine.redraw();
      },
      undo: () => {
        for (const el of elements) {
          const origThickness = origMap.get(el.id);
          if (origThickness === undefined) continue;
          if (el.type === 'stroke') {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) stroke.thickness = origThickness;
          }
        }
        this.drawingEngine.redraw();
      }
    });

    this.drawingEngine.redraw();
    return true;
  }

  changeOpacity(opacity: number, toolFilter?: string): boolean {
    if (this.selectedElements.length === 0) return false;

    const elements = [...this.selectedElements];
    const origMap = new Map<string, number>();
    const finalMap = new Map<string, number>();

    for (const el of elements) {
      if (el.type === 'stroke') {
        const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
        if (stroke && (!toolFilter || stroke.tool === toolFilter)) {
          origMap.set(el.id, stroke.opacity);
          finalMap.set(el.id, opacity);
          stroke.opacity = opacity;
        }
      }
    }

    if (origMap.size === 0) return false;

    this.historyManager.pushExecuted({
      description: 'Change opacity',
      execute: () => {
        for (const el of elements) {
          const finalOpacity = finalMap.get(el.id);
          if (finalOpacity === undefined) continue;
          if (el.type === 'stroke') {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) stroke.opacity = finalOpacity;
          }
        }
        this.drawingEngine.redraw();
      },
      undo: () => {
        for (const el of elements) {
          const origOpacity = origMap.get(el.id);
          if (origOpacity === undefined) continue;
          if (el.type === 'stroke') {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) stroke.opacity = origOpacity;
          }
        }
        this.drawingEngine.redraw();
      }
    });

    this.drawingEngine.redraw();
    return true;
  }

  private getHandleAt(x: number, y: number): { id: string, handle: ResizeHandle } | null {
    const handleSize = 10;
    const h2 = handleSize / 2;

    // Check backwards (top-most elements first)
    for (let i = this.selectedElements.length - 1; i >= 0; i--) {
      const el = this.selectedElements[i];
      const box = this.getBoundingBox(el);
      if (!box) continue;

      const corners = [
        { handle: 'tl' as ResizeHandle, cx: box.x - 4, cy: box.y - 4 },
        { handle: 'tr' as ResizeHandle, cx: box.x + box.width + 4, cy: box.y - 4 },
        { handle: 'bl' as ResizeHandle, cx: box.x - 4, cy: box.y + box.height + 4 },
        { handle: 'br' as ResizeHandle, cx: box.x + box.width + 4, cy: box.y + box.height + 4 }
      ];

      for (const c of corners) {
        if (x >= c.cx - h2 && x <= c.cx + h2 && y >= c.cy - h2 && y <= c.cy + h2) {
          return { id: el.id, handle: c.handle };
        }
      }
    }
    return null;
  }

  /** Select element at given coordinates (pointer down). */
  selectAt(x: number, y: number, shiftKey: boolean = false): boolean {
    const handleHit = this.getHandleAt(x, y);
    if (handleHit) {
      // User clicked a resize handle of an already selected element
      return true;
    }

    // Check if we clicked inside an already selected element (to move it)
    for (const el of this.selectedElements) {
      const box = this.getBoundingBox(el);
      if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        return true; 
      }
    }

    let hitId: string | null = null;
    let hitType: 'stroke' | 'shape' | 'text' | 'image' | null = null;

    // Check texts first (drawn on top)
    const texts = this.textManager.getTexts();
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + (t.height || 100)) {
        hitId = t.id;
        hitType = 'text';
        break;
      }
    }

    if (!hitId) {
      // Check shapes first (they are drawn on top)
      const shapeHits = this.shapeManager.findShapesNearPoint(x, y, 5);
      if (shapeHits.length > 0) {
        hitId = shapeHits[shapeHits.length - 1]; // top-most
        hitType = 'shape';
      } else {
        // Check strokes
        const strokeHits = this.drawingEngine.findStrokesNearPoint(x, y, 5);
        if (strokeHits.length > 0) {
          hitId = strokeHits[strokeHits.length - 1]; // top-most
          hitType = 'stroke';
        } else {
          // Check images (bottom-most)
          const images = this.imageManager.getImages();
          for (let i = images.length - 1; i >= 0; i--) {
            const img = images[i];
            if (x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height) {
              hitId = img.id;
              hitType = 'image';
              break;
            }
          }
        }
      }
    }

    if (hitId && hitType) {
      if (!shiftKey) {
        this.clearSelection();
      }

      if (this.selectedIds.has(hitId)) {
        if (shiftKey) {
          this.selectedIds.delete(hitId);
          this.selectedElements = this.selectedElements.filter(e => e.id !== hitId);
        }
      } else {
        this.selectedIds.add(hitId);
        this.selectedElements.push({ type: hitType, id: hitId });
      }
      this.drawingEngine.redraw();
      return true;
    }

    if (!shiftKey) {
      this.clearSelection();
    }
    return false;
  }

  private internalClipboard = '';

  // ---- Copy / Paste ----

  async copySelection(): Promise<void> {
    if (this.selectedElements.length === 0) return;
    
    const strokesToCopy: Stroke[] = [];
    const shapesToCopy: any[] = [];
    const textsToCopy: any[] = [];
    const imagesToCopy: any[] = [];
    
    const allStrokes = this.drawingEngine.getStrokes();
    const allShapes = this.shapeManager.getShapes();
    const allTexts = this.textManager.getTexts();
    const allImages = this.imageManager.getImages();
    
    for (const el of this.selectedElements) {
      if (el.type === 'stroke') {
        const stroke = allStrokes.find(s => s.id === el.id);
        if (stroke) strokesToCopy.push(stroke);
      } else if (el.type === 'shape') {
        const shape = allShapes.find(s => s.id === el.id);
        if (shape) shapesToCopy.push(shape);
      } else if (el.type === 'text') {
        const text = allTexts.find(s => s.id === el.id);
        if (text) textsToCopy.push(text);
      } else if (el.type === 'image') {
        const img = allImages.find(s => s.id === el.id);
        if (img) imagesToCopy.push(img);
      }
    }
    
    const clipboardData = {
      type: 'panvas/elements',
      strokes: strokesToCopy,
      shapes: shapesToCopy,
      texts: textsToCopy,
      images: imagesToCopy,
    };
    
    const jsonStr = JSON.stringify(clipboardData);
    this.internalClipboard = jsonStr; // Always store internally for fallback
    
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(jsonStr);
      }
    } catch (e) {
      console.warn('Native clipboard unavailable or failed, using internal clipboard fallback.', e);
    }
  }

  async cutSelection(): Promise<void> {
    await this.copySelection();
    this.deleteSelection();
  }

  selectAll(): void {
    this.clearSelection();
    for (const s of this.drawingEngine.getStrokes()) {
      this.selectedIds.add(s.id);
      this.selectedElements.push({ type: 'stroke', id: s.id });
    }
    for (const sh of this.shapeManager.getShapes()) {
      this.selectedIds.add(sh.id);
      this.selectedElements.push({ type: 'shape', id: sh.id });
    }
    for (const t of this.textManager.getTexts()) {
      this.selectedIds.add(t.id);
      this.selectedElements.push({ type: 'text', id: t.id });
    }
    for (const img of this.imageManager.getImages()) {
      this.selectedIds.add(img.id);
      this.selectedElements.push({ type: 'image', id: img.id });
    }
    this.drawingEngine.redraw();
  }

  async duplicateSelection(): Promise<void> {
    if (this.selectedElements.length === 0) return;
    await this.copySelection();
    await this.pasteSelection();
  }

  async pasteSelection(): Promise<void> {
    try {
      let text = '';
      try {
        if (navigator.clipboard) {
          text = await navigator.clipboard.readText();
        }
      } catch (e) {
        // Native clipboard failed or denied permission
      }
      
      // Fallback to internal clipboard if native failed or returned empty
      if (!text && this.internalClipboard) {
        text = this.internalClipboard;
      }

      if (!text) return;
      
      const data = JSON.parse(text);
      if (data?.type !== 'panvas/elements') return;
      
      const newStrokes: Stroke[] = [];
      const newShapes: any[] = [];
      const newTexts: any[] = [];
      const newImages: any[] = [];
      
      this.clearSelection();
      
      if (data.strokes) {
        for (const s of data.strokes) {
          const newStroke = { ...s, id: generateId('strk') };
          // offset points by +20, +20
          newStroke.points = newStroke.points.map((p: any) => ({ ...p, x: p.x + 20, y: p.y + 20 }));
          newStrokes.push(newStroke);
        }
      }
      
      if (data.shapes) {
        for (const s of data.shapes) {
          const newShape = { ...s, id: generateId('shp'), x: s.x + 20, y: s.y + 20 };
          newShapes.push(newShape);
        }
      }
      
      if (data.texts) {
        for (const t of data.texts) {
          const newText = { ...t, id: generateId('txt'), x: t.x + 20, y: t.y + 20 };
          newTexts.push(newText);
        }
      }

      if (data.images) {
        for (const img of data.images) {
          const newImg = { ...img, id: generateId('img'), x: img.x + 20, y: img.y + 20 };
          newImages.push(newImg);
        }
      }
      
      if (newStrokes.length === 0 && newShapes.length === 0 && newTexts.length === 0 && newImages.length === 0) return;

      // Add to history and engines
      this.historyManager.push({
        description: 'Paste elements',
        execute: () => {
          newStrokes.forEach(s => this.drawingEngine.addStroke(s));
          newShapes.forEach(s => this.shapeManager.addShape(s));
          newTexts.forEach(t => this.textManager.addText(t));
          newImages.forEach(i => this.imageManager.addImage(i));
          
          this.clearSelection();
          newStrokes.forEach(s => {
            this.selectedElements.push({ type: 'stroke', id: s.id });
            this.selectedIds.add(s.id);
          });
          newShapes.forEach(s => {
            this.selectedElements.push({ type: 'shape', id: s.id });
            this.selectedIds.add(s.id);
          });
          newTexts.forEach(s => {
            this.selectedElements.push({ type: 'text', id: s.id });
            this.selectedIds.add(s.id);
          });
          newImages.forEach(s => {
            this.selectedElements.push({ type: 'image', id: s.id });
            this.selectedIds.add(s.id);
          });
          this.drawingEngine.redraw();
        },
        undo: () => {
          this.clearSelection();
          const strokeIds = new Set(newStrokes.map(s => s.id));
          const shapeIds = new Set(newShapes.map(s => s.id));
          const textIds = new Set(newTexts.map(s => s.id));
          const imageIds = new Set(newImages.map(s => s.id));
          this.drawingEngine.removeStrokes(strokeIds);
          this.shapeManager.removeShapes(shapeIds);
          this.textManager.removeTexts(textIds);
          this.imageManager.removeImages(imageIds);
          this.drawingEngine.redraw();
        }
      });
      
    } catch (e) {
      console.error('Failed to paste from clipboard', e);
    }
  }

  // ---- Dragging & Resizing ----

  startDrag(x: number, y: number): void {
    if (this.selectedElements.length === 0) return;
    this.isDragging = true;
    this.dragStartX = x;
    this.dragStartY = y;
    this.originalPositions.clear();

    const handleHit = this.getHandleAt(x, y);
    this.dragMode = handleHit ? handleHit.handle : 'move';

    // We can only resize one element at a time currently
    if (this.dragMode !== 'move' && this.selectedElements.length === 1) {
      this.originalBox = this.getBoundingBox(this.selectedElements[0]);
    } else {
      // Force move if multiple selected
      this.dragMode = 'move';
      this.originalBox = null;
    }

    // Snapshot original positions for undo
    for (const el of this.selectedElements) {
      if (el.type === 'shape') {
        const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
        if (shape) {
          this.originalPositions.set(el.id, { x: shape.x, y: shape.y, width: shape.width, height: shape.height });
        }
      } else if (el.type === 'text') {
        const text = this.textManager.getTexts().find(t => t.id === el.id);
        if (text) {
          this.originalPositions.set(el.id, { x: text.x, y: text.y, width: text.width, height: text.height });
        }
      } else if (el.type === 'image') {
        const img = this.imageManager.getImages().find(i => i.id === el.id);
        if (img) {
          this.originalPositions.set(el.id, { x: img.x, y: img.y, width: img.width, height: img.height, rotation: img.rotation });
        }
      } else {
        const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
        if (stroke) {
          // Deep copy points
          this.originalPositions.set(el.id, stroke.points.map(p => ({ ...p })));
        }
      }
    }
  }

  dragTo(x: number, y: number): void {
    if (!this.isDragging) return;
    
    if (this.dragMode === 'move') {
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;

      for (const el of this.selectedElements) {
        const orig = this.originalPositions.get(el.id);
        if (!orig) continue;

        if (el.type === 'shape') {
          const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
          if (shape) {
            shape.x = orig.x + dx;
            shape.y = orig.y + dy;
          }
        } else if (el.type === 'text') {
          const text = this.textManager.getTexts().find(t => t.id === el.id);
          if (text) {
            text.x = orig.x + dx;
            text.y = orig.y + dy;
          }
        } else if (el.type === 'image') {
          const img = this.imageManager.getImages().find(i => i.id === el.id);
          if (img) {
            img.x = orig.x + dx;
            img.y = orig.y + dy;
          }
        } else {
          const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
          if (stroke) {
            for (let i = 0; i < stroke.points.length; i++) {
              stroke.points[i].x = orig[i].x + dx;
              stroke.points[i].y = orig[i].y + dy;
            }
          }
        }
      }
    } else if (this.originalBox && this.selectedElements.length === 1) {
      // Resize logic
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      const el = this.selectedElements[0];
      const origPos = this.originalPositions.get(el.id);
      if (!origPos) return;

      let scaleX = 1;
      let scaleY = 1;
      let transX = 0;
      let transY = 0;

      const box = this.originalBox;
      
      if (this.dragMode === 'br') {
        scaleX = (box.width + dx) / box.width;
        scaleY = (box.height + dy) / box.height;
        transX = box.x;
        transY = box.y;
      } else if (this.dragMode === 'bl') {
        scaleX = (box.width - dx) / box.width;
        scaleY = (box.height + dy) / box.height;
        transX = box.x + box.width;
        transY = box.y;
      } else if (this.dragMode === 'tr') {
        scaleX = (box.width + dx) / box.width;
        scaleY = (box.height - dy) / box.height;
        transX = box.x;
        transY = box.y + box.height;
      } else if (this.dragMode === 'tl') {
        scaleX = (box.width - dx) / box.width;
        scaleY = (box.height - dy) / box.height;
        transX = box.x + box.width;
        transY = box.y + box.height;
      }

      // Prevent flipping or scaling to 0
      if (Math.abs(scaleX) < 0.05) scaleX = 0.05 * Math.sign(scaleX) || 0.05;
      if (Math.abs(scaleY) < 0.05) scaleY = 0.05 * Math.sign(scaleY) || 0.05;

      if (el.type === 'shape') {
        const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
        if (shape) {
          // Adjust position based on scale origin
          shape.width = Math.abs(origPos.width * scaleX);
          shape.height = Math.abs(origPos.height * scaleY);
          
          if (this.dragMode === 'br') {
            shape.x = transX; shape.y = transY;
          } else if (this.dragMode === 'bl') {
            shape.x = transX - shape.width; shape.y = transY;
          } else if (this.dragMode === 'tr') {
            shape.x = transX; shape.y = transY - shape.height;
          } else if (this.dragMode === 'tl') {
            shape.x = transX - shape.width; shape.y = transY - shape.height;
          }
        }
      } else if (el.type === 'text') {
        const text = this.textManager.getTexts().find(t => t.id === el.id);
        if (text) {
          text.width = Math.max(50, Math.abs(origPos.width * scaleX));
          
          if (this.dragMode === 'br') {
            text.x = transX; text.y = transY;
          } else if (this.dragMode === 'bl') {
            text.x = transX - text.width; text.y = transY;
          } else if (this.dragMode === 'tr') {
            text.x = transX; text.y = transY - (origPos.height * scaleY);
          } else if (this.dragMode === 'tl') {
            text.x = transX - text.width; text.y = transY - (origPos.height * scaleY);
          }
        }
      } else if (el.type === 'image') {
        const img = this.imageManager.getImages().find(i => i.id === el.id);
        if (img) {
          img.width = Math.max(20, Math.abs(origPos.width * scaleX));
          img.height = Math.max(20, Math.abs(origPos.height * scaleY));
          
          if (this.dragMode === 'br') {
            img.x = transX; img.y = transY;
          } else if (this.dragMode === 'bl') {
            img.x = transX - img.width; img.y = transY;
          } else if (this.dragMode === 'tr') {
            img.x = transX; img.y = transY - img.height;
          } else if (this.dragMode === 'tl') {
            img.x = transX - img.width; img.y = transY - img.height;
          }
        }
      } else {
        const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
        if (stroke) {
          for (let i = 0; i < stroke.points.length; i++) {
            stroke.points[i].x = transX + (origPos[i].x - transX) * scaleX;
            stroke.points[i].y = transY + (origPos[i].y - transY) * scaleY;
          }
        }
      }
    }
    
    this.drawingEngine.redraw();
  }

  finishDrag(x: number, y: number): boolean {
    if (!this.isDragging) return false;
    this.isDragging = false;

    const dx = x - this.dragStartX;
    const dy = y - this.dragStartY;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return false;

    const elements = [...this.selectedElements];
    const origMap = new Map(this.originalPositions);
    
    // Create deep copy of new state to save in history
    const finalMap = new Map();
    for (const el of elements) {
      if (el.type === 'shape') {
        const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
        if (shape) {
          finalMap.set(el.id, { x: shape.x, y: shape.y, width: shape.width, height: shape.height });
        }
      } else if (el.type === 'text') {
        const text = this.textManager.getTexts().find(t => t.id === el.id);
        if (text) {
          finalMap.set(el.id, { x: text.x, y: text.y, width: text.width, height: text.height });
        }
      } else {
        const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
        if (stroke) {
          finalMap.set(el.id, stroke.points.map(p => ({ ...p })));
        }
      }
    }

    this.historyManager.pushExecuted({
      description: this.dragMode === 'move' ? 'Move elements' : 'Resize element',
      execute: () => {
        for (const el of elements) {
          const finalState = finalMap.get(el.id);
          if (!finalState) continue;
          if (el.type === 'shape') {
            const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
            if (shape) {
              shape.x = finalState.x;
              shape.y = finalState.y;
              shape.width = finalState.width;
              shape.height = finalState.height;
            }
          } else if (el.type === 'text') {
            const text = this.textManager.getTexts().find(t => t.id === el.id);
            if (text) {
              text.x = finalState.x;
              text.y = finalState.y;
              text.width = finalState.width;
              text.height = finalState.height;
            }
          } else {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) {
              for (let i = 0; i < stroke.points.length; i++) {
                stroke.points[i].x = finalState[i].x;
                stroke.points[i].y = finalState[i].y;
              }
            }
          }
        }
        this.drawingEngine.redraw();
      },
      undo: () => {
        for (const el of elements) {
          const orig = origMap.get(el.id);
          if (!orig) continue;
          if (el.type === 'shape') {
            const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
            if (shape) {
              shape.x = orig.x;
              shape.y = orig.y;
              shape.width = orig.width;
              shape.height = orig.height;
            }
          } else if (el.type === 'text') {
            const text = this.textManager.getTexts().find(t => t.id === el.id);
            if (text) {
              text.x = orig.x;
              text.y = orig.y;
              text.width = orig.width;
              text.height = orig.height;
            }
          } else {
            const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
            if (stroke) {
              for (let i = 0; i < stroke.points.length; i++) {
                stroke.points[i].x = orig[i].x;
                stroke.points[i].y = orig[i].y;
              }
            }
          }
        }
        this.drawingEngine.redraw();
      }
    });

    return true;
  }

  // ---- Rendering Selection Bounding Boxes ----

  renderSelection(ctx: CanvasRenderingContext2D): void {
    if (this.selectedElements.length === 0) return;

    ctx.save();
    this.viewport.applyTransform(ctx);

    const scale = this.viewport.getState().scale;

    ctx.strokeStyle = '#3b82f6'; // Panvas blue
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([5 / scale, 5 / scale]);

    for (const el of this.selectedElements) {
      const box = this.getBoundingBox(el);
      if (box) {
        ctx.strokeRect(box.x - 4, box.y - 4, box.width + 8, box.height + 8);
        
        // Draw resize handles
        ctx.fillStyle = '#ffffff';
        ctx.setLineDash([]);
        const handleSize = 8 / scale;
        const h2 = handleSize / 2;
        
        const corners = [
          { x: box.x - 4, y: box.y - 4 },
          { x: box.x + box.width + 4, y: box.y - 4 },
          { x: box.x - 4, y: box.y + box.height + 4 },
          { x: box.x + box.width + 4, y: box.y + box.height + 4 }
        ];

        for (const c of corners) {
          ctx.strokeRect(c.x - h2, c.y - h2, handleSize, handleSize);
          ctx.fillRect(c.x - h2, c.y - h2, handleSize, handleSize);
        }
        ctx.setLineDash([5 / scale, 5 / scale]); // restore
      }
    }

    ctx.restore();
  }

  private getBoundingBox(el: SelectedElement): BoundingBox | null {
    if (el.type === 'shape') {
      const shape = this.shapeManager.getShapes().find(s => s.id === el.id);
      if (!shape) return null;
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    } else if (el.type === 'text') {
      const text = this.textManager.getTexts().find(t => t.id === el.id);
      if (!text) return null;
      return { x: text.x, y: text.y, width: text.width, height: text.height || 100 };
    } else if (el.type === 'image') {
      const img = this.imageManager.getImages().find(i => i.id === el.id);
      if (!img) return null;
      return { x: img.x, y: img.y, width: img.width, height: img.height };
    } else {
      const stroke = this.drawingEngine.getStrokes().find(s => s.id === el.id);
      if (!stroke || stroke.points.length === 0) return null;
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }
}
