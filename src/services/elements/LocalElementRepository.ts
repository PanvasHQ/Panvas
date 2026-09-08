import { generateId } from '../../lib/utils/id.ts';
import type { ImageObject, Shape, Stroke, TextObject } from '@/components/notebook/engine/drawingTypes';

export interface ElementSnapshot {
  type: 'panvas/elements';
  strokes: Stroke[];
  shapes: Shape[];
  texts: TextObject[];
  images: ImageObject[];
}

export interface LocalElement {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  snapshot: ElementSnapshot;
  builtin?: boolean;
}

function starterText(id: string, text: string, background: string, name: string, shape: string = 'rounded-rect'): LocalElement {
  const now = 0;
  return {
    id, workspaceId: 'builtin', name, category: 'Starter', favorite: false, builtin: true, createdAt: now, updatedAt: now,
    snapshot: {
      type: 'panvas/elements', strokes: [], shapes: [], images: [], texts: [{
        id: `${id}-text`, type: 'text', x: 80, y: 80, width: 190, height: 90, createdAt: now,
        content: { type: 'doc', content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }] },
        metadata: {
          isStickyNote: true,
          color: background,
          shape,
          pastePresentation: 'sticky-note',
          elementBackground: background,
        },
      }],
    },
  };
}

export function getStarterElements(): LocalElement[] {
  return [
    starterText('builtin-sticky-yellow', '', '#fff1a8', 'Yellow sticky note'),
    starterText('builtin-sticky-mint', 'Key idea', '#c9f4df', 'Mint sticky note'),
    starterText('builtin-emoji-star', '⭐ Important', '#f8e7b0', 'Important stamp'),
  ];
}

const STORAGE_KEY = 'elements.v1';
const MAX_ELEMENTS = 200;
const MAX_OBJECTS_PER_ELEMENT = 250;
const MAX_SERIALIZED_BYTES = 2 * 1024 * 1024;

function finite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function validObject(value: unknown, type: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const object = value as Record<string, unknown>;
  if (object.type !== type || typeof object.id !== 'string') return false;
  if (type === 'stroke') return Array.isArray(object.points) && object.points.length > 0 && object.points.length <= 20_000
    && object.points.every(point => point && finite(point.x) && finite(point.y));
  return finite(object.x) && finite(object.y);
}

export function validateElementSnapshot(value: unknown): ElementSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.type !== 'panvas/elements') return null;
  const strokes = Array.isArray(snapshot.strokes) ? snapshot.strokes.filter(item => validObject(item, 'stroke')) as Stroke[] : [];
  const shapes = Array.isArray(snapshot.shapes) ? snapshot.shapes.filter(item => validObject(item, 'shape')) as Shape[] : [];
  const texts = Array.isArray(snapshot.texts) ? snapshot.texts.filter(item => validObject(item, 'text')) as TextObject[] : [];
  const images = Array.isArray(snapshot.images) ? snapshot.images.filter(item => validObject(item, 'image')) as ImageObject[] : [];
  if (strokes.length + shapes.length + texts.length + images.length === 0) return null;
  if (strokes.length + shapes.length + texts.length + images.length > MAX_OBJECTS_PER_ELEMENT) return null;
  const result: ElementSnapshot = { type: 'panvas/elements', strokes, shapes, texts, images };
  return JSON.stringify(result).length <= MAX_SERIALIZED_BYTES ? structuredClone(result) : null;
}

export function serializeSnapshotForComparison(snapshot: ElementSnapshot): string {
  const points = [...snapshot.strokes.flatMap(stroke => stroke.points), ...snapshot.shapes, ...snapshot.texts, ...snapshot.images];
  const minX = Math.min(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const normalize = (object: Stroke | Shape | TextObject | ImageObject) => {
    const { id, createdAt, layerId, ...rest } = structuredClone(object);
    if (rest.type === 'stroke') {
      rest.points = rest.points.map(point => ({ ...point, x: point.x - minX, y: point.y - minY }));
    } else { rest.x -= minX; rest.y -= minY; }
    return rest;
  };
  return JSON.stringify({ strokes: snapshot.strokes.map(normalize), shapes: snapshot.shapes.map(normalize), texts: snapshot.texts.map(normalize), images: snapshot.images.map(normalize) });
}

function validateElement(value: unknown, workspaceId: string): LocalElement | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<LocalElement>;
  const snapshot = validateElementSnapshot(item.snapshot);
  if (!snapshot || typeof item.id !== 'string' || typeof item.name !== 'string') return null;
  return {
    id: item.id,
    workspaceId,
    name: item.name.trim().slice(0, 100) || 'Untitled element',
    category: typeof item.category === 'string' ? item.category.trim().slice(0, 60) || 'My elements' : 'My elements',
    favorite: item.favorite === true,
    createdAt: finite(item.createdAt) ? item.createdAt! : Date.now(),
    updatedAt: finite(item.updatedAt) ? item.updatedAt! : Date.now(),
    snapshot,
  };
}

class LocalElementRepository {
  async getAll(workspaceId: string): Promise<LocalElement[]> {
    let raw: unknown;
    if (typeof window !== 'undefined' && window.panvas) raw = await window.panvas.settings.get(workspaceId, STORAGE_KEY);
    else {
      try { raw = JSON.parse(localStorage.getItem(`panvas.${workspaceId}.${STORAGE_KEY}`) ?? '[]'); }
      catch { raw = []; }
    }
    return (Array.isArray(raw) ? raw : [])
      .slice(0, MAX_ELEMENTS)
      .map(item => validateElement(item, workspaceId))
      .filter((item): item is LocalElement => Boolean(item))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  }

  async saveAll(workspaceId: string, elements: LocalElement[]): Promise<void> {
    const valid = elements.slice(0, MAX_ELEMENTS)
      .map(item => validateElement(item, workspaceId))
      .filter((item): item is LocalElement => Boolean(item));
    if (typeof window !== 'undefined' && window.panvas) await window.panvas.settings.set(workspaceId, STORAGE_KEY, valid);
    else localStorage.setItem(`panvas.${workspaceId}.${STORAGE_KEY}`, JSON.stringify(valid));
  }

  async create(workspaceId: string, snapshotValue: unknown, name: string): Promise<LocalElement> {
    const snapshot = validateElementSnapshot(snapshotValue);
    if (!snapshot) throw new Error('Select at least one supported object before creating an Element.');
    const existing = await this.getAll(workspaceId);
    if (existing.length >= MAX_ELEMENTS) throw new Error(`This workspace already has the ${MAX_ELEMENTS}-Element local limit.`);

    const newKey = serializeSnapshotForComparison(snapshot);
    const allKnown = [...getStarterElements(), ...existing];
    const isDuplicate = allKnown.some(item => serializeSnapshotForComparison(item.snapshot) === newKey);
    if (isDuplicate) {
      throw new Error('This element has already been saved to your collection.');
    }

    const now = Date.now();
    const element: LocalElement = {
      id: generateId('element'), workspaceId, name: name.trim().slice(0, 100) || `Element ${existing.length + 1}`,
      category: 'My elements', favorite: false, createdAt: now, updatedAt: now, snapshot,
    };
    await this.saveAll(workspaceId, [element, ...existing]);
    return element;
  }

  async update(workspaceId: string, id: string, changes: Pick<Partial<LocalElement>, 'name' | 'category' | 'favorite'>): Promise<LocalElement[]> {
    const existing = await this.getAll(workspaceId);
    const updated = existing.map(item => item.id === id ? {
      ...item,
      ...(typeof changes.name === 'string' ? { name: changes.name.trim().slice(0, 100) || item.name } : {}),
      ...(typeof changes.category === 'string' ? { category: changes.category.trim().slice(0, 60) || item.category } : {}),
      ...(typeof changes.favorite === 'boolean' ? { favorite: changes.favorite } : {}),
      updatedAt: Date.now(),
    } : item);
    await this.saveAll(workspaceId, updated);
    return this.getAll(workspaceId);
  }

  async remove(workspaceId: string, id: string): Promise<LocalElement[]> {
    await this.saveAll(workspaceId, (await this.getAll(workspaceId)).filter(item => item.id !== id));
    return this.getAll(workspaceId);
  }

  async importCollection(workspaceId: string, value: unknown): Promise<LocalElement[]> {
    if (!value || typeof value !== 'object') throw new Error('Invalid Panvas Elements collection.');
    const incoming = (value as { format?: unknown; elements?: unknown }).elements;
    if ((value as { format?: unknown }).format !== 'panvas-elements' || !Array.isArray(incoming)) {
      throw new Error('Invalid Panvas Elements collection.');
    }
    const existing = await this.getAll(workspaceId);
    const now = Date.now();
    const imported = incoming.slice(0, MAX_ELEMENTS).map(item => {
      const candidate = validateElement(item, workspaceId);
      return candidate ? { ...candidate, id: generateId('element'), createdAt: now, updatedAt: now } : null;
    }).filter((item): item is LocalElement => Boolean(item));
    if (imported.length === 0) throw new Error('The collection contains no supported Elements.');
    await this.saveAll(workspaceId, [...imported, ...existing].slice(0, MAX_ELEMENTS));
    return this.getAll(workspaceId);
  }

  async exportCollection(workspaceId: string): Promise<{ format: 'panvas-elements'; version: 1; elements: LocalElement[] }> {
    return { format: 'panvas-elements', version: 1, elements: await this.getAll(workspaceId) };
  }
}

export const localElementRepository = new LocalElementRepository();
