import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Pencil, Play, Trash2 } from 'lucide-react';
import type { AudioNote, TextObject } from './engine/drawingTypes';
import type { NotebookEngine } from './engine/NotebookEngine';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useUIStore } from '@/stores/uiStore';
import { AudioPlaybackController, audioNoteTitle, createPlaybackBlob, formatAudioTime, type AudioPlaybackState } from '@/services/audio/audioLifecycle';
import { clampVoiceNoteRect, voiceNoteStyle, VOICE_NOTE_COLORS } from '@/services/audio/voiceNoteObjects';
import { changeVoiceObject } from '@/services/audio/voiceNoteCommands';
import { OverlayManager } from '@/components/ui/OverlayManager';

const idle: AudioPlaybackState = { activeNoteId: null, status: 'idle', elapsedMs: 0, durationMs: 0 };

export function StaticVoiceNote({ object, note, offset = { x: 0, y: 0 } }: { object: TextObject; note?: AudioNote; offset?: { x: number; y: number } }) {
  if (!note) return null;
  return <div className="absolute z-20 rounded-xl border border-black/15 px-3 py-2" style={voiceNoteStyle(object, offset)}>
    <div className="flex items-center gap-2 text-xs font-semibold"><Mic size={14}/>{note.title || 'Voice note'}</div>
    <div className="mt-3 flex items-center gap-2 text-xs"><Play size={14}/><span className="h-1 flex-1 rounded bg-current opacity-30"/>{formatAudioTime(note.durationMs ?? 0)}</div>
  </div>;
}

export function NotebookVoiceNote({ object, note, engine, editable, onChange, onDelete, onRename, offset = { x: 0, y: 0 }, bounds }: {
  object: TextObject; note?: AudioNote; engine: NotebookEngine; scale: number; editable: boolean;
  onChange: () => void; onDelete: (note: AudioNote) => void; onRename: (note: AudioNote, title: string) => void;
  offset?: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
}) {
  const [playback, setPlayback] = useState(idle);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [selected, setSelected] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const player = useRef<AudioPlaybackController>();
  const root = useRef<HTMLDivElement>(null);
  const cleanup = useRef<() => void>();
  const showToast = useUIStore(state => state.showToast);
  useEffect(() => {
    const update = () => setSelected(engine.selection.getSelectedElements().some(item => item.id === object.id));
    update();
    return engine.selection.subscribe(update);
  }, [engine, object.id]);
  useEffect(() => () => { cleanup.current?.(); player.current?.destroy(); player.current = undefined; }, []);
  useEffect(() => {
    if (!note) { player.current?.clear(); setPlayback(idle); }
  }, [note?.id]);

  const play = async () => {
    try {
      if (!note) return;
      if (!player.current) {
        const controller = new AudioPlaybackController(new Audio(), URL);
        controller.subscribe(setPlayback);
        player.current = controller;
      }
      const controller = player.current;
      if (playback.activeNoteId === note.id) {
        if (playback.status === 'playing') return controller.pause();
        if (playback.status === 'ended') controller.seek(0);
        return controller.resume();
      }
      const asset = await canvasRepository.getAudio(note.fileId);
      if (player.current !== controller) return;
      if (!asset) throw new Error('This recording is unavailable on this device.');
      await controller.play(note.id, createPlaybackBlob(asset.data, asset.mimeType, note.mimeType), note.durationMs ?? 0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'This recording could not be played.', 'error');
    }
  };

  const beginTransform = (event: React.PointerEvent, resize: boolean) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    cleanup.current?.();
    engine.selection.selectElement(object.id, 'text');
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const start = structuredClone(engine.texts.getTexts().find(item => item.id === object.id) ?? object);
    const zoom = (root.current?.getBoundingClientRect().width ?? object.width) / object.width;
    const origin = { x: event.clientX, y: event.clientY };
    setTransforming(true);
    const apply = (value: TextObject) => { engine.texts.replaceText(structuredClone(value)); engine.input.notifyChange(); };
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - origin.x) / zoom;
      const dy = (next.clientY - origin.y) / zoom;
      const proposed = { x: resize ? start.x : start.x + dx, y: resize ? start.y : start.y + dy,
        width: start.width + (resize ? dx : 0), height: (start.height ?? 132) + (resize ? dy : 0) };
      const rect = clampVoiceNoteRect(proposed, bounds ?? { x: 0, y: 0, width: 10000, height: 10000 });
      apply({ ...start, ...rect });
    };
    const finish = (cancelled = false) => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', cancel);
      if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      cleanup.current = undefined;
      setTransforming(false);
      const after = structuredClone(engine.texts.getTexts().find(item => item.id === object.id) ?? start);
      if (cancelled) apply(start);
      else if (JSON.stringify(after) !== JSON.stringify(start)) engine.history.pushExecuted({
        description: resize ? 'Resize voice note' : 'Move voice note', execute: () => apply(after), undo: () => apply(start),
      });
      onChange();
    };
    const up = () => finish();
    const cancel = () => finish(true);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', cancel);
    cleanup.current = () => {
      target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', cancel);
    };
  };
  const title = note?.title || 'Voice note';
  const duration = playback.durationMs || note?.durationMs || 0;
  const style = voiceNoteStyle(object, offset);
  const setAppearance = (metadata: Record<string, unknown>) => {
    changeVoiceObject(engine, object.id, { metadata: { ...object.metadata, ...metadata } }); onChange();
  };
  if (!note) return null;
  return <>
    <div ref={root} className="absolute z-20 rounded-xl border border-black/15 pointer-events-auto"
      style={{ ...style, outline: selected ? '2px solid #609cff' : undefined }}
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button,input')) { event.stopPropagation(); return; }
        beginTransform(event, false);
      }}>
      <div className="flex h-9 items-center gap-2 px-3 cursor-move">
        <Mic size={14} className="shrink-0"/>
        {renaming ? <input autoFocus value={titleDraft} onChange={event => setTitleDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { onRename(note, titleDraft); setRenaming(false); } if (event.key === 'Escape') setRenaming(false); }}
          onBlur={() => setRenaming(false)} aria-label="Voice note name" className="min-w-0 flex-1 rounded border bg-transparent px-1 text-xs"/>
          : <span className="min-w-0 flex-1 truncate text-xs font-semibold" onDoubleClick={() => { if (editable) { setTitleDraft(title); setRenaming(true); } }}>{title}</span>}
      </div>
      <div className="flex items-center gap-2 px-3 pb-3">
        <button type="button" className="h-7 w-7 shrink-0 rounded-full border border-current/20 focus-ring" onClick={() => void play()} aria-label={playback.status === 'playing' ? 'Pause voice note' : 'Play voice note'}>{playback.status === 'playing' ? <Pause size={14} className="mx-auto"/> : <Play size={14} className="mx-auto"/>}</button>
        <input type="range" min={0} max={Math.max(1, duration)} value={Math.min(playback.elapsedMs, Math.max(1, duration))}
          disabled={!playback.activeNoteId || !duration} aria-label="Voice note playback position"
          onChange={event => player.current?.seek(Number(event.target.value))} className="min-w-0 flex-1 accent-current"/>
        <span className="text-[10px] tabular-nums">{formatAudioTime(duration)}</span>
      </div>
      {editable && selected && <button type="button" aria-label="Resize voice note" onPointerDown={event => beginTransform(event, true)} className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-blue-500 bg-white"/>}
    </div>
    <OverlayManager isOpen={editable && selected && !transforming && !renaming} onClose={() => engine.selection.clearSelection()} anchorRef={root} placement="bottom-start" offset={{ x: 0, y: 14 }}>
      <div className="panvas-floating-surface flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2 p-2 text-panvas-text-primary" data-notebook-navigation-ignore="true" onMouseDown={event => event.stopPropagation()}>
        <button type="button" aria-label="Rename voice note" onClick={() => { setTitleDraft(title); setRenaming(true); }}><Pencil size={14}/></button>
        <div className="flex gap-1" role="group" aria-label="Voice note color">{VOICE_NOTE_COLORS.map(color => <button key={color} type="button" aria-label={`Voice note color ${color}`} aria-pressed={style.backgroundColor === color} onClick={() => setAppearance({ voiceColor: color })} style={{ backgroundColor: color }} className="h-4 w-4 rounded-full border border-black/25 aria-pressed:ring-2 ring-blue-500"/>)}</div>
        <label className="flex items-center gap-1 text-[10px]">Opacity<select aria-label="Voice note opacity" value={Math.round(style.opacity * 100)} onChange={event => setAppearance({ voiceOpacity: Number(event.target.value) / 100 })} className="rounded border bg-panvas-bg-primary text-panvas-text-primary">{[0,10,20,30,40,50,60,70,80,90,100].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
        <button type="button" aria-label="Delete voice note" onClick={() => onDelete(note)}><Trash2 size={14}/></button>
      </div>
    </OverlayManager>
  </>;
}
