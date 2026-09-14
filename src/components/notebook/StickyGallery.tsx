import React, { useRef, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { OverlayManager } from '@/components/ui/OverlayManager';
import type { NotebookEngine } from './engine/NotebookEngine';
import { getShapeBorderRadius, insertStickyPreset, STICKY_PRESETS, stickyPaperStyle } from './stickyNotes';

export function StickyGallery({ engine }: { engine: NotebookEngine }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('classic');
  const ref = useRef<HTMLDivElement>(null);

  const insert = (id: string) => {
    if (!insertStickyPreset(engine, id)) return;
    setActive(id); setOpen(false);
  };
  return <div ref={ref} className="relative">
    <button type="button" title="Sticky notes" aria-label="Sticky notes" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-8 w-8 items-center justify-center rounded-lg text-panvas-text-secondary hover:bg-panvas-bg-hover focus-ring"><StickyNote size={16} /></button>
    <OverlayManager isOpen={open} onClose={() => setOpen(false)} anchorRef={ref}><section aria-label="Sticky note gallery" onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} className="panvas-floating-surface pointer-events-auto w-[288px] max-w-[calc(100vw-24px)] rounded-xl border border-panvas-border-subtle bg-panvas-bg-elevated p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between text-xs"><strong>Sticky notes</strong><span className="text-panvas-text-tertiary">Choose to insert</span></div>
      <div className="grid max-h-[min(360px,55vh)] grid-cols-3 gap-2 overflow-y-auto">
        {STICKY_PRESETS.map(preset => <button key={preset.id} type="button" aria-pressed={active === preset.id} onClick={event => { event.stopPropagation(); insert(preset.id); }} className={`rounded-lg border p-1.5 text-2xs focus-ring ${active === preset.id ? 'border-panvas-accent-blue bg-panvas-bg-active' : 'border-panvas-border-subtle hover:bg-panvas-bg-hover'}`}>
          <div className="flex h-16 items-center justify-center"><div style={{ width: 58, height: 58 * preset.height / preset.width, backgroundColor: preset.color, opacity: preset.opacity, borderRadius: getShapeBorderRadius(preset.shape), ...stickyPaperStyle({ metadata: { paper: preset.paper } }, 8) }} className="border border-black/10 shadow-sm" /></div>
          <span className="block truncate text-panvas-text-secondary">{preset.label}</span>
        </button>)}
      </div>
    </section></OverlayManager>
  </div>;
}
