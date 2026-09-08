import type { AudioNote } from './drawingTypes.ts';

export class AudioNoteManager {
  private notes: AudioNote[] = [];
  private listeners = new Set<() => void>();

  getAll(): ReadonlyArray<Readonly<AudioNote>> {
    return this.notes;
  }

  setAll(notes: AudioNote[] | undefined): void {
    this.notes = (notes ?? []).filter(note => note && typeof note.id === 'string' && typeof note.fileId === 'string').map(note => ({ ...note }));
    this.notify();
  }

  add(note: AudioNote): void {
    this.notes.push({ ...note });
    this.notify();
  }

  remove(id: string): AudioNote | undefined {
    const index = this.notes.findIndex(note => note.id === id);
    if (index < 0) return undefined;
    const [removed] = this.notes.splice(index, 1);
    this.notify();
    return removed;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }
}
