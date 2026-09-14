import type { NotebookEngine } from '../../components/notebook/engine/NotebookEngine';
import type { AudioNote, TextObject } from '../../components/notebook/engine/drawingTypes.ts';
import { isVoiceNoteObject } from './voiceNoteObjects.ts';

export interface VoiceState { notes: AudioNote[]; objects: TextObject[] }
export function captureVoiceState(engine: NotebookEngine): VoiceState {
  return structuredClone({ notes: [...engine.audio.getAll()], objects: engine.texts.getTexts().filter(isVoiceNoteObject) });
}
/** One document operation shared by the page and management panel. Assets are retained for undo. */
export function changeVoiceNote(engine: NotebookEngine, noteId: string, change: { delete: true } | { title: string }, persist: (state: VoiceState) => void): void {
  const before = captureVoiceState(engine);
  const after = structuredClone(before);
  if ('delete' in change) {
    after.notes = after.notes.filter(note => note.id !== noteId);
    after.objects = after.objects.filter(object => object.metadata?.audioNoteId !== noteId);
  } else {
    const note = after.notes.find(item => item.id === noteId);
    if (note) note.title = change.title.trim() || 'Voice note';
  }
  const apply = (state: VoiceState) => {
    engine.texts.setTexts([...engine.texts.getTexts().filter(object => !isVoiceNoteObject(object)), ...structuredClone(state.objects)]);
    engine.audio.setAll(state.notes);
    engine.selection.clearSelection();
    persist(structuredClone(state));
    engine.input.notifyChange();
  };
  engine.history.push({ description: 'delete' in change ? 'Delete voice note' : 'Rename voice note', execute: () => apply(after), undo: () => apply(before) });
}

export function changeVoiceObject(engine: NotebookEngine, id: string, updates: Partial<TextObject>): void {
  const object = engine.texts.getTexts().find(item => item.id === id);
  if (!object) return;
  const before = structuredClone(object);
  const after = { ...before, ...updates };
  const apply = (value: TextObject) => { engine.texts.replaceText(structuredClone(value)); engine.input.notifyChange(); };
  engine.history.push({ description: 'Change voice note appearance', execute: () => apply(after), undo: () => apply(before) });
}
