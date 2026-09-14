import React, { useEffect, useRef, useState } from 'react';
import type { NotebookEngine } from './engine/NotebookEngine';
import type { ImageObject } from './engine/drawingTypes';
import { canvasRepository } from '@/repositories/CanvasRepository';
import { getImageCrop } from './engine/imageAppearance';
import { createPortal } from 'react-dom';

export function ImageCropEditor({ image, engine, onClose, angle = 0, toolbarPosition }: {
  image: ImageObject; engine: NotebookEngine; onClose: () => void; angle?: number; toolbarPosition: { left: number; top: number };
}) {
  const [source, setSource] = useState<HTMLImageElement>();
  const [edges, setEdges] = useState(() => { const crop = getImageCrop(image); return { left: crop.x * 100, top: crop.y * 100, right: (1 - crop.x - crop.width) * 100, bottom: (1 - crop.y - crop.height) * 100 }; });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; edges: typeof edges; handle: string }>();
  useEffect(() => {
    let disposed = false;
    let url: string | undefined;
    void (async () => {
      try {
        const file = await canvasRepository.getImage(image.fileId);
        if (!file) throw new Error('Image source is unavailable.');
        if (disposed) return;
        url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
        const decoded = new Image();
        decoded.src = url;
        await decoded.decode();
        if (!disposed) setSource(decoded);
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'Could not load image.'); }
    })();
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [image.fileId]);
  const apply = async () => {
    if (!source || busy) return;
    setBusy(true); setError('');
    try {
      const crop = { x: edges.left / 100, y: edges.top / 100,
        width: (100 - edges.left - edges.right) / 100, height: (100 - edges.top - edges.bottom) / 100 };
      if (!engine.selection.cropImage(image.id, crop)) throw new Error('The image is no longer editable.');
      engine.input.notifyChange();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not crop image.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    surface.current?.focus();
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, [onClose]);
  const updateHandle = (handle: string, dx: number, dy: number, start = edges) => {
    const next = { ...start };
    if (handle.includes('w')) next.left = Math.max(0, Math.min(99 - start.right, start.left + dx));
    if (handle.includes('e')) next.right = Math.max(0, Math.min(99 - start.left, start.right - dx));
    if (handle.includes('n')) next.top = Math.max(0, Math.min(99 - start.bottom, start.top + dy));
    if (handle.includes('s')) next.bottom = Math.max(0, Math.min(99 - start.top, start.bottom - dy));
    setEdges(next);
  };
  return <div ref={surface} tabIndex={-1} className="absolute inset-0 pointer-events-auto" role="group" aria-label="Crop image"
    onPointerDown={e => e.stopPropagation()}
    onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } }}>
    {source && <img src={source.src} alt="Original image crop preview" draggable={false} className="absolute inset-0 h-full w-full" />}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute border-2 border-white" style={{ left: `${edges.left}%`, top: `${edges.top}%`, right: `${edges.right}%`, bottom: `${edges.bottom}%`, boxShadow: '0 0 0 10000px rgba(0,0,0,.5)' }}>
        {[1, 2].map(n => <React.Fragment key={n}><div className="absolute inset-y-0 border-l border-white/40" style={{ left: `${n * 100 / 3}%` }} /><div className="absolute inset-x-0 border-t border-white/40" style={{ top: `${n * 100 / 3}%` }} /></React.Fragment>)}
      </div>
    </div>
    {(['nw','n','ne','e','se','s','sw','w'] as const).map(handle => <button key={handle} type="button" aria-label={`Crop ${handle}`} title="Drag to crop - Arrow keys to adjust" disabled={busy || !source}
      className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-panvas-accent-blue bg-white shadow-sm focus-ring touch-none"
      style={{ left: `${handle.includes('w') ? edges.left : handle.includes('e') ? 100 - edges.right : (edges.left + 100 - edges.right) / 2}%`, top: `${handle.includes('n') ? edges.top : handle.includes('s') ? 100 - edges.bottom : (edges.top + 100 - edges.bottom) / 2}%`, cursor: `${handle}-resize` }}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, edges: { ...edges }, handle }; }}
      onPointerMove={e => {
        const start = drag.current; if (!start || !surface.current) return;
        const radians = angle * Math.PI / 180, dx = e.clientX - start.x, dy = e.clientY - start.y;
        updateHandle(start.handle, (dx * Math.cos(radians) + dy * Math.sin(radians)) / surface.current.offsetWidth * 100,
          (-dx * Math.sin(radians) + dy * Math.cos(radians)) / surface.current.offsetHeight * 100, start.edges);
      }}
      onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}
      onKeyDown={e => { if (e.key.startsWith('Arrow')) { e.preventDefault(); e.stopPropagation(); updateHandle(handle, e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0); } }} />)}
    {createPortal(<div role="toolbar" aria-label="Crop mode" onPointerDown={e => e.stopPropagation()} className="panvas-overlay panvas-floating-surface pointer-events-auto fixed z-[90] flex items-center gap-2 rounded-lg border border-panvas-border-subtle bg-panvas-bg-elevated px-2 py-1.5 text-xs text-panvas-text-primary shadow-lg" style={toolbarPosition}>
      <span className="font-medium">Crop</span>
      <button type="button" onClick={() => setEdges({ left: 0, top: 0, right: 0, bottom: 0 })} className="rounded px-2 py-1 hover:bg-panvas-bg-hover focus-ring">Reset</button>
      <button type="button" disabled={busy} onClick={onClose} className="rounded px-2 py-1 hover:bg-panvas-bg-hover focus-ring">Cancel</button>
      <button type="button" disabled={!source || busy} onClick={() => void apply()} className="rounded bg-panvas-accent-blue px-2 py-1 text-white disabled:opacity-40 focus-ring">Apply</button>
    </div>, document.body)}
    {(!source || error) && <p role={error ? 'alert' : 'status'} className="absolute left-0 top-0 rounded bg-panvas-bg-elevated p-2 text-xs text-panvas-text-primary">{error || 'Loading image...'}</p>}
  </div>;
}
