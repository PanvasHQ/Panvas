import type { CanvasData } from '@/types/canvas';
import type { Workspace, Folder, CanvasFile } from '@/types/workspace';
import type { Notebook, NotebookSection, NotebookPage } from '@/types/notebook';

export const BACKUP_VERSION = 1 as const;
export const BACKUP_TYPE = 'panvas/workspace-backup' as const;

export interface BackupHeader {
  version: typeof BACKUP_VERSION;
  type: typeof BACKUP_TYPE;
  exportedAt: number;
  workspaceName: string;
}

export interface BackupPagePayload {
  drawing: unknown;
  content: unknown;
}

export interface WorkspaceBackup {
  header: BackupHeader;
  workspace: Workspace;
  folders: Folder[];
  notebooks: Notebook[];
  sections: NotebookSection[];
  pages: NotebookPage[];
  canvases: CanvasFile[];
  pagePayloads: Record<string, BackupPagePayload>;
  canvasPayloads: Record<string, CanvasData>;
}

export interface BackupExportResult {
  backup: WorkspaceBackup;
  savedPath?: string;
  canceled?: boolean;
}

export interface BackupImportResult {
  workspaceId: string;
  workspaceName: string;
}

export interface BackupSource {
  workspace: Workspace;
  folders: Folder[];
  notebooks: Notebook[];
  sections: NotebookSection[];
  pages: NotebookPage[];
  canvases: CanvasFile[];
  pagePayloads: Record<string, BackupPagePayload>;
  canvasPayloads: Record<string, CanvasData>;
}

export interface BackupRemapOptions {
  idFactory?: (prefix: string) => string;
  workspaceName?: string;
  userId?: string | null;
  now?: number;
}

const isRecord = (value: unknown): value is Record<string, any> => Boolean(
  value && typeof value === 'object' && !Array.isArray(value),
);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function invalid(reason: string): never {
  throw new Error(`Invalid Panvas backup: ${reason}`);
}

function requireEntityCollection(value: unknown, label: string): any[] {
  if (!Array.isArray(value)) invalid(`${label} must be an array`);
  const ids = new Set<string>();
  for (const entity of value) {
    if (!isRecord(entity) || typeof entity.id !== 'string' || !entity.id.trim()) invalid(`${label} contains an invalid record`);
    if (ids.has(entity.id)) invalid(`${label} contains duplicate id ${entity.id}`);
    ids.add(entity.id);
  }
  return value;
}

function requirePayloadMap(value: unknown, label: string): Record<string, any> {
  if (!isRecord(value)) invalid(`${label} must be an object`);
  for (const [id, payload] of Object.entries(value)) {
    if (!id || !isRecord(payload)) invalid(`${label} contains an invalid payload`);
  }
  return value;
}

function validateWorkspaceName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 160 || /[\\/:*?"<>|\u0000-\u001F]/.test(value)) {
    invalid('header.workspaceName is invalid');
  }
}

/** Validate and normalize a portable backup without touching local storage. */
export function validateWorkspaceBackup(input: unknown): WorkspaceBackup {
  if (!isRecord(input)) invalid('root must be an object');
  const header = input.header;
  if (!isRecord(header) || header.version !== BACKUP_VERSION || header.type !== BACKUP_TYPE || typeof header.exportedAt !== 'number' || !Number.isFinite(header.exportedAt)) {
    invalid('header is invalid');
  }
  validateWorkspaceName(header.workspaceName);
  if (!isRecord(input.workspace) || typeof input.workspace.id !== 'string' || !input.workspace.id.trim()) invalid('workspace metadata is invalid');

  const folders = requireEntityCollection(input.folders, 'folders') as Folder[];
  const notebooks = requireEntityCollection(input.notebooks, 'notebooks') as Notebook[];
  const sections = requireEntityCollection(input.sections, 'sections') as NotebookSection[];
  const pages = requireEntityCollection(input.pages, 'pages') as NotebookPage[];
  const canvases = requireEntityCollection(input.canvases, 'canvases') as CanvasFile[];
  const pagePayloads = requirePayloadMap(input.pagePayloads, 'pagePayloads') as Record<string, BackupPagePayload>;
  const canvasPayloads = requirePayloadMap(input.canvasPayloads, 'canvasPayloads') as Record<string, CanvasData>;

  const pageIds = new Set(pages.map(page => page.id));
  const folderIds = new Set(folders.map(folder => folder.id));
  const notebookIds = new Set(notebooks.map(notebook => notebook.id));
  const sectionIds = new Set(sections.map(section => section.id));
  if (folders.some(folder => folder.workspaceId !== input.workspace.id || (folder.parentId !== null && !folderIds.has(folder.parentId)))) invalid('folder relationships are invalid');
  if (notebooks.some(notebook => notebook.workspaceId !== input.workspace.id || (notebook.folderId !== null && !folderIds.has(notebook.folderId)))) invalid('notebook relationships are invalid');
  if (sections.some(section => !notebookIds.has(section.notebookId))) invalid('section relationships are invalid');
  for (const page of pages) {
    const payload = pagePayloads[page.id];
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'drawing') || !Object.prototype.hasOwnProperty.call(payload, 'content')) invalid(`page payload is missing for ${page.id}`);
    if (typeof page.notebookId !== 'string' || !notebookIds.has(page.notebookId) || !sectionIds.has(page.sectionId)) invalid(`page ${page.id} relationships are invalid`);
  }
  if (Object.keys(pagePayloads).some(id => !pageIds.has(id))) invalid('pagePayloads contains an unknown page');
  const canvasIds = new Set(canvases.map(canvas => canvas.id));
  if (canvases.some(canvas => canvas.workspaceId !== input.workspace.id || (canvas.folderId !== null && !folderIds.has(canvas.folderId)))) invalid('canvas relationships are invalid');
  for (const canvas of canvases) {
    const payload = canvasPayloads[canvas.id];
    if (!payload || typeof payload !== 'object' || payload.canvasFileId !== canvas.id) invalid(`canvas payload is missing or mismatched for ${canvas.id}`);
  }
  if (Object.keys(canvasPayloads).some(id => !canvasIds.has(id))) invalid('canvasPayloads contains an unknown canvas');

  const normalized: WorkspaceBackup = {
    header: {
      version: BACKUP_VERSION,
      type: BACKUP_TYPE,
      exportedAt: header.exportedAt,
      workspaceName: header.workspaceName,
    },
    workspace: input.workspace as Workspace,
    folders,
    notebooks,
    sections,
    pages,
    canvases,
    pagePayloads,
    canvasPayloads,
  };
  return clone(normalized);
}

export function parseWorkspaceBackup(input: string | unknown): WorkspaceBackup {
  if (typeof input === 'string') {
    try {
      return validateWorkspaceBackup(JSON.parse(input));
    } catch (error) {
      if (error instanceof SyntaxError) invalid('JSON is malformed');
      throw error;
    }
  }
  return validateWorkspaceBackup(input);
}

export function serializeWorkspaceBackup(input: WorkspaceBackup): string {
  return JSON.stringify(validateWorkspaceBackup(input), null, 2);
}

export function buildWorkspaceBackup(source: BackupSource, exportedAt = Date.now()): WorkspaceBackup {
  const backup = {
    header: {
      version: BACKUP_VERSION,
      type: BACKUP_TYPE,
      exportedAt,
      workspaceName: source.workspace.name,
    },
    workspace: source.workspace,
    folders: source.folders,
    notebooks: source.notebooks,
    sections: source.sections,
    pages: source.pages,
    canvases: source.canvases,
    pagePayloads: source.pagePayloads,
    canvasPayloads: source.canvasPayloads,
  } satisfies WorkspaceBackup;
  return validateWorkspaceBackup(backup);
}

/** Remap every persisted identifier and relationship for a safe new restore. */
export function remapWorkspaceBackup(input: WorkspaceBackup, options: BackupRemapOptions = {}): WorkspaceBackup {
  const backup = validateWorkspaceBackup(input);
  let sequence = 0;
  const idFactory = options.idFactory ?? ((prefix: string) => `${prefix}-restored-${++sequence}`);
  const workspaceId = idFactory('ws');
  const folderIds = new Map(backup.folders.map(folder => [folder.id, idFactory('folder')]));
  const notebookIds = new Map(backup.notebooks.map(notebook => [notebook.id, idFactory('notebook')]));
  const sectionIds = new Map(backup.sections.map(section => [section.id, idFactory('section')]));
  const pageIds = new Map(backup.pages.map(page => [page.id, idFactory('page')]));
  const canvasIds = new Map(backup.canvases.map(canvas => [canvas.id, idFactory('canvas')]));
  const now = options.now ?? Date.now();
  const userId = options.userId === undefined ? backup.workspace.userId ?? null : options.userId;
  const workspace = clone({ ...backup.workspace, id: workspaceId, name: options.workspaceName ?? `${backup.workspace.name} (Restored)`, userId, updatedAt: now, deletedAt: null });
  const folders = clone(backup.folders.map(folder => ({ ...folder, id: folderIds.get(folder.id)!, workspaceId, parentId: folder.parentId ? (folderIds.get(folder.parentId) ?? null) : null, userId })));
  const notebooks = clone(backup.notebooks.map(notebook => ({ ...notebook, id: notebookIds.get(notebook.id)!, workspaceId, folderId: notebook.folderId ? (folderIds.get(notebook.folderId) ?? null) : null, userId })));
  const sections = clone(backup.sections.map(section => ({ ...section, id: sectionIds.get(section.id)!, notebookId: notebookIds.get(section.notebookId) ?? section.notebookId, userId })));
  const pages = clone(backup.pages.map(page => ({ ...page, id: pageIds.get(page.id)!, notebookId: notebookIds.get(page.notebookId) ?? page.notebookId, sectionId: sectionIds.get(page.sectionId) ?? page.sectionId, userId })));
  const canvases = clone(backup.canvases.map(canvas => ({ ...canvas, id: canvasIds.get(canvas.id)!, workspaceId, folderId: canvas.folderId ? (folderIds.get(canvas.folderId) ?? null) : null, notebookId: canvas.notebookId ? (notebookIds.get(canvas.notebookId) ?? null) : null, sectionId: canvas.sectionId ? (sectionIds.get(canvas.sectionId) ?? null) : null, userId })));
  const pagePayloads: Record<string, BackupPagePayload> = {};
  for (const page of backup.pages) pagePayloads[pageIds.get(page.id)!] = clone(backup.pagePayloads[page.id]);
  const canvasPayloads: Record<string, CanvasData> = {};
  for (const canvas of backup.canvases) canvasPayloads[canvasIds.get(canvas.id)!] = clone({ ...backup.canvasPayloads[canvas.id], canvasFileId: canvasIds.get(canvas.id)!, userId, updatedAt: now });
  return validateWorkspaceBackup({ header: { ...backup.header, exportedAt: now, workspaceName: workspace.name }, workspace, folders, notebooks, sections, pages, canvases, pagePayloads, canvasPayloads });
}

export async function exportWorkspaceBackup(workspaceId: string, userId: string | null = null): Promise<BackupExportResult> {
  const runtime = globalThis as any;
  if (runtime.panvas?.backup) return runtime.panvas.backup.export(workspaceId);
  const { collectBrowserWorkspaceBackup } = await import('./backupBrowserStorage');
  return { backup: await collectBrowserWorkspaceBackup(workspaceId, userId) };
}

export async function importWorkspaceBackup(input: string | WorkspaceBackup, userId: string | null = null): Promise<BackupImportResult> {
  const backup = parseWorkspaceBackup(input);
  const runtime = globalThis as any;
  if (runtime.panvas?.backup) return runtime.panvas.backup.import(backup);
  const { restoreBrowserWorkspaceBackup } = await import('./backupBrowserStorage');
  return restoreBrowserWorkspaceBackup(backup, userId);
}

export async function importWorkspaceBackupFromDialog(): Promise<(BackupImportResult & { canceled?: false }) | { canceled: true }> {
  const runtime = globalThis as any;
  if (!runtime.panvas?.backup?.importDialog) throw new Error('Native backup import is unavailable.');
  return runtime.panvas.backup.importDialog();
}
