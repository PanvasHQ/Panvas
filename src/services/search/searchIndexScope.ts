interface ScopeFolder {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: number;
  deletedAt?: number | null;
}

interface ScopeCanvas {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: number;
  deletedAt?: number | null;
}

interface ScopeNotebook {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  updatedAt: number;
  deletedAt?: number | null;
}

interface ScopeSection {
  id: string;
  notebookId: string;
  name: string;
  order: number;
  updatedAt: number;
  deletedAt?: number | null;
}

interface ScopePage {
  id: string;
  notebookId: string;
  sectionId: string;
  title: string;
  order: number;
  type?: string;
  pdfDataId?: string;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface LocalSearchScopeSource {
  workspaceId: string;
  folders: ScopeFolder[];
  canvasFiles: ScopeCanvas[];
  notebooks: ScopeNotebook[];
  sections: ScopeSection[];
  pages: ScopePage[];
}

function recordKey(value: unknown): string {
  return JSON.stringify(value) ?? '';
}

/** Stable signature for the source records represented by one workspace index. */
export function createLocalSearchScopeKey(source: LocalSearchScopeSource): string {
  const activeNotebooks = source.notebooks
    .filter(item => item.workspaceId === source.workspaceId && !item.deletedAt)
    .sort((a, b) => a.id.localeCompare(b.id));
  const notebookIds = new Set(activeNotebooks.map(item => item.id));
  const activeSections = source.sections
    .filter(item => notebookIds.has(item.notebookId) && !item.deletedAt)
    .sort((a, b) => a.id.localeCompare(b.id));
  const activePages = source.pages
    .filter(item => notebookIds.has(item.notebookId) && !item.deletedAt)
    .sort((a, b) => a.id.localeCompare(b.id));
  const activeFolders = source.folders
    .filter(item => item.workspaceId === source.workspaceId && !item.deletedAt)
    .sort((a, b) => a.id.localeCompare(b.id));
  const activeCanvases = source.canvasFiles
    .filter(item => item.workspaceId === source.workspaceId && !item.deletedAt)
    .sort((a, b) => a.id.localeCompare(b.id));

  return recordKey({
    workspaceId: source.workspaceId,
    folders: activeFolders.map(item => [item.id, item.name, item.updatedAt]),
    canvases: activeCanvases.map(item => [item.id, item.name, item.updatedAt]),
    notebooks: activeNotebooks.map(item => [item.id, item.name, item.folderId, item.updatedAt]),
    sections: activeSections.map(item => [item.id, item.notebookId, item.name, item.order, item.updatedAt]),
    pages: activePages.map(item => [item.id, item.notebookId, item.sectionId, item.title, item.order, item.type, item.pdfDataId, item.updatedAt]),
  });
}
