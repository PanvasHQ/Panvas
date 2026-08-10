import React from 'react';
import { Archive, BookOpen, Code2, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, LayoutDashboard, Presentation, type LucideIcon } from 'lucide-react';

export type LibraryFile = {
  type: 'notebook' | 'canvas' | 'pdf' | 'image' | 'video' | 'audio' | 'markdown' | 'code' | 'sheet' | 'presentation' | 'archive' | 'folder';
  title: string;
  modified: string;
  size: string;
  tags: string[];
  owner: string;
};

const icons: Record<LibraryFile['type'], LucideIcon> = { notebook: BookOpen, canvas: LayoutDashboard, pdf: FileText, image: FileImage, video: FileVideo, audio: FileAudio, markdown: FileText, code: Code2, sheet: FileSpreadsheet, presentation: Presentation, archive: Archive, folder: Folder };
const accents: Record<LibraryFile['type'], string> = { notebook: 'bg-panvas-bg-active', canvas: 'bg-panvas-bg-secondary', pdf: 'bg-panvas-bg-secondary', image: 'bg-panvas-bg-active/70', video: 'bg-panvas-bg-secondary', audio: 'bg-panvas-bg-active/70', markdown: 'bg-panvas-bg-secondary', code: 'bg-panvas-bg-secondary', sheet: 'bg-panvas-bg-active/70', presentation: 'bg-panvas-bg-secondary', archive: 'bg-panvas-bg-secondary', folder: 'bg-panvas-bg-active' };

export function FilePreviewCard({ file, selected = false }: { file: LibraryFile; selected?: boolean }) {
  const Icon = icons[file.type];
  return <article className={`group relative overflow-hidden rounded-xl border bg-panvas-bg-elevated transition-[border,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-panvas-border-strong/25 hover:shadow-[0_12px_26px_rgba(32,25,18,0.07)] ${selected ? 'border-panvas-text-primary/40 ring-1 ring-panvas-text-primary/15' : 'border-panvas-border-default'}`}>
    <div className={`relative flex h-28 items-center justify-center border-b border-panvas-border-subtle/70 ${accents[file.type]}`}>
      <PreviewArt type={file.type} />
      <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-md border border-panvas-border-default bg-panvas-bg-elevated/90 text-panvas-text-secondary"><Icon size={14} /></span>
      <span className="absolute right-3 top-3 h-4 w-4 rounded border border-panvas-border-default bg-panvas-bg-elevated opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
    <div className="p-3.5"><div className="flex items-start justify-between gap-2"><h3 className="truncate text-sm font-medium text-panvas-text-primary">{file.title}</h3><span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-panvas-bg-secondary text-[9px] font-medium text-panvas-text-secondary">{file.owner}</span></div><div className="mt-1.5 flex items-center gap-1.5 text-2xs text-panvas-text-tertiary"><span>{file.modified}</span><span>·</span><span>{file.size}</span></div><div className="mt-3 flex gap-1 overflow-hidden">{file.tags.map(tag => <span key={tag} className="truncate rounded-md bg-panvas-bg-secondary px-1.5 py-0.5 text-2xs text-panvas-text-secondary">{tag}</span>)}</div></div>
  </article>;
}

function PreviewArt({ type }: Pick<LibraryFile, 'type'>) {
  if (type === 'canvas') return <div className="relative h-16 w-28 rounded-md border border-panvas-border-default bg-panvas-bg-elevated bg-[radial-gradient(rgba(127,127,127,0.15)_0.6px,transparent_0.6px)] bg-[size:8px_8px]"><span className="absolute left-4 top-4 h-5 w-9 rounded border border-panvas-border-default bg-panvas-bg-secondary" /><span className="absolute bottom-3 right-4 h-3 w-7 rounded bg-panvas-bg-active" /></div>;
  if (type === 'notebook') return <div className="h-[70px] w-[54px] rounded-md border border-panvas-border-default bg-panvas-bg-elevated p-2 shadow-sm"><span className="block h-1.5 w-7 rounded bg-panvas-text-primary/35" /><span className="mt-2 block h-px w-full bg-panvas-border-default" /><span className="mt-2 block h-px w-4/5 bg-panvas-border-default" /><span className="mt-2 block h-px w-full bg-panvas-border-default" /></div>;
  if (type === 'pdf') return <div className="h-[70px] w-[54px] rounded-sm border border-panvas-border-default bg-panvas-bg-elevated p-2 shadow-sm"><span className="block h-2 w-7 bg-panvas-text-primary/30" /><span className="mt-3 block h-px w-full bg-panvas-border-default" /><span className="mt-2 block h-px w-4/5 bg-panvas-border-default" /><span className="mt-2 block h-px w-full bg-panvas-border-default" /></div>;
  if (type === 'code') return <pre className="w-32 overflow-hidden rounded-md border border-panvas-border-default bg-panvas-bg-elevated p-2 font-mono text-[8px] leading-3 text-panvas-text-secondary">{`const map =\n  ideas.map()`}</pre>;
  if (type === 'sheet') return <div className="grid h-16 w-28 grid-cols-4 grid-rows-4 overflow-hidden rounded border border-panvas-border-default bg-panvas-bg-elevated">{Array.from({ length: 16 }, (_, index) => <span key={index} className="border-b border-r border-panvas-border-subtle/60" />)}</div>;
  if (type === 'presentation') return <div className="flex h-16 w-28 items-center justify-center rounded border border-panvas-border-default bg-panvas-bg-elevated"><span className="h-5 w-14 rounded bg-panvas-bg-active" /></div>;
  if (type === 'image' || type === 'video') return <div className="relative h-16 w-28 overflow-hidden rounded border border-panvas-border-default bg-panvas-bg-elevated"><span className="absolute inset-x-0 bottom-0 h-7 bg-panvas-bg-active/80" />{type === 'video' && <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-y-[6px] border-l-[9px] border-y-transparent border-l-panvas-text-secondary" />}</div>;
  if (type === 'audio') return <div className="flex h-14 items-center gap-1">{[12, 25, 18, 34, 22, 39, 16, 28, 13].map((height, index) => <span key={index} className="w-1 rounded-full bg-panvas-text-secondary/45" style={{ height }} />)}</div>;
  return <IconPreview type={type} />;
}
function IconPreview({ type }: Pick<LibraryFile, 'type'>) { const Icon = icons[type]; return <Icon size={33} strokeWidth={1.2} className="text-panvas-text-tertiary" />; }
