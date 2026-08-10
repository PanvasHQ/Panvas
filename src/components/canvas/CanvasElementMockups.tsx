import React from 'react';
import {
  ArrowUpRight,
  Bookmark,
  CheckSquare,
  Code2,
  FileImage,
  FileText,
  GitBranch,
  Image as ImageIcon,
  MoreHorizontal,
  Paperclip,
  StickyNote,
} from 'lucide-react';

const canvasCard = 'rounded-lg border border-panvas-border-default bg-panvas-bg-elevated/95 shadow-[0_10px_24px_rgba(32,25,18,0.08),0_2px_5px_rgba(32,25,18,0.04)]';

export function CanvasElementMockups() {
  return (
    <div className="absolute inset-0 min-h-[980px] select-none" aria-label="Static canvas example elements">
      <Connector className="left-[18%] top-[28%] h-px w-[13%]" />
      <Connector className="left-[47%] top-[31%] h-px w-[9%]" />
      <Connector className="left-[62%] top-[44%] h-[14%] w-px" />
      <Connector className="left-[31%] top-[57%] h-px w-[12%]" />

      <div className={`absolute left-[7%] top-[17%] w-48 -rotate-[1.5deg] p-4 ${canvasCard}`}>
        <div className="flex items-center gap-2 text-xs font-medium text-panvas-text-primary"><StickyNote size={14} />Research questions</div>
        <p className="mt-3 text-xs leading-5 text-panvas-text-secondary">How might visual notes connect sources, experiments, and findings?</p>
        <div className="mt-3 flex gap-1"><span className="h-1.5 w-1.5 rounded-full bg-panvas-text-tertiary/40" /><span className="h-1.5 w-1.5 rounded-full bg-panvas-text-tertiary/25" /><span className="h-1.5 w-1.5 rounded-full bg-panvas-text-tertiary/20" /></div>
      </div>

      <div className="absolute left-[30%] top-[15%] w-64 rounded-lg border-2 border-panvas-text-primary/30 bg-panvas-bg-elevated p-4 shadow-[0_12px_28px_rgba(32,25,18,0.1)]">
        <SelectionHandles />
        <div className="flex items-center justify-between text-xs font-semibold text-panvas-text-primary"><span>Research synthesis</span><MoreHorizontal size={15} className="text-panvas-text-tertiary" /></div>
        <p className="mt-2 text-xs leading-5 text-panvas-text-secondary">Bring observations together before turning them into a working system.</p>
        <div className="mt-4 flex gap-2 border-t border-panvas-border-subtle pt-3 text-2xs text-panvas-text-tertiary"><span>12 sources</span><span>•</span><span>Updated today</span></div>
      </div>

      <div className={`absolute left-[55%] top-[15%] w-52 p-3 ${canvasCard}`}>
        <div className="flex items-center justify-between text-xs font-medium text-panvas-text-primary"><span>Reference image</span><FileImage size={14} /></div>
        <div className="relative mt-3 flex h-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-panvas-border-default bg-panvas-bg-secondary text-panvas-text-tertiary">
          <ImageIcon size={22} strokeWidth={1.4} />
          <span className="absolute bottom-2 left-2 rounded bg-panvas-bg-elevated/90 px-1.5 py-0.5 text-2xs">field-study.jpg</span>
        </div>
      </div>

      <div className={`absolute right-[8%] top-[21%] w-44 rotate-[1.5deg] p-4 ${canvasCard}`}>
        <div className="flex items-center gap-2 text-xs font-medium text-panvas-text-primary"><Bookmark size={14} />Read later</div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-panvas-text-secondary">Spatial systems for thought and collective sense-making.</p>
        <div className="mt-3 flex items-center gap-1 text-2xs text-panvas-text-tertiary">panspace.studio <ArrowUpRight size={11} /></div>
      </div>

      <div className={`absolute left-[18%] top-[43%] w-72 p-4 ${canvasCard}`}>
        <div className="flex items-center gap-2 text-xs font-medium text-panvas-text-primary"><GitBranch size={14} />Study flow</div>
        <div className="mt-4 flex items-center gap-2 text-2xs text-panvas-text-secondary"><FlowNode label="Collect" /><Arrow className="flex-1" /><FlowNode label="Map" /><Arrow className="flex-1" /><FlowNode label="Test" /></div>
        <span className="absolute -right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border border-panvas-text-tertiary bg-panvas-bg-elevated" />
      </div>

      <div className={`absolute left-[51%] top-[39%] w-64 p-4 ${canvasCard}`}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-medium text-panvas-text-primary"><Code2 size={14} />Embedding notes</div><span className="rounded bg-panvas-bg-secondary px-1.5 py-0.5 font-mono text-2xs text-panvas-text-tertiary">ts</span></div>
        <pre className="mt-3 overflow-hidden rounded-md bg-panvas-bg-secondary p-2.5 font-mono text-[10px] leading-5 text-panvas-text-secondary">{`const insight =\n  connect(research,\n    visualContext);`}</pre>
      </div>

      <div className="absolute right-[8%] top-[43%] w-48 rounded-lg border border-dashed border-panvas-border-default bg-panvas-bg-elevated/70 p-3">
        <div className="text-2xs font-medium uppercase tracking-[0.12em] text-panvas-text-tertiary">Grouped frame</div>
        <div className="mt-3 rounded-md border border-panvas-border-subtle bg-panvas-bg-secondary/70 p-2 text-xs text-panvas-text-secondary">Attention map</div>
        <div className="mt-2 h-12 rounded-md border border-panvas-border-subtle bg-panvas-bg-secondary/60" />
      </div>

      <div className={`absolute bottom-[17%] left-[8%] w-64 p-4 ${canvasCard}`}>
        <div className="flex items-center gap-2 text-xs font-medium text-panvas-text-primary"><FileText size={14} />Research board</div>
        <div className="mt-3 space-y-2">{['Source review', 'Open questions', 'Experiments'].map(item => <div key={item} className="flex items-center gap-2 rounded-md bg-panvas-bg-secondary px-2 py-1.5 text-2xs text-panvas-text-secondary"><CheckSquare size={12} />{item}</div>)}</div>
      </div>

      <div className={`absolute bottom-[13%] left-[39%] w-72 p-3 ${canvasCard}`}>
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-panvas-text-primary"><span>Working board</span><span className="text-2xs font-normal text-panvas-text-tertiary">3 columns</span></div>
        <div className="grid grid-cols-3 gap-2">{['To explore', 'In progress', 'Done'].map((column, index) => <div key={column} className="rounded-md bg-panvas-bg-secondary p-2"><div className="text-2xs text-panvas-text-tertiary">{column}</div><div className={`mt-2 h-9 rounded border border-panvas-border-subtle ${index === 1 ? 'bg-panvas-bg-active' : 'bg-panvas-bg-elevated'}`} /></div>)}</div>
      </div>

      <div className={`absolute bottom-[17%] right-[10%] w-48 rotate-1 p-3 ${canvasCard}`}>
        <div className="flex items-center gap-2 text-xs font-medium text-panvas-text-primary"><Paperclip size={14} />Paper excerpt</div>
        <div className="mt-3 h-20 rounded-md border border-panvas-border-subtle bg-panvas-bg-secondary p-2"><div className="h-1.5 w-4/5 rounded bg-panvas-border-default" /><div className="mt-2 h-1.5 w-full rounded bg-panvas-border-subtle" /><div className="mt-2 h-1.5 w-3/5 rounded bg-panvas-border-subtle" /></div>
      </div>

      <div className="absolute bottom-[8%] right-[30%] flex h-32 w-32 items-center justify-center rounded-full border border-panvas-border-default bg-panvas-bg-elevated/90 shadow-sm">
        <div className="text-center text-xs font-medium text-panvas-text-primary">Core idea<div className="mt-1 text-2xs font-normal text-panvas-text-tertiary">Mind map</div></div>
        <span className="absolute -left-9 top-8 h-px w-9 bg-panvas-border-default" /><span className="absolute -right-8 bottom-9 h-px w-8 bg-panvas-border-default" /><span className="absolute left-4 -top-7 h-7 w-px bg-panvas-border-default" />
      </div>
    </div>
  );
}

function Connector({ className }: { className: string }) { return <span className={`absolute bg-panvas-border-default/80 ${className}`} aria-hidden="true" />; }
function Arrow({ className }: { className?: string }) { return <span className={`relative block h-px bg-panvas-border-default after:absolute after:-right-px after:-top-[2px] after:h-1.5 after:w-1.5 after:rotate-45 after:border-r after:border-t after:border-panvas-border-default ${className ?? ''}`} />; }
function FlowNode({ label }: { label: string }) { return <span className="rounded border border-panvas-border-subtle bg-panvas-bg-secondary px-2 py-1">{label}</span>; }
function SelectionHandles() { return <>{['-left-1 -top-1', '-right-1 -top-1', '-bottom-1 -left-1', '-bottom-1 -right-1'].map(position => <span key={position} className={`absolute h-2 w-2 rounded-sm border border-panvas-text-primary/60 bg-panvas-bg-elevated ${position}`} />)}</>; }
