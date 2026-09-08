import React, { useEffect, useRef, useState } from 'react';
import { useLayoutStore } from '@/stores/layoutStore';

interface LaserPoint { id: number; x: number; y: number; createdAt: number }

/** Ephemeral presentation ink. No NotebookEngine or repository is reachable here. */
export function PresentationOverlay() {
  const laserMode = useLayoutStore(state => state.laserMode);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [trail, setTrail] = useState<LaserPoint[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 1_000;
      setTrail(points => points.filter(point => point.createdAt >= cutoff));
    }, 50);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className="panvas-layer-popover absolute inset-0 cursor-none touch-none"
      aria-label={`Presentation laser (${laserMode})`}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        setPointer(point);
        if (laserMode === 'trail') {
          const now = Date.now();
          setTrail(points => [...points.filter(item => item.createdAt >= now - 1_000), { ...point, id: nextId.current++, createdAt: now }].slice(-80));
        }
      }}
      onPointerLeave={() => setPointer(null)}
    >
      <svg className="h-full w-full" aria-hidden="true">
        {laserMode === 'trail' && trail.map((point, index) => (
          <circle key={point.id} cx={point.x} cy={point.y} r={3.5} fill="#ef4444" opacity={Math.max(0.08, (index + 1) / trail.length)} />
        ))}
        {pointer && <circle cx={pointer.x} cy={pointer.y} r={6} fill="#ef4444" className="drop-shadow-[0_0_5px_rgba(239,68,68,0.9)]" />}
      </svg>
    </div>
  );
}
