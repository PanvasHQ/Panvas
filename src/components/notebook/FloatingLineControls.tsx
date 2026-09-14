import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NotebookEngine } from './engine/NotebookEngine';
import type { Shape } from './engine/drawingTypes';
import { buildLineStyleGeometry, LINE_STYLES } from './engine/lineStyleGeometry';

export function FloatingLineControls({ engine, shape }: { engine: NotebookEngine; shape: Shape }) {
  const [position, setPosition] = useState<{ left: number; top: number; style: string }>();
  useEffect(() => {
    let frame: number;
    const update = () => {
      const canvas = engine.drawing.getCanvasElement();
      if (canvas) {
        const rect = canvas.getBoundingClientRect(), bounds = buildLineStyleGeometry(shape).bounds;
        const p = engine.viewport.pageToCanvas(bounds.x + bounds.width / 2, bounds.y);
        const next = { left: Math.max(8, Math.min(window.innerWidth - 260, rect.left + p.x - 126)), top: Math.max(8, Math.min(window.innerHeight - 48, rect.top + p.y - 46)), style: shape.lineStyle ?? 'solid' };
        setPosition(previous => previous && previous.left === next.left && previous.top === next.top && previous.style === next.style ? previous : next);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, [engine, shape]);
  if (!position) return null;
  return createPortal(<div role="toolbar" aria-label="Line style" onPointerDown={e => e.stopPropagation()} className="panvas-overlay panvas-floating-surface fixed z-[80] flex items-center gap-1 rounded-lg border border-panvas-border-subtle bg-panvas-bg-elevated p-1 shadow-lg" style={{ left: position.left, top: position.top }}>
    {LINE_STYLES.map(style => {
      const g = buildLineStyleGeometry({ ...shape, x: 4, y: 12, width: 28, height: 0, rotation: 0, strokeWidth: 1.5, shapeType: 'line', lineStyle: style });
      return <button key={style} type="button" title={style} aria-label={`${style} line`} aria-pressed={position.style === style} onClick={() => engine.selection.changeLineStyle(style)} className={`h-8 w-9 rounded-md focus-ring ${position.style === style ? 'bg-panvas-bg-active text-panvas-accent-blue' : 'text-panvas-text-secondary hover:bg-panvas-bg-hover'}`}>
        <svg viewBox="0 0 36 24" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.5">{g.paths.map((path, i) => <polyline key={i} points={path.map(p => `${p.x},${p.y}`).join(' ')} />)}{g.dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={g.radius} fill="currentColor" />)}</g></svg>
      </button>;
    })}
  </div>, document.body);
}
