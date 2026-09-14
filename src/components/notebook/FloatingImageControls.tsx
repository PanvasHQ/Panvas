import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crop, RotateCcw, RotateCw, SlidersHorizontal, X, Image as ImageIcon } from 'lucide-react';
import type { ImageObject } from './engine/drawingTypes';
import type { NotebookEngine } from './engine/NotebookEngine';
import { FULL_IMAGE_CROP, recropImageGeometry } from './engine/imageAppearance';
import { ImageCropEditor } from './ImageCropEditor';
import { resolveImageToolbarPlacement, type ImageToolbarPlacement } from './engine/imageToolbarPlacement';

interface ImageControlPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  top: number;
  left: number;
  opacity: number;
}

export function FloatingImageControls({ image, engine }: { image: ImageObject; engine: NotebookEngine }) {
  const [panel, setPanel] = useState<'crop' | 'opacity' | null>(null);
  const [position, setPosition] = useState<ImageControlPosition>();
  const cropButton = useRef<HTMLButtonElement>(null);
  const opacityStart = useRef<number>();
  const placementRef = useRef<ImageToolbarPlacement | null>(null);
  const closeCrop = useCallback(() => {
    setPanel(null);
    requestAnimationFrame(() => cropButton.current?.focus());
  }, []);

  useEffect(() => {
    placementRef.current = null;
  }, [image.id, panel]);

  useEffect(() => {
    engine.selection.setSelectionControlsVisible(panel !== 'crop');
    return () => engine.selection.setSelectionControlsVisible(true);
  }, [engine, panel]);

  useEffect(() => {
    let frame: number;
    const update = () => {
      const canvas = engine.drawing.getCanvasElement();
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const point = (x: number, y: number) => {
          const p = engine.viewport.pageToCanvas(x, y);
          return { x: rect.left + p.x * rect.width / canvas.clientWidth, y: rect.top + p.y * rect.height / canvas.clientHeight };
        };
        const display = panel === 'crop' ? { ...image, ...recropImageGeometry(image, FULL_IMAGE_CROP) } : image;
        const center = point(display.x + display.width / 2, display.y + display.height / 2);
        const radians = (display.rotation || 0) * Math.PI / 180;
        const right = point(display.x + display.width / 2 + Math.cos(radians) * display.width / 2, display.y + display.height / 2 + Math.sin(radians) * display.width / 2);
        const bottom = point(display.x + display.width / 2 - Math.sin(radians) * display.height / 2, display.y + display.height / 2 + Math.cos(radians) * display.height / 2);
        let width = Math.hypot(right.x - center.x, right.y - center.y) * 2;
        let height = Math.hypot(bottom.x - center.x, bottom.y - center.y) * 2;
        const angle = Math.atan2(right.y - center.y, right.x - center.x) * 180 / Math.PI;
        const angleRadians = angle * Math.PI / 180;
        let boundWidth = Math.abs(Math.cos(angleRadians)) * width + Math.abs(Math.sin(angleRadians)) * height;
        let boundHeight = Math.abs(Math.sin(angleRadians)) * width + Math.abs(Math.cos(angleRadians)) * height;
        if (panel === 'crop') {
          const fit = Math.min(1, (window.innerWidth - 40) / Math.max(1, boundWidth), (window.innerHeight - 110) / Math.max(1, boundHeight));
          width *= fit;
          height *= fit;
          boundWidth *= fit;
          boundHeight *= fit;
          center.x = Math.max(20 + boundWidth / 2, Math.min(window.innerWidth - 20 - boundWidth / 2, center.x));
          center.y = Math.max(64 + boundHeight / 2, Math.min(window.innerHeight - 20 - boundHeight / 2, center.y));
        }
        const boundTop = center.y - boundHeight / 2;
        const boundBottom = center.y + boundHeight / 2;
        const controlWidth = panel === 'opacity' ? 252 : panel === 'crop' ? 278 : 238;
        const placement = resolveImageToolbarPlacement({
          boundTop,
          boundBottom,
          centerX: center.x,
          controlWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          current: placementRef.current,
        });
        placementRef.current = placement;
        const rawTop = placement === 'below' ? boundBottom + 10 : placement === 'above' ? boundTop - 48 : center.y - 20;
        // Keep the contextual bar below the fixed notebook header when an
        // image sits near the top of the page.
        const top = rawTop < 76 && boundBottom + 58 < window.innerHeight ? boundBottom + 10 : rawTop;
        const aboveLeft = center.x + 24 + controlWidth <= window.innerWidth - 8
          ? center.x + 24
          : center.x - controlWidth - 24;
        const desiredLeft = placement === 'below' ? center.x - controlWidth / 2 : aboveLeft;
        const next = {
          x: center.x - width / 2,
          y: center.y - height / 2,
          width,
          height,
          angle,
          top: Math.max(76, Math.min(window.innerHeight - 48, top)),
          left: Math.max(8, Math.min(window.innerWidth - controlWidth - 8, desiredLeft)),
          opacity: image.opacity ?? 1,
        };
        if (rect.width && rect.height) setPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof ImageControlPosition] === next[key as keyof ImageControlPosition]) ? previous : next);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [engine, image, panel]);

  const notify = () => { engine.drawing.redraw(); engine.input.notifyChange(); };
  const rotate = (degrees: number) => { engine.selection.rotateSelection(degrees); notify(); };
  const finishOpacity = () => {
    const before = opacityStart.current;
    opacityStart.current = undefined;
    const after = image.opacity ?? 1;
    if (before === undefined || before === after) return;
    const apply = (opacity: number) => {
      const current = engine.images.getImages().find(item => item.id === image.id);
      if (current) current.opacity = opacity;
      notify();
    };
    engine.history.pushExecuted({ description: 'Change image opacity', execute: () => apply(after), undo: () => apply(before) });
    notify();
  };

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        finishOpacity();
        setPanel(null);
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  });

  if (!position) return null;
  const iconButton = 'flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus-ring';
  const iconOnlyButton = 'grid h-8 w-8 place-items-center rounded-md text-panvas-text-secondary transition-colors hover:bg-panvas-bg-hover hover:text-panvas-text-primary focus-ring';

  return createPortal(<div className="pointer-events-none fixed inset-0 z-[80]" onPointerDown={event => event.stopPropagation()}>
    {panel !== 'crop' && <div role="toolbar" aria-label="Image controls" className="panvas-overlay panvas-floating-surface pointer-events-auto fixed flex h-10 items-center gap-0.5 rounded-xl border border-panvas-border-subtle bg-panvas-bg-elevated px-1.5 shadow-xl" style={{ left: position.left, top: position.top }}>
      {panel === 'opacity' ? <>
        <SlidersHorizontal size={14} className="mx-1 text-panvas-text-tertiary" aria-hidden="true" />
        <span className="text-2xs font-medium text-panvas-text-secondary">Opacity</span>
        <input type="range" min="0" max="100" aria-label="Image opacity amount" title={`Opacity: ${Math.round(position.opacity * 100)}%`} value={Math.round(position.opacity * 100)} className="h-1 w-28 accent-panvas-accent-blue cursor-pointer"
          onPointerDown={event => { opacityStart.current = image.opacity ?? 1; event.currentTarget.setPointerCapture(event.pointerId); }}
          onKeyDown={() => { opacityStart.current ??= image.opacity ?? 1; }} onKeyUp={finishOpacity} onBlur={finishOpacity}
          onChange={event => { opacityStart.current ??= image.opacity ?? 1; image.opacity = Number(event.target.value) / 100; engine.drawing.redraw(); }}
          onPointerUp={finishOpacity} onPointerCancel={finishOpacity} />
        <span className="w-8 text-right text-2xs tabular-nums text-panvas-text-tertiary">{Math.round(position.opacity * 100)}%</span>
        <button type="button" className={iconOnlyButton} aria-label="Close image opacity" title="Close" onClick={() => { finishOpacity(); setPanel(null); }}><X size={14} /></button>
      </> : <>
        <span className="grid h-7 w-7 place-items-center rounded-md bg-panvas-bg-secondary text-panvas-text-tertiary" aria-hidden="true"><ImageIcon size={14} /></span>
        <button ref={cropButton} type="button" className={iconButton} aria-label="Crop image" title="Crop" onClick={() => setPanel('crop')}><Crop size={14} /><span className="text-2xs font-medium">Crop</span></button>
        <button type="button" className={iconButton} aria-label="Rotate image left 90 degrees" title="Rotate left 90°" onClick={() => rotate(-90)}><RotateCcw size={14} /></button>
        <button type="button" className={iconButton} aria-label="Rotate image right 90 degrees" title="Rotate right 90°" onClick={() => rotate(90)}><RotateCw size={14} /></button>
        <div className="mx-0.5 h-4 border-l border-panvas-border-subtle" />
        <button type="button" className={iconButton} aria-label="Image opacity" title={`Opacity: ${Math.round(position.opacity * 100)}%`} aria-expanded={false} onClick={() => setPanel('opacity')}><SlidersHorizontal size={14} /><span className="text-2xs font-medium">{Math.round(position.opacity * 100)}%</span></button>
      </>}
    </div>}
    {panel === 'crop' && <div className="fixed pointer-events-auto" style={{ left: position.x, top: position.y, width: position.width, height: position.height, transform: `rotate(${position.angle}deg)` }}>
      <ImageCropEditor image={image} engine={engine} angle={position.angle} toolbarPosition={{ left: position.left, top: position.top }} onClose={closeCrop} />
    </div>}
  </div>, document.body);
}
