import type { Notebook, NotebookPage, NotebookSection } from '../../types/notebook.ts';
import type { Workspace } from '../../types/workspace.ts';

export interface NotebookExportCatalog {
  notebooks: Notebook[];
  notebookSections: NotebookSection[];
  notebookPages: NotebookPage[];
  workspaces: Workspace[];
  deletedWorkspaces?: Workspace[];
}

export interface NotebookExportCommandTarget {
  type: 'notebook';
  notebookId: string;
  workspaceId: string;
}

export interface PageExportCommandTarget {
  type: 'page';
  pageId: string;
  sectionId: string;
  notebookId: string;
  workspaceId: string;
}

export interface SectionExportCommandTarget {
  type: 'section';
  sectionId: string;
  notebookId: string;
  workspaceId: string;
}

export type NotebookExportTarget = string | NotebookExportCommandTarget;
export type PageExportTarget = string | PageExportCommandTarget;
export type SectionExportTarget = string | SectionExportCommandTarget;

export function createNotebookExportTarget(notebook: Notebook): NotebookExportCommandTarget {
  return { type: 'notebook', notebookId: notebook.id, workspaceId: notebook.workspaceId };
}

export function createPageExportTarget(
  page: NotebookPage,
  section: NotebookSection,
  notebook: Notebook,
): PageExportCommandTarget {
  return {
    type: 'page',
    pageId: page.id,
    sectionId: section.id,
    notebookId: notebook.id,
    workspaceId: notebook.workspaceId,
  };
}

export function createSectionExportTarget(
  section: NotebookSection,
  notebook: Notebook,
): SectionExportCommandTarget {
  return {
    type: 'section',
    sectionId: section.id,
    notebookId: notebook.id,
    workspaceId: notebook.workspaceId,
  };
}

export interface ResolvedNotebookExportTarget {
  notebook: Notebook;
  workspaceId: string;
}

/** Resolve the clicked notebook itself; active notebook/workspace IDs are irrelevant. */
export function resolveNotebookExportTarget(
  catalog: NotebookExportCatalog,
  target: NotebookExportTarget,
): ResolvedNotebookExportTarget {
  const notebookId = typeof target === 'string' ? target : target.notebookId;
  const notebook = catalog.notebooks.find(item => item.id === notebookId && !item.deletedAt);
  if (!notebook || typeof notebook.workspaceId !== 'string' || !notebook.workspaceId) {
    throw new Error('The selected notebook no longer exists.');
  }
  const deletedWorkspace = catalog.deletedWorkspaces?.find(item => item.id === notebook.workspaceId && item.deletedAt);
  const loadedWorkspace = catalog.workspaces.find(item => item.id === notebook.workspaceId);
  if (deletedWorkspace || loadedWorkspace?.deletedAt) {
    throw new Error('The selected notebook no longer exists.');
  }
  // An inactive workspace can be absent from the current workspace collection
  // while its globally loaded notebook remains visible in the tree. The
  // notebook's persisted workspaceId is the canonical repository/IPC key.
  return { notebook, workspaceId: notebook.workspaceId };
}

export function resolvePageExportTarget(
  catalog: NotebookExportCatalog,
  target: PageExportTarget,
): ResolvedNotebookExportTarget & { page: NotebookPage } {
  const pageId = typeof target === 'string' ? target : target.pageId;
  const page = catalog.notebookPages.find(item => item.id === pageId && !item.deletedAt);
  if (!page) throw new Error('The selected page no longer exists.');
  // Section ownership is canonical. page.notebookId is retained for storage
  // compatibility, but can lag after a page/section move and must not decide
  // which workspace a visible tree row belongs to.
  const section = catalog.notebookSections.find(item => item.id === page.sectionId && !item.deletedAt);
  const notebook = section
    ? catalog.notebooks.find(item => item.id === section.notebookId && !item.deletedAt)
    : undefined;
  if (!notebook || typeof notebook.workspaceId !== 'string' || !notebook.workspaceId) {
    throw new Error('The page workspace could not be resolved.');
  }
  const deletedWorkspace = catalog.deletedWorkspaces?.find(item => item.id === notebook.workspaceId && item.deletedAt);
  const loadedWorkspace = catalog.workspaces.find(item => item.id === notebook.workspaceId);
  if (deletedWorkspace || loadedWorkspace?.deletedAt) {
    throw new Error('The page workspace could not be resolved.');
  }
  return { page, notebook, workspaceId: notebook.workspaceId };
}

export function resolveSectionExportTarget(
  catalog: NotebookExportCatalog,
  target: SectionExportTarget,
): ResolvedNotebookExportTarget & { section: NotebookSection } {
  const sectionId = typeof target === 'string' ? target : target.sectionId;
  const section = catalog.notebookSections.find(item => item.id === sectionId && !item.deletedAt);
  if (!section) throw new Error('The selected section no longer exists.');
  const notebook = catalog.notebooks.find(item => item.id === section.notebookId && !item.deletedAt);
  if (!notebook || typeof notebook.workspaceId !== 'string' || !notebook.workspaceId) {
    throw new Error('The section workspace could not be resolved.');
  }
  const deletedWorkspace = catalog.deletedWorkspaces?.find(item => item.id === notebook.workspaceId && item.deletedAt);
  const loadedWorkspace = catalog.workspaces.find(item => item.id === notebook.workspaceId);
  if (deletedWorkspace || loadedWorkspace?.deletedAt) throw new Error('The section workspace could not be resolved.');
  return { section, notebook, workspaceId: notebook.workspaceId };
}
