import React, { useState } from 'react';
import { ArrowRight, Eraser, Frame, GitBranch, Hand, Highlighter, Image, Link2, Minus, MousePointer2, PenTool, Pencil, ScanLine, Shapes, StickyNote, Type } from 'lucide-react';

type Tool = { id: string; label: string; icon: React.ElementType };

const groups: Tool[][] = [
  [{ id: 'select', label: 'Select', icon: MousePointer2 }, { id: 'hand', label: 'Hand', icon: Hand }],
  [{ id: 'pen', label: 'Pen', icon: PenTool }, { id: 'pencil', label: 'Pencil', icon: Pencil }, { id: 'highlighter', label: 'Highlighter', icon: Highlighter }, { id: 'marker', label: 'Marker', icon: PenTool }, { id: 'eraser', label: 'Eraser', icon: Eraser }],
  [{ id: 'shapes', label: 'Shapes', icon: Shapes }, { id: 'line', label: 'Line', icon: Minus }, { id: 'arrow', label: 'Arrow', icon: ArrowRight }, { id: 'text', label: 'Text', icon: Type }, { id: 'sticky', label: 'Sticky Note', icon: StickyNote }],
  [{ id: 'connector', label: 'Connector', icon: Link2 }, { id: 'frame', label: 'Frame', icon: Frame }, { id: 'mind-map', label: 'Mind Map', icon: GitBranch }, { id: 'image', label: 'Image', icon: Image }, { id: 'laser', label: 'Laser Pointer', icon: ScanLine }],
];

export function CanvasFloatingToolbar() { const [activeTool, setActiveTool] = useState('select'); return <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-1.5 shadow-glass-sm" aria-label="Canvas tools">{groups.map((group, groupIndex) => <React.Fragment key={groupIndex}>{groupIndex > 0 && <span className="mx-1 h-6 w-px flex-shrink-0 bg-panvas-border-subtle" />}{group.map(({ id, label, icon: Icon }) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={activeTool === id} onClick={() => setActiveTool(id)} className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150 focus-ring ${activeTool === id ? 'bg-panvas-bg-active text-panvas-text-primary shadow-sm' : 'text-panvas-text-secondary hover:-translate-y-px hover:bg-panvas-bg-hover hover:text-panvas-text-primary active:scale-[0.96]'}`}><Icon size={16} /></button>)}</React.Fragment>)}</div>; }
