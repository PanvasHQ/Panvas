import { generateId } from '../../../lib/utils/id.ts';
import { createDefaultPageLayer, DEFAULT_PAGE_LAYER_ID, type PageLayer } from './drawingTypes.ts';

export class LayerManager {
  private layers: PageLayer[] = [createDefaultPageLayer()];
  private activeLayerId = DEFAULT_PAGE_LAYER_ID;
  private listeners = new Set<() => void>();

  getLayers(): ReadonlyArray<Readonly<PageLayer>> {
    return [...this.layers].sort((a, b) => a.order - b.order);
  }

  getActiveLayerId(): string {
    return this.activeLayerId;
  }

  setData(layers: PageLayer[] | undefined, activeLayerId: string | undefined): void {
    const valid = (layers ?? [])
      .filter(layer => layer && typeof layer.id === 'string' && layer.id.length > 0)
      .map((layer, order) => ({
        id: layer.id,
        name: String(layer.name || `Layer ${order + 1}`).slice(0, 80),
        visible: layer.visible !== false,
        locked: layer.locked === true,
        order,
      }));
    this.layers = valid.length > 0 ? valid : [createDefaultPageLayer()];
    const requested = this.layers.find(layer => layer.id === activeLayerId && layer.visible && !layer.locked);
    const editable = requested ?? this.layers.find(layer => layer.visible && !layer.locked) ?? this.layers[0];
    this.activeLayerId = editable.id;
    this.notify();
  }

  create(name?: string): PageLayer {
    const layer: PageLayer = {
      id: generateId('layer'),
      name: (name?.trim() || `Layer ${this.layers.length + 1}`).slice(0, 80),
      visible: true,
      locked: false,
      order: this.layers.length,
    };
    this.layers.push(layer);
    this.activeLayerId = layer.id;
    this.notify();
    return { ...layer };
  }

  rename(id: string, name: string): boolean {
    const layer = this.layers.find(item => item.id === id);
    const next = name.trim().slice(0, 80);
    if (!layer || !next || layer.name === next) return false;
    layer.name = next;
    this.notify();
    return true;
  }

  setActive(id: string): boolean {
    const layer = this.layers.find(item => item.id === id && item.visible && !item.locked);
    if (!layer || this.activeLayerId === id) return false;
    this.activeLayerId = id;
    this.notify();
    return true;
  }

  setVisible(id: string, visible: boolean): boolean {
    const layer = this.layers.find(item => item.id === id);
    if (!layer || layer.visible === visible) return false;
    layer.visible = visible;
    this.repairActiveLayer();
    this.notify();
    return true;
  }

  setLocked(id: string, locked: boolean): boolean {
    const layer = this.layers.find(item => item.id === id);
    if (!layer || layer.locked === locked) return false;
    layer.locked = locked;
    this.repairActiveLayer();
    this.notify();
    return true;
  }

  move(id: string, direction: -1 | 1): boolean {
    const ordered = [...this.layers].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return false;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    ordered.forEach((layer, order) => { layer.order = order; });
    this.layers = ordered;
    this.notify();
    return true;
  }

  remove(id: string): { removed: PageLayer; fallbackId: string } | null {
    if (this.layers.length <= 1) return null;
    const index = this.layers.findIndex(item => item.id === id);
    if (index < 0) return null;
    const [removed] = this.layers.splice(index, 1);
    this.layers.forEach((layer, order) => { layer.order = order; });
    this.repairActiveLayer();
    this.notify();
    return { removed, fallbackId: this.activeLayerId };
  }

  isVisible(layerId: string | undefined): boolean {
    return this.layers.find(item => item.id === (layerId ?? DEFAULT_PAGE_LAYER_ID))?.visible !== false;
  }

  isEditable(layerId: string | undefined): boolean {
    const layer = this.layers.find(item => item.id === (layerId ?? DEFAULT_PAGE_LAYER_ID));
    return Boolean(layer?.visible && !layer.locked);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private repairActiveLayer(): void {
    const active = this.layers.find(item => item.id === this.activeLayerId);
    if (active?.visible && !active.locked) return;
    const editable = this.layers.find(item => item.visible && !item.locked);
    if (editable) {
      this.activeLayerId = editable.id;
      return;
    }
    const fallback = this.layers[0];
    this.activeLayerId = fallback.id;
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}
