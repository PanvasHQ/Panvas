import type { CSSProperties } from 'react';
import type { NotebookCover } from '@/types/notebook';
import { resolveNotebookCover } from '@/lib/notebookCover';
export { DEFAULT_NOTEBOOK_COVER, NOTEBOOK_COVER_TEMPLATES, getNotebookCoverIdentity, getNotebookCoverTemplate } from '@/lib/notebookCover';

export function getNotebookCoverStyle(cover: NotebookCover | undefined): CSSProperties {
  const resolved = resolveNotebookCover(cover);
  if (resolved.kind === 'image') {
    return {
      backgroundImage: `url(${resolved.dataUrl})`,
      backgroundPosition: resolved.position,
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
    };
  }
  return { background: resolved.template.background };
}

export function getNotebookCoverAccent(cover: NotebookCover | undefined): string {
  return resolveNotebookCover(cover).accent;
}
