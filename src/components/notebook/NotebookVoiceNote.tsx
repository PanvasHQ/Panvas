import React, { useEffect, useRef, useState } from 'react';
import { Check, Mic, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import type { AudioNote, TextObject } from './engine/drawingTypes';
import type { NotebookEngine } from './engine/NotebookEngine';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { useUIStore } from '@/stores/uiStore';
import { AudioPlaybackController, audioNoteTitle, createPlaybackBlob, formatAudioTime, type AudioPlaybackState } from '@/services/audio/audioLifecycle';
import { clampVoiceNoteSize } from '@/services/audio/voiceNoteObjects';

const idle: AudioPlaybackState = { activeNoteId: null, status: 'idle', elapsedMs: 0, durationMs: 0 };

export function NotebookVoiceNote({ object, note, engine, scale, editable, onChange, onDelete, onRename }: {
  object: TextObject; note?: AudioNote; engine: NotebookEngine; scale: number; editable: boolean;
  onChange: () => void; onDelete: (note: AudioNote) => void; onRename: (note: AudioNote, title: string) => void;
}) {
  const [playback, setPlayback] = useState(idle);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const player = useRef<AudioPlaybackController>();
  const showToast = useUIStore(state => state.showToast);
  useEffect(() => {
    const controller = new AudioPlaybackController(new Audio(), URL);
    player.current = controller;
    const unsubscribe = controller.subscribe(setPlayback);
    return () => { unsubscribe(); controller.destroy(); player.current = undefined; };
  }, []);

  const play = async () => {
    try {
      if (!note || !player.current) return;
      if (playback.activeNoteId === note.id) {
        if (playback.status === 'playing') return player.current.pause();
        if (playback.status === 'ended') player.current.seek(0);
        return player.current.resume();
      }
      const asset = await canvasRepository.getAudio(note.fileId);
      if (!asset) throw new Error('The local audio file is missing.');
      await player.current.play(note.id, createPlaybackBlob(asset.data, asset.mimeType, note.mimeType), note.durationMs ?? 0);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'This recording could not be played.', 'error');
    }
  };

  const beginMove = (event: React.PointerEvent) => {
    if (!editable) return;
    event.preventDefault(); event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, left: object.x, top: object.y };
    const move = (next: PointerEvent) => {
      engine.texts.updateTextPositionAndBounds(object.id, start.left + (next.clientX - start.x) / scale, start.top + (next.clientY - start.y) / scale, object.width, object.height ?? 132);
      engine.drawing.redraw(); onChange();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onChange(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  };
  const beginResize = (event: React.PointerEvent) => {
    if (!editable) return;
    event.preventDefault(); event.stopPropagation();
    const start = { x: event.clientX, y: event.clientY, width: object.width, height: object.height ?? 132 };
    const move = (next: PointerEvent) => {
      const size = clampVoiceNoteSize(start.width + (next.clientX - start.x) / scale, start.height + (next.clientY - start.y) / scale);
      engine.texts.updateTextBounds(object.id, size.width, size.height);
      onChange();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); onChange(); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  };
  const duration = playback.durationMs || note?.durationMs || 0;
  const compact = object.width < 220 || (object.height ?? 132) < 108;
  const title = note ? audioNoteTitle(note) : 'Missing voice note';
  const commitRename = () => {
    if (note) onRename(note, titleDraft);
    setRenaming(false);
  };

  return <div className="absolute z-20 overflow-hidden rounded-xl border border-panvas-border-strong bg-panvas-bg-elevated shadow-glass pointer-events-auto"
    style={{ left: object.x * scale, top: object.y * scale, width: object.width, height: object.height ?? 132, transform: `scale(${scale})`, transformOrigin: 'top left' }}
    onPointerDown={event => event.stopPropagation()}>
    <div className={`flex items-center gap-1.5 border-b border-panvas-border-subtle ${compact ? 'h-7 px-2' : 'h-9 px-3'} ${editable && !renaming ? 'cursor-move' : ''}`} onPointerDown={renaming ? e => e.stopPropagation() : beginMove}>
      <Mic size={compact ? 12 : 14} className="shrink-0 text-panvas-accent-rose"/>
      {renaming ? <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }} className="min-w-0 flex-1 rounded border border-panvas-border-strong bg-panvas-bg-primary px-1 text-xs text-panvas-text-primary" aria-label="Voice note name"/>
        : <span className="min-w-0 flex-1 truncate text-xs font-semibold text-panvas-text-primary" title={title}>{title}</span>}
      {editable && note && (renaming ? <><button type="button" className="focus-ring text-panvas-text-secondary hover:text-panvas-text-primary" onClick={commitRename} aria-label="Save voice note name"><Check size={12}/></button><button type="button" className="focus-ring text-panvas-text-secondary hover:text-panvas-text-primary" onClick={() => setRenaming(false)} aria-label="Cancel rename"><X size={12}/></button></> : <button type="button" className="focus-ring text-panvas-text-tertiary hover:text-panvas-text-primary" onPointerDown={e => e.stopPropagation()} onClick={() => { setTitleDraft(note.title ?? ''); setRenaming(true); }} aria-label="Rename voice note"><Pencil size={12}/></button>)}
      {editable && note && <button type="button" className="focus-ring text-panvas-text-tertiary hover:text-panvas-text-error" onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(note)} aria-label="Delete voice note"><Trash2 size={13}/></button>}
    </div>
    <div className={`flex items-center ${compact ? 'gap-1.5 p-2' : 'gap-2 p-3'}`}>
      <button type="button" className={`panvas-icon-control shrink-0 ${compact ? 'h-7 w-7' : 'h-8 w-8'}`} disabled={!note} onClick={() => void play()} aria-label={playback.status === 'playing' ? `Pause ${title}` : `Play ${title}`} title={playback.status === 'playing' ? `Pause ${title}` : `Play ${title}`}>{playback.status === 'playing' ? <Pause size={13}/> : <Play size={13}/>}</button>
      <div className="min-w-0 flex-1"><input type="range" className="block w-full accent-panvas-accent-blue" min={0} max={Math.max(1, duration)} value={Math.min(playback.elapsedMs, Math.max(1, duration))} disabled={!playback.activeNoteId || !duration} onChange={e => player.current?.seek(Number(e.target.value))}/><div className={`text-[10px] tabular-nums text-panvas-text-tertiary ${compact ? 'text-right' : 'flex justify-between'}`}><span>{formatAudioTime(playback.elapsedMs)}</span><span>{compact ? ` / ${formatAudioTime(duration)}` : formatAudioTime(duration)}</span></div></div>
    </div>
    {editable && <button type="button" aria-label="Resize voice note" onPointerDown={beginResize} className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize border-b-2 border-r-2 border-panvas-accent-blue"/>}
  </div>;
}
