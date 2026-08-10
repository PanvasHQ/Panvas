// ============================================
// Panvas — Text Manager
// ============================================
// Handles state for text boxes.

import type { TextObject } from './drawingTypes';

export class TextManager {
  private texts: TextObject[] = [];
  private editors: Map<string, any> = new Map(); // Store Editor instances

  registerEditor(id: string, editor: any): void {
    this.editors.set(id, editor);
  }

  unregisterEditor(id: string): void {
    this.editors.delete(id);
  }

  getEditor(id: string): any | undefined {
    return this.editors.get(id);
  }

  getTexts(): TextObject[] {
    return this.texts;
  }

  setTexts(texts: TextObject[]): void {
    this.texts = texts;
  }

  addText(text: TextObject): void {
    this.texts.push(text);
  }

  updateTextContent(id: string, content: any): void {
    const text = this.texts.find(t => t.id === id);
    if (text) {
      text.content = content;
    }
  }

  updateTextBounds(id: string, width: number, height: number): void {
    const text = this.texts.find(t => t.id === id);
    if (text) {
      text.width = width;
      text.height = height;
    }
  }

  removeText(id: string): TextObject | undefined {
    const index = this.texts.findIndex(t => t.id === id);
    if (index === -1) return undefined;
    const [removed] = this.texts.splice(index, 1);
    return removed;
  }

  removeTexts(ids: Set<string>): TextObject[] {
    const removed: TextObject[] = [];
    this.texts = this.texts.filter(t => {
      if (ids.has(t.id)) {
        removed.push(t);
        return false;
      }
      return true;
    });
    return removed;
  }

  clearTexts(): TextObject[] {
    const removed = this.texts;
    this.texts = [];
    return removed;
  }
}
