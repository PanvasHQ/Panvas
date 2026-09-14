import path from 'path';
import { promises as fsPromises } from 'fs';
import type { WorkspaceMigrationBundle } from '../../src/lib/migration-core.js';
import type { WriteQueue } from './write-queue.js';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

interface MigrationDirectoryIndex {
  byWorkspaceId: Map<string, string>;
  occupied: Set<string>;
}

const migrationDirectoryIndexes = new Map<string, Promise<MigrationDirectoryIndex>>();

function safeWorkspaceDirectoryName(value: unknown, fallback: string): string {
  return String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .trim()
    .slice(0, 120) || fallback;
}

export interface MigrationDestination {
  workspaceDir: string;
  pdfStoreDir: string;
  imageStoreDir: string;
  audioStoreDir: string;
  writeQueue: WriteQueue;
  registerWorkspace(workspaceId: string, workspaceDir: string): void;
}

async function readJson(filePath: string): Promise<any | null> {
  try { return JSON.parse(await fsPromises.readFile(filePath, 'utf8')); }
  catch (error: any) { if (error?.code === 'ENOENT') return null; throw error; }
}

function migrationDirectoryIndex(baseDir: string): Promise<MigrationDirectoryIndex> {
  const resolvedBase = path.resolve(baseDir);
  const existing = migrationDirectoryIndexes.get(resolvedBase);
  if (existing) return existing;
  const pending = (async () => {
    const entries = await fsPromises.readdir(resolvedBase, { withFileTypes: true }).catch(() => [] as import('fs').Dirent[]);
    const candidates = [resolvedBase, ...entries.filter(entry => entry.isDirectory()).map(entry => path.join(resolvedBase, entry.name))];
    const byWorkspaceId = new Map<string, string>();
    const occupied = new Set(candidates.map(candidate => path.resolve(candidate)));
    await Promise.all(candidates.map(async candidate => {
      const existingWorkspace = await readJson(path.join(candidate, '.panvas', 'workspace.json')).catch(() => null);
      if (SAFE_ID.test(String(existingWorkspace?.id ?? ''))) byWorkspaceId.set(existingWorkspace.id, candidate);
      if (!existingWorkspace) {
        const incomplete = await readJson(path.join(candidate, '.panvas', 'system.json')).catch(() => null);
        if (incomplete?.migration_complete === false && SAFE_ID.test(String(incomplete.workspaceId ?? ''))) {
          byWorkspaceId.set(incomplete.workspaceId, candidate);
        }
      }
    }));
    return { byWorkspaceId, occupied };
  })();
  migrationDirectoryIndexes.set(resolvedBase, pending);
  return pending;
}

/**
 * Resolve a Dexie workspace by canonical ID. Display names are only a folder
 * preference: an occupied same-name directory owned by another ID gets a
 * distinct migration directory and is never passed to the merge routine.
 */
export async function resolveMigrationWorkspaceDirectory(
  baseDir: string,
  workspace: { id: string; name?: string },
): Promise<string> {
  if (!SAFE_ID.test(String(workspace.id))) throw new Error('Invalid workspace identifier.');
  const resolvedBase = path.resolve(baseDir);
  const index = await migrationDirectoryIndex(resolvedBase);
  const canonical = index.byWorkspaceId.get(workspace.id);
  if (canonical) return canonical;

  const safeBase = safeWorkspaceDirectoryName(workspace.name, workspace.id);
  for (let suffix = 1; ; suffix += 1) {
    const directoryName = suffix === 1 ? safeBase : `${safeBase} (Migrated ${suffix})`;
    const candidate = path.resolve(resolvedBase, directoryName);
    if (path.dirname(candidate) !== resolvedBase) throw new Error('Migration destination is outside the storage folder.');
    if (index.occupied.has(candidate)) continue;
    try {
      await fsPromises.access(candidate);
      // A directory appeared after the index was built. Treat it as
      // occupied and inspect its canonical owner below.
      index.occupied.add(candidate);
    } catch {
      index.occupied.add(candidate);
      index.byWorkspaceId.set(workspace.id, candidate);
      return candidate;
    }
    const existing = await readJson(path.join(candidate, '.panvas', 'workspace.json')).catch(() => null);
    if (existing?.id === workspace.id) {
      index.byWorkspaceId.set(workspace.id, candidate);
      return candidate;
    }
    const incomplete = await readJson(path.join(candidate, '.panvas', 'system.json')).catch(() => null);
    if (!existing && incomplete?.migration_complete === false && incomplete?.workspaceId === workspace.id) {
      index.byWorkspaceId.set(workspace.id, candidate);
      return candidate;
    }
  }
}

function updatedAt(value: any): number {
  return typeof value?.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0;
}

function mergeCollection(existing: any[], incoming: any[]): any[] {
  const merged = new Map(existing.map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = merged.get(item.id);
    if (!previous || updatedAt(item) >= updatedAt(previous)) merged.set(item.id, item);
  }
  return [...merged.values()];
}

function mergeWorkspace(existing: any | null, incoming: any): any {
  if (!existing) return incoming;
  // Canonical IDs, not display names, decide ownership. This should be
  // unreachable because destination allocation probes the existing metadata,
  // but keep the race/error boundary sanitized so a transient collision never
  // emits a user's folder name or reopens the account-migration loop.
  if (existing.id !== incoming.id) throw new Error('Workspace destination collision.');
  const root = updatedAt(existing) > updatedAt(incoming) ? existing : { ...existing, ...incoming };
  return {
    ...root,
    folders: mergeCollection(existing.folders ?? [], incoming.folders ?? []),
    canvasFiles: mergeCollection(existing.canvasFiles ?? [], incoming.canvasFiles ?? []),
    notebooks: mergeCollection(existing.notebooks ?? [], incoming.notebooks ?? []),
    notebookSections: mergeCollection(existing.notebookSections ?? [], incoming.notebookSections ?? []),
    notebookPages: mergeCollection(existing.notebookPages ?? [], incoming.notebookPages ?? []),
  };
}

async function writeJsonUnlessNewer(queue: WriteQueue, filePath: string, value: unknown, sourceUpdatedAt: number): Promise<void> {
  try {
    const stat = await fsPromises.stat(filePath);
    if (stat.mtimeMs > sourceUpdatedAt) return;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await queue.enqueue(filePath, JSON.stringify(value, null, 2));
}

async function ensureBinary(
  queue: WriteQueue,
  dir: string,
  asset: any,
  metadata: Record<string, unknown>,
): Promise<void> {
  const binPath = path.join(dir, `${asset.id}.bin`);
  const metaPath = path.join(dir, `${asset.id}.meta.json`);
  const source = Buffer.from(new Uint8Array(asset.data));
  let existingMeta: any | null = null;
  let existingBytes: Buffer | null = null;
  try { existingMeta = await readJson(metaPath); } catch { existingMeta = null; }
  try { existingBytes = await fsPromises.readFile(binPath); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  if (existingMeta?.id === asset.id && existingBytes?.length) {
    if (!existingBytes.equals(source)) throw new Error(`Migration asset conflict for ${asset.id}; the existing valid destination was preserved.`);
    return;
  }
  await queue.enqueue(binPath, new Uint8Array(asset.data));
  await queue.enqueue(metaPath, JSON.stringify(metadata, null, 2));
}

async function validateDestination(bundle: WorkspaceMigrationBundle, destination: MigrationDestination): Promise<void> {
  const panvasDir = path.join(destination.workspaceDir, '.panvas');
  const metadata = await readJson(path.join(panvasDir, 'workspace.json'));
  if (!metadata || metadata.id !== bundle.workspace.id) throw new Error('Migrated workspace metadata validation failed.');
  for (const [key, values] of Object.entries({
    folders: bundle.workspace.folders, canvasFiles: bundle.workspace.canvasFiles, notebooks: bundle.workspace.notebooks,
    notebookSections: bundle.workspace.notebookSections, notebookPages: bundle.workspace.notebookPages,
  })) {
    const ids = new Set((metadata[key] ?? []).map((item: any) => item.id));
    if ((values as any[]).some(item => !ids.has(item.id))) throw new Error(`Migrated ${key} validation failed.`);
  }
  for (const record of bundle.pageContents) JSON.parse(await fsPromises.readFile(path.join(destination.workspaceDir, 'Notebooks', record.notebookId, 'pages', `${record.pageId}.content.json`), 'utf8'));
  for (const record of bundle.pageDrawings) JSON.parse(await fsPromises.readFile(path.join(destination.workspaceDir, 'Notebooks', record.notebookId, 'pages', `${record.pageId}.drawing.json`), 'utf8'));
  for (const canvas of bundle.canvasData) JSON.parse(await fsPromises.readFile(path.join(destination.workspaceDir, 'Canvas', `${canvas.canvasFileId}.json`), 'utf8'));
  for (const asset of bundle.pdfFiles) {
    const bytes = await fsPromises.readFile(path.join(destination.pdfStoreDir, `${asset.id}.bin`));
    if (!bytes.equals(Buffer.from(new Uint8Array(asset.data)))) throw new Error(`Migrated PDF ${asset.id} validation failed.`);
  }
  for (const asset of bundle.imageFiles) {
    const store = /^audio\//i.test(asset.mimeType) ? destination.audioStoreDir : destination.imageStoreDir;
    const bytes = await fsPromises.readFile(path.join(store, `${asset.id}.bin`));
    if (!bytes.equals(Buffer.from(new Uint8Array(asset.data)))) throw new Error(`Migrated asset ${asset.id} validation failed.`);
  }
}

export async function importDexieWorkspace(bundle: WorkspaceMigrationBundle, destination: MigrationDestination): Promise<boolean> {
  const { workspaceDir, writeQueue } = destination;
  for (const notebook of bundle.workspace.notebooks ?? []) {
    if (!SAFE_ID.test(String(notebook.id))) throw new Error('Invalid notebook identifier.');
  }
  for (const section of bundle.workspace.notebookSections ?? []) {
    if (!SAFE_ID.test(String(section.id)) || !SAFE_ID.test(String(section.notebookId))) throw new Error('Invalid notebook section relationship.');
  }
  for (const page of bundle.workspace.notebookPages ?? []) {
    if (!SAFE_ID.test(String(page.id)) || !SAFE_ID.test(String(page.notebookId)) || !SAFE_ID.test(String(page.sectionId))) throw new Error('Invalid notebook page relationship.');
  }
  for (const record of [...bundle.pageContents, ...bundle.pageDrawings]) {
    if (!SAFE_ID.test(String(record.pageId)) || !SAFE_ID.test(String(record.notebookId))) throw new Error('Invalid page payload relationship.');
  }
  for (const canvas of bundle.canvasData) {
    if (!SAFE_ID.test(String(canvas.canvasFileId))) throw new Error('Invalid canvas identifier.');
  }
  for (const asset of [...bundle.pdfFiles, ...bundle.imageFiles]) {
    if (!SAFE_ID.test(String(asset.id))) throw new Error('Invalid asset identifier.');
  }
  const panvasDir = path.join(workspaceDir, '.panvas');
  const [completedSystem, completedWorkspace] = await Promise.all([
    readJson(path.join(panvasDir, 'system.json')).catch(() => null),
    readJson(path.join(panvasDir, 'workspace.json')).catch(() => null),
  ]);
  if (completedSystem?.migration_complete === true
    && completedSystem.workspaceId === bundle.workspace.id
    && completedWorkspace?.id === bundle.workspace.id) {
    destination.registerWorkspace(bundle.workspace.id, workspaceDir);
    return true;
  }
  await Promise.all([
    fsPromises.mkdir(path.join(panvasDir, 'journal'), { recursive: true }), fsPromises.mkdir(path.join(panvasDir, 'recovery'), { recursive: true }),
    fsPromises.mkdir(path.join(panvasDir, 'temp'), { recursive: true }), fsPromises.mkdir(path.join(panvasDir, 'Plugins'), { recursive: true }),
    fsPromises.mkdir(path.join(workspaceDir, 'Notebooks'), { recursive: true }), fsPromises.mkdir(path.join(workspaceDir, 'Canvas'), { recursive: true }),
    fsPromises.mkdir(path.join(workspaceDir, 'PDF'), { recursive: true }), fsPromises.mkdir(destination.pdfStoreDir, { recursive: true }),
    fsPromises.mkdir(destination.imageStoreDir, { recursive: true }), fsPromises.mkdir(destination.audioStoreDir, { recursive: true }),
  ]);
  await writeQueue.enqueue(path.join(panvasDir, 'system.json'), JSON.stringify({ version: 1, workspaceId: bundle.workspace.id, migration_complete: false }, null, 2));

  const existing = await readJson(path.join(panvasDir, 'workspace.json'));
  const merged = mergeWorkspace(existing, bundle.workspace);
  for (const notebook of merged.notebooks ?? []) await fsPromises.mkdir(path.join(workspaceDir, 'Notebooks', notebook.id, 'pages'), { recursive: true });
  for (const record of bundle.pageContents) await writeJsonUnlessNewer(writeQueue, path.join(workspaceDir, 'Notebooks', record.notebookId, 'pages', `${record.pageId}.content.json`), record.data, updatedAt(record));
  for (const record of bundle.pageDrawings) await writeJsonUnlessNewer(writeQueue, path.join(workspaceDir, 'Notebooks', record.notebookId, 'pages', `${record.pageId}.drawing.json`), record.data, updatedAt(record));
  for (const canvas of bundle.canvasData) await writeJsonUnlessNewer(writeQueue, path.join(workspaceDir, 'Canvas', `${canvas.canvasFileId}.json`), canvas, updatedAt(canvas));
  for (const asset of bundle.pdfFiles) await ensureBinary(writeQueue, destination.pdfStoreDir, asset, { id: asset.id, fileName: asset.fileName, createdAt: asset.createdAt, ownerId: asset.canvasFileId });
  for (const asset of bundle.imageFiles) {
    const store = /^audio\//i.test(asset.mimeType) ? destination.audioStoreDir : destination.imageStoreDir;
    await ensureBinary(writeQueue, store, asset, { id: asset.id, fileName: asset.fileName, mimeType: asset.mimeType, createdAt: asset.createdAt, ownerId: asset.canvasFileId });
  }
  await writeQueue.enqueue(path.join(panvasDir, 'settings.json'), JSON.stringify({ version: 1 }, null, 2));
  await writeQueue.enqueue(path.join(panvasDir, 'workspace.json'), JSON.stringify(merged, null, 2));
  await validateDestination(bundle, destination);
  await writeQueue.enqueue(path.join(panvasDir, 'system.json'), JSON.stringify({ version: 1, workspaceId: bundle.workspace.id, migration_complete: true, completedAt: Date.now() }, null, 2));
  destination.registerWorkspace(bundle.workspace.id, workspaceDir);
  return true;
}
