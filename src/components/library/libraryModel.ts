import type { Notebook, NotebookCover, NotebookPage, NotebookSection } from '@/types/notebook';
import type { CanvasFile, Folder, Workspace } from '@/types/workspace';
import type { TrashEntityKind } from '@/services/library/trashModel';
import { trashCountdown } from '../../services/cloudsync/trash.ts';

export type LibraryFileType = 'workspace' | 'folder' | 'notebook' | 'section' | 'page' | 'canvas' | 'pdf'
  | 'image' | 'video' | 'audio' | 'markdown' | 'code' | 'sheet' | 'presentation' | 'archive';

export type LibraryFile = {
  id: string;
  workspaceId: string;
  folderId: string | null;
  type: LibraryFileType;
  title: string;
  modified: string;
  size: string;
  pageCount?: number;
  tags: string[];
  owner: string;
  updatedAt: number;
  lastOpenedAt?: number;
  isFavorite: boolean;
  cover?: NotebookCover;
  /** Canonical persisted entity kind for Trash restore/context actions. */
  trashKind?: TrashEntityKind;
  /** Origin hierarchy path for Trash items: e.g. "Workspace / Folder / Notebook / Section" */
  originPath?: string;
};

export type LibraryView = 'library' | 'recent' | 'favorites' | 'trash' | 'cloud';
export type LibraryFilter = 'all' | 'notebook' | 'canvas' | 'pdf';
export type LibrarySort = 'name-asc' | 'modified-desc' | 'modified-asc' | 'type-asc';

export interface LibraryQuery {
  view: LibraryView;
  filter: LibraryFilter;
  folderId: string | null;
  query: string;
  tag: string | null;
  sort: LibrarySort;
}

export interface ActiveLibraryProjection {
  activeWorkspaceId: string | null;
  notebooks: Notebook[];
  notebookPages: NotebookPage[];
  canvasFiles: CanvasFile[];
}

export interface TrashLibraryProjection {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  folders: Folder[];
  canvasFiles: CanvasFile[];
  notebooks: Notebook[];
  sections: NotebookSection[];
  pages: NotebookPage[];
  activeWorkspaces?: Workspace[];
  activeFolders?: Folder[];
  activeNotebooks?: Notebook[];
  activeSections?: NotebookSection[];
}

function relativeTime(timestamp: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return 'Edited just now';
  if (minutes < 60) return `Edited ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Edited ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Edited ${days} day${days === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(timestamp);
}

/** Projects canonical active records into the Library's display model. */
export function projectActiveLibraryFiles(data: ActiveLibraryProjection, now = Date.now()): LibraryFile[] {
  const workspaceId = data.activeWorkspaceId;
  if (!workspaceId) return [];
  const activeNotebooks = data.notebooks.filter(item => item.workspaceId === workspaceId && !item.deletedAt);
  const activeNotebookIds = new Set(activeNotebooks.map(item => item.id));
  const notebooks = activeNotebooks.map(item => {
    const pageCount = data.notebookPages.filter(page => page.notebookId === item.id && !page.deletedAt).length;
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      folderId: item.folderId,
      type: 'notebook' as const,
      title: item.name,
      modified: relativeTime(item.lastOpenedAt ?? item.updatedAt, now),
      updatedAt: item.updatedAt,
      lastOpenedAt: item.lastOpenedAt,
      size: `${pageCount} pages`,
      pageCount,
      tags: item.isPinned ? ['Notebook', 'Favorite'] : ['Notebook'],
      owner: 'Local',
      isFavorite: Boolean(item.isPinned),
      cover: item.cover,
    };
  });
  const canvases = data.canvasFiles
    .filter(item => item.workspaceId === workspaceId && !item.deletedAt)
    .map(item => ({
      id: item.id,
      workspaceId: item.workspaceId,
      folderId: item.folderId,
      type: 'canvas' as const,
      title: item.name,
      modified: relativeTime(item.lastOpenedAt ?? item.updatedAt, now),
      updatedAt: item.updatedAt,
      lastOpenedAt: item.lastOpenedAt,
      size: 'Infinite canvas',
      tags: item.isPinned ? ['Canvas', 'Favorite'] : ['Canvas'],
      owner: 'Local',
      isFavorite: Boolean(item.isPinned),
    }));
  const pdfs = data.notebookPages
    .filter(item => item.type === 'pdf' && !item.deletedAt && activeNotebookIds.has(item.notebookId))
    .map(item => {
      const notebook = activeNotebooks.find(owner => owner.id === item.notebookId)!;
      return {
        id: item.id,
        workspaceId: notebook.workspaceId,
        folderId: notebook.folderId,
        type: 'pdf' as const,
        title: item.title,
        modified: relativeTime(item.lastOpenedAt ?? item.updatedAt, now),
        updatedAt: item.updatedAt,
        lastOpenedAt: item.lastOpenedAt,
        size: 'PDF document',
        pageCount: 1,
        tags: ['PDF', notebook.name],
        owner: 'Local',
        isFavorite: false,
      };
    });
  return [...notebooks, ...canvases, ...pdfs];
}

/**
 * Projects every canonical Trash root. Workspace roots remain globally
 * recoverable; all child roots are explicitly scoped to the active workspace.
/**
 * Projects every canonical Trash root globally across all workspaces.
 */
export function projectLibraryTrashFiles(data: TrashLibraryProjection, now = Date.now()): LibraryFile[] {
  const workspaceId = data.activeWorkspaceId;
  const allWorkspaces = [...(data.activeWorkspaces ?? []), ...data.workspaces];
  const allFolders = [...(data.activeFolders ?? []), ...data.folders];
  const allNotebooks = [...(data.activeNotebooks ?? []), ...data.notebooks];
  const allSections = [...(data.activeSections ?? []), ...data.sections];

  const wsMap = new Map(allWorkspaces.map(w => [w.id, w.name]));
  const folderMap = new Map(allFolders.map(f => [f.id, f]));
  const notebookById = new Map(allNotebooks.map(item => [item.id, item]));
  const sectionById = new Map(allSections.map(item => [item.id, item]));

  const ownerWorkspaceId = (item: { workspaceId?: string | null; notebookId?: string | null; sectionId?: string | null }): string | null => {
    if (item.workspaceId) return item.workspaceId;
    if (item.notebookId) return notebookById.get(item.notebookId)?.workspaceId ?? null;
    if (item.sectionId) {
      const section = sectionById.get(item.sectionId);
      return section ? notebookById.get(section.notebookId)?.workspaceId ?? null : null;
    }
    return null;
  };

  const getOriginPath = (
    ownerWsId?: string | null,
    fId?: string | null,
    nbId?: string | null,
    secId?: string | null,
  ): string => {
    const parts: string[] = [];
    if (ownerWsId && wsMap.has(ownerWsId)) parts.push(wsMap.get(ownerWsId)!);
    if (fId && folderMap.has(fId)) parts.push(folderMap.get(fId)!.name);
    if (nbId && notebookById.has(nbId)) parts.push(notebookById.get(nbId)!.name);
    if (secId && sectionById.has(secId)) parts.push(sectionById.get(secId)!.name);
    return parts.join(' / ');
  };
  const inActiveWorkspace = (item: { workspaceId?: string | null; notebookId?: string | null; sectionId?: string | null }) => (
    workspaceId !== null && ownerWorkspaceId(item) === workspaceId
  );

  const deletedFile = (
    item: { id: string; deletedAt?: number | null; updatedAt: number },
    kind: TrashEntityKind,
    type: LibraryFileType,
    title: string,
    ownerId: string,
    folderId: string | null,
    originPath?: string,
    isFavorite = false,
  ): LibraryFile => {
    const countdown = trashCountdown(item.deletedAt, now);
    return {
      id: item.id,
      workspaceId: ownerId,
      folderId,
      type,
      title,
      modified: 'In Trash',
      updatedAt: item.deletedAt ?? item.updatedAt,
      size: countdown.label,
      tags: ['Deleted', type === 'pdf' ? 'PDF' : type[0].toUpperCase() + type.slice(1)],
      owner: 'Local',
      isFavorite,
      trashKind: kind,
      originPath: originPath || undefined,
    };
  };

  return [
    ...data.workspaces.map(item => deletedFile(item, 'workspace', 'workspace', item.name, item.id, null, item.name, Boolean(item.isPinned))),
    ...data.folders.map(item => deletedFile(item, 'folder', 'folder', item.name, item.workspaceId, item.parentId, getOriginPath(item.workspaceId, item.parentId))),
    ...data.notebooks.map(item => deletedFile(item, 'notebook', 'notebook', item.name, item.workspaceId, item.folderId, getOriginPath(item.workspaceId, item.folderId), Boolean(item.isPinned))),
    ...data.sections.map(item => {
      const notebook = notebookById.get(item.notebookId);
      const ownerId = notebook?.workspaceId ?? '';
      return deletedFile(item, 'section', 'section', item.name, ownerId, notebook?.folderId ?? null, getOriginPath(ownerId, notebook?.folderId, item.notebookId));
    }),
    ...data.pages.map(item => {
      const notebook = notebookById.get(item.notebookId);
      const ownerId = notebook?.workspaceId ?? '';
      return deletedFile(item, 'page', item.type === 'pdf' ? 'pdf' : 'page', item.title || 'Untitled Page', ownerId, notebook?.folderId ?? null, getOriginPath(ownerId, notebook?.folderId, item.notebookId, item.sectionId));
    }),
    ...data.canvasFiles.map(item => deletedFile(item, 'canvas', 'canvas', item.name, item.workspaceId, item.folderId, getOriginPath(item.workspaceId, item.folderId), Boolean(item.isPinned))),
  ];
}

export function filterAndSortLibraryFiles(files: LibraryFile[], options: LibraryQuery): LibraryFile[] {
  let result = [...files];
  if (options.view === 'favorites') result = result.filter(file => file.isFavorite);
  if (options.filter !== 'all') result = result.filter(file => file.type === options.filter);
  if (options.folderId) result = result.filter(file => file.folderId === options.folderId);
  if (options.tag) result = result.filter(file => file.tags.some(tag => tag.toLocaleLowerCase() === options.tag?.toLocaleLowerCase()));

  const normalizedQuery = options.query.trim().toLocaleLowerCase();
  if (normalizedQuery) result = result.filter(file => `${file.title} ${file.tags.join(' ')}`.toLocaleLowerCase().includes(normalizedQuery));

  return result.sort((a, b) => {
    if (options.sort === 'name-asc') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    if (options.sort === 'modified-asc') return a.updatedAt - b.updatedAt || a.title.localeCompare(b.title);
    if (options.sort === 'type-asc') return a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
    const left = options.view === 'recent' ? (a.lastOpenedAt ?? a.updatedAt) : a.updatedAt;
    const right = options.view === 'recent' ? (b.lastOpenedAt ?? b.updatedAt) : b.updatedAt;
    return right - left || a.title.localeCompare(b.title);
  });
}

export function getLibraryTags(files: LibraryFile[]): string[] {
  const tags = new Map<string, string>();
  for (const file of files) for (const tag of file.tags) {
    const trimmed = tag.trim();
    if (trimmed) tags.set(trimmed.toLocaleLowerCase(), trimmed);
  }
  return [...tags.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
