import React from 'react';
import type { NotebookCover } from '@/types/notebook';
import { getNotebookCoverAccent, getNotebookCoverIdentity, getNotebookCoverStyle } from './notebookCovers';

export function NotebookCoverThumbnail({ title, cover, variant = 'shelf' }: { title: string; cover?: NotebookCover; variant?: 'shelf' | 'mini' }) {
  const mini = variant === 'mini';
  return (
    <span
      aria-hidden="true"
      data-cover-id={getNotebookCoverIdentity(cover)}
      className={mini
        ? 'relative block h-[17px] w-[12px] shrink-0 overflow-hidden rounded-[2px] border border-black/20 shadow-[1px_1px_0_rgba(0,0,0,0.12)]'
        : 'relative h-[88px] w-[60px] overflow-hidden rounded-r-md rounded-l-sm border border-black/15 shadow-[3px_4px_0_rgba(0,0,0,0.08)]'}
      style={getNotebookCoverStyle(cover)}
    >
      <span className={`absolute inset-y-0 left-0 bg-black/20 ${mini ? 'w-[2px]' : 'w-1.5'}`} />
      {!mini && <><span className="absolute inset-x-2 bottom-2 rounded-sm bg-black/25 px-1 py-1 text-center text-[6px] font-semibold uppercase leading-tight tracking-[0.06em] line-clamp-2" style={{ color: getNotebookCoverAccent(cover) }}>{title}</span><span className="absolute right-1.5 top-2 h-8 w-px bg-white/35" /></>}
    </span>
  );
}
