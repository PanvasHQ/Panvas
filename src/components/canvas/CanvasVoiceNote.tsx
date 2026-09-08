import React, { useEffect, useRef, useState } from 'react';
import { Check, Mic, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import type { CustomBlock } from '@/types/canvas';
import { useCanvasStore } from '@/stores/canvasStore';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { AudioPlaybackController, createPlaybackBlob, formatAudioTime, type AudioPlaybackState } from '@/services/audio/audioLifecycle';
import { clampVoiceNoteSize } from '@/services/audio/voiceNoteObjects';
import { useUIStore } from '@/stores/uiStore';

const idle: AudioPlaybackState = { activeNoteId: null, status: 'idle', elapsedMs: 0, durationMs: 0 };

export function CanvasVoiceNote({ block, zoom }: { block: CustomBlock; zoom: number }) {
  const updateBlock = useCanvasStore(state => state.updateBlock);
  const deleteBlock = useCanvasStore(state => state.deleteBlock);
  const showToast = useUIStore(state => state.showToast);
  const [state, setState] = useState(idle);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const player = useRef<AudioPlaybackController>();
  const fileId = String(block.metadata?.audioFileId ?? '');
  const noteId = String(block.metadata?.audioNoteId ?? block.id);
  const mimeType = String(block.metadata?.mimeType ?? '');
  const durationMs = Number(block.metadata?.durationMs ?? 0);
  useEffect(() => { const value = new AudioPlaybackController(new Audio(), URL); player.current = value; const unsub = value.subscribe(setState); return () => { unsub(); value.destroy(); }; }, []);
  const toggle = async () => {
    try {
      if (state.status === 'playing') return player.current?.pause();
      if (state.activeNoteId === noteId) {
        if (state.status === 'ended') player.current?.seek(0);
        return player.current?.resume();
      }
      const asset = await canvasRepository.getAudio(fileId); if (!asset) throw new Error('The local audio file is missing.');
      await player.current?.play(noteId, createPlaybackBlob(asset.data, asset.mimeType, mimeType), durationMs);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'This recording could not be played.', 'error');
    }
  };
  const drag = (event: React.PointerEvent) => {
    event.preventDefault(); event.stopPropagation(); const start = { x: event.clientX, y: event.clientY, bx: block.x, by: block.y };
    const move = (e: PointerEvent) => void updateBlock(block.id, { x: start.bx + (e.clientX - start.x) / zoom, y: start.by + (e.clientY - start.y) / zoom });
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  };
  const resize = (event: React.PointerEvent) => {
    event.preventDefault(); event.stopPropagation(); const start = { x: event.clientX, y: event.clientY, w: block.width, h: block.height };
    const move = (e: PointerEvent) => void updateBlock(block.id, clampVoiceNoteSize(start.w + (e.clientX - start.x) / zoom, start.h + (e.clientY - start.y) / zoom));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  };
  const remove = async () => {
    try {
      await deleteBlock(block.id);
      await canvasRepository.deleteAudio(fileId);
      player.current?.clear();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Voice note could not be deleted.', 'error');
    }
  };
  const title = block.content?.trim() || 'Voice note';
  const commitRename = async () => {
    const nextTitle = titleDraft.trim() || title;
    try {
      if (nextTitle !== title) await updateBlock(block.id, { content: nextTitle });
      setRenaming(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Voice note could not be renamed.', 'error');
    }
  };
  const duration = state.durationMs || durationMs;
  return <div className="relative h-full w-full overflow-hidden rounded-xl border border-panvas-border-strong bg-panvas-bg-elevated text-panvas-text-primary shadow-glass"
    onPointerDown={event => event.stopPropagation()}>
    <div className={`flex items-center gap-1.5 border-b border-panvas-border-subtle px-3 h-9 ${!renaming ? 'cursor-move' : ''}`}
      onPointerDown={renaming ? event => event.stopPropagation() : drag}>
      <Mic size={14} className="shrink-0 text-panvas-accent-rose"/>
      {renaming
        ? <input
            autoFocus
            value={titleDraft}
            onChange={event => setTitleDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') { event.preventDefault(); void commitRename(); }
              if (event.key === 'Escape') { event.preventDefault(); setRenaming(false); }
            }}
            className="min-w-0 flex-1 rounded border border-panvas-border-strong bg-panvas-bg-primary px-1 text-xs text-panvas-text-primary focus-ring"
            aria-label="Voice note name"
          />
        : <span className="min-w-0 flex-1 truncate text-xs font-semibold text-panvas-text-primary" title={title}>{title}</span>}
      {renaming
        ? <>
            <button type="button" className="focus-ring text-panvas-text-secondary hover:text-panvas-text-primary" onClick={() => void commitRename()} aria-label="Save voice note name"><Check size={12}/></button>
            <button type="button" className="focus-ring text-panvas-text-secondary hover:text-panvas-text-primary" onClick={() => setRenaming(false)} aria-label="Cancel voice note name"><X size={12}/></button>
          </>
        : <button type="button" className="focus-ring text-panvas-text-tertiary hover:text-panvas-text-primary" onPointerDown={event => event.stopPropagation()} onClick={() => { setTitleDraft(block.content ?? ''); setRenaming(true); }} aria-label="Rename voice note"><Pencil size={12}/></button>}
      <button type="button" className="focus-ring text-panvas-text-tertiary hover:text-panvas-text-error" onPointerDown={event => event.stopPropagation()} onClick={() => void remove()} aria-label="Delete voice note"><Trash2 size={13}/></button>
    </div>
    <div className="flex items-center gap-2 p-3">
      <button type="button" className="panvas-icon-control h-8 w-8 shrink-0" disabled={!fileId} onClick={() => void toggle()}>{state.status === 'playing' ? <Pause size={14}/> : <Play size={14}/>}</button>
      <div className="min-w-0 flex-1"><input type="range" className="block w-full accent-panvas-accent-blue" min={0} max={Math.max(1,duration)} value={Math.min(state.elapsedMs, Math.max(1, duration))} disabled={!duration} onChange={event => player.current?.seek(Number(event.target.value))}/><div className="flex justify-between text-[10px] tabular-nums text-panvas-text-tertiary"><span>{formatAudioTime(state.elapsedMs)}</span><span>{formatAudioTime(duration)}</span></div></div>
    </div>
    <button type="button" aria-label="Resize voice note" onPointerDown={resize} className="focus-ring absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize border-b-2 border-r-2 border-panvas-accent-blue"/>
  </div>;
}
