import type { NotebookCover, NotebookCoverTemplateId } from '@/types/notebook';

export interface NotebookCoverTemplate {
  id: NotebookCoverTemplateId;
  name: string;
  background: string;
  startColor: string;
  endColor: string;
  accent: string;
}

export const NOTEBOOK_COVER_TEMPLATES: ReadonlyArray<NotebookCoverTemplate> = [
  { id: 'linen', name: 'Linen', background: 'linear-gradient(145deg, #e7dfd2 0%, #b9aa97 100%)', startColor: '#e7dfd2', endColor: '#b9aa97', accent: '#7a6a59' },
  { id: 'leather', name: 'Leather', background: 'linear-gradient(145deg, #a9683f 0%, #5c3225 100%)', startColor: '#a9683f', endColor: '#5c3225', accent: '#f4d1ad' },
  { id: 'midnight', name: 'Midnight', background: 'linear-gradient(145deg, #38465d 0%, #121827 100%)', startColor: '#38465d', endColor: '#121827', accent: '#a8c7ff' },
  { id: 'sage', name: 'Sage', background: 'linear-gradient(145deg, #b7c9b5 0%, #5b7565 100%)', startColor: '#b7c9b5', endColor: '#5b7565', accent: '#eff7e8' },
  { id: 'plum', name: 'Plum', background: 'linear-gradient(145deg, #9274a8 0%, #3d284e 100%)', startColor: '#9274a8', endColor: '#3d284e', accent: '#f2ddff' },
  { id: 'sand', name: 'Sand', background: 'linear-gradient(145deg, #e5b379 0%, #b66d40 100%)', startColor: '#e5b379', endColor: '#b66d40', accent: '#fff3d8' },
];

export const DEFAULT_NOTEBOOK_COVER: NotebookCover = { kind: 'template', id: 'linen' };

export function getNotebookCoverTemplate(id: NotebookCoverTemplateId): NotebookCoverTemplate {
  return NOTEBOOK_COVER_TEMPLATES.find(template => template.id === id) ?? NOTEBOOK_COVER_TEMPLATES[0];
}

export function resolveNotebookCover(cover: NotebookCover | undefined) {
  if (cover?.kind === 'image') {
    let hash = 2166136261;
    for (let index = 0; index < cover.dataUrl.length; index += 1) {
      hash ^= cover.dataUrl.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return {
      kind: 'image' as const,
      identity: `image:${(hash >>> 0).toString(16)}`,
      dataUrl: cover.dataUrl,
      position: cover.position ?? '50% 50%',
      accent: '#ffffff',
    };
  }
  const template = getNotebookCoverTemplate(cover?.kind === 'template' ? cover.id : 'linen');
  return { kind: 'template' as const, identity: `template:${template.id}`, template, accent: template.accent };
}

export const getNotebookCoverIdentity = (cover: NotebookCover | undefined) => resolveNotebookCover(cover).identity;
