export interface MigrationTable<T> {
  toArray(): Promise<T[]>;
}

export interface MigrationSource {
  workspaces: MigrationTable<any>;
  folders: MigrationTable<any>;
  canvasFiles: MigrationTable<any>;
  canvasData: MigrationTable<any>;
  customBlocks: MigrationTable<any>;
  notebooks: MigrationTable<any>;
  notebookSections: MigrationTable<any>;
  notebookPages: MigrationTable<any>;
  notebookPageContents: MigrationTable<any>;
  notebookPageDrawings: MigrationTable<any>;
  pdfFiles: MigrationTable<any>;
  imageFiles: MigrationTable<any>;
}

export interface WorkspaceMigrationBundle {
  workspace: any;
  canvasData: any[];
  pageContents: any[];
  pageDrawings: any[];
  pdfFiles: any[];
  imageFiles: any[];
}

export interface MigrationMarker {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/**
 * Older Electron bootstrap runs could materialize a fresh system default
 * workspace in Dexie on every interrupted attempt. Those records contain no
 * user-authored hierarchy or payload and are intentionally not recreated
 * after an explicit local purge. A real workspace, including a named empty
 * workspace, does not match this shape.
 */
// COMPATIBILITY: Legacy bootstrap duplicate prevention.
// Early development builds materialized a fresh system default workspace in Dexie on every
// interrupted start. Those records contain no user-authored hierarchy or payload.
// These predicates safely filter out unedited default duplicates while preserving real workspaces.
function isPurgedSystemDefaultShell(bundle: WorkspaceMigrationBundle): boolean {
  const workspace = bundle.workspace;
  const canvas = workspace.canvasFiles?.[0];
  const data = bundle.canvasData?.[0];
  return workspace.isSystem === true
    && workspace.systemType === 'default'
    && workspace.name === 'My Workspace'
    && (workspace.userId ?? null) === null
    && workspace.folders.length === 0
    && workspace.notebooks.length === 0
    && workspace.notebookSections.length === 0
    && workspace.notebookPages.length === 0
    && workspace.canvasFiles.length === 1
    && canvas?.name === 'Welcome Canvas'
    && bundle.pageContents.length === 0
    && bundle.pageDrawings.length === 0
    && bundle.pdfFiles.length === 0
    && bundle.imageFiles.length === 0
    && bundle.canvasData.length === 1
    && Array.isArray(data?.elements) && data.elements.length === 0
    && Array.isArray(data?.customBlocks) && data.customBlocks.length === 0
    && Object.keys(data?.files ?? {}).length === 0;
}

/**
 * Before the system markers were introduced, initializeDatabase created a
 * random-ID `My Workspace` shell on each Electron start. Those legacy rows
 * have the same durable shape as a default workspace, but no isSystem or
 * systemType fields. Treat the shape as a migration duplicate candidate; a
 * single unmarked candidate is retained below so an otherwise empty profile
 * still gets one local default without materializing every stale row.
 */
export function isUnmarkedLegacyDefaultShell(bundle: WorkspaceMigrationBundle): boolean {
  const workspace = bundle.workspace;
  const canvas = workspace.canvasFiles?.[0];
  const data = bundle.canvasData?.[0];
  return workspace.name === 'My Workspace'
    && (workspace.userId ?? null) === null
    && workspace.isSystem === undefined
    && workspace.systemType === undefined
    && workspace.deletedAt == null
    && workspace.folders.length === 0
    && workspace.notebooks.length === 0
    && workspace.notebookSections.length === 0
    && workspace.notebookPages.length === 0
    && workspace.canvasFiles.length === 1
    && canvas?.name === 'Welcome Canvas'
    && canvas.workspaceId === workspace.id
    && canvas.deletedAt == null
    && bundle.pageContents.length === 0
    && bundle.pageDrawings.length === 0
    && bundle.pdfFiles.length === 0
    && bundle.imageFiles.length === 0
    && bundle.canvasData.length === 1
    && data?.canvasFileId === canvas.id
    && Array.isArray(data?.elements) && data.elements.length === 0
    && Array.isArray(data?.customBlocks) && data.customBlocks.length === 0
    && Object.keys(data?.files ?? {}).length === 0;
}

function bytesPresent(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer && value.byteLength > 0;
}

// COMPATIBILITY: Relational graph integrity validation before migration.
// Enforces foreign key integrity: workspaceId -> folderId -> notebookId -> sectionId -> pageId.
// Prevents orphaned records or cyclic hierarchies from corrupting filesystem manifests.
function requireRelationships(bundle: WorkspaceMigrationBundle): void {
  const workspaceId = bundle.workspace.id;
  const folders = new Set(bundle.workspace.folders.map((item: any) => item.id));
  const notebooks = new Set(bundle.workspace.notebooks.map((item: any) => item.id));
  const sections = new Map(bundle.workspace.notebookSections.map((item: any) => [item.id, item.notebookId]));
  const pages = new Map<string, any>(bundle.workspace.notebookPages.map((item: any) => [item.id, item]));
  const canvases = new Set(bundle.workspace.canvasFiles.map((item: any) => item.id));
  const pdfs = new Set(bundle.pdfFiles.map(item => item.id));

  for (const folder of bundle.workspace.folders) {
    if (folder.workspaceId !== workspaceId || (folder.parentId && !folders.has(folder.parentId))) throw new Error('Migration folder relationship is invalid.');
  }
  for (const notebook of bundle.workspace.notebooks) {
    if (notebook.workspaceId !== workspaceId || (notebook.folderId && !folders.has(notebook.folderId))) throw new Error('Migration notebook relationship is invalid.');
  }
  for (const section of bundle.workspace.notebookSections) {
    if (!notebooks.has(section.notebookId)) throw new Error('Migration section relationship is invalid.');
  }
  for (const page of bundle.workspace.notebookPages) {
    if (!notebooks.has(page.notebookId) || sections.get(page.sectionId) !== page.notebookId) throw new Error('Migration page relationship is invalid.');
    if (page.type === 'pdf' && (!page.pdfDataId || !pdfs.has(page.pdfDataId))) throw new Error(`Migration PDF asset is missing for page ${page.id}.`);
  }
  for (const record of [...bundle.pageContents, ...bundle.pageDrawings]) {
    const owner = pages.get(record.pageId) ?? pages.get(String(record.pageId).replace(/_pdf_[1-9][0-9]*$/, ''));
    if (!owner || record.workspaceId !== workspaceId || record.notebookId !== owner.notebookId) throw new Error('Migration page payload relationship is invalid.');
  }
  for (const canvas of bundle.canvasData) if (!canvases.has(canvas.canvasFileId)) throw new Error('Migration canvas relationship is invalid.');
  for (const asset of [...bundle.pdfFiles, ...bundle.imageFiles]) if (!bytesPresent(asset.data)) throw new Error(`Migration asset ${asset.id ?? 'unknown'} is empty or corrupt.`);
}

export async function buildWorkspaceMigrationBundles(source: MigrationSource): Promise<WorkspaceMigrationBundle[]> {
  const [workspaces, folders, canvasFiles, canvasData, customBlocks, notebooks, notebookSections, notebookPages, pageContents, pageDrawings, pdfFiles, imageFiles] = await Promise.all([
    source.workspaces.toArray(), source.folders.toArray(), source.canvasFiles.toArray(), source.canvasData.toArray(), source.customBlocks.toArray(),
    source.notebooks.toArray(), source.notebookSections.toArray(), source.notebookPages.toArray(), source.notebookPageContents.toArray(),
    source.notebookPageDrawings.toArray(), source.pdfFiles.toArray(), source.imageFiles.toArray(),
  ]);

  const bundles = workspaces.map(workspace => {
    const wsFolders = folders.filter(item => item.workspaceId === workspace.id);
    const wsCanvases = canvasFiles.filter(item => item.workspaceId === workspace.id);
    const wsNotebooks = notebooks.filter(item => item.workspaceId === workspace.id);
    const notebookIds = new Set(wsNotebooks.map(item => item.id));
    const wsSections = notebookSections.filter(item => notebookIds.has(item.notebookId));
    const wsPages = notebookPages.filter(item => notebookIds.has(item.notebookId));
    const pageIds = new Set(wsPages.map(item => item.id));
    const canvasIds = new Set(wsCanvases.map(item => item.id));
    const ownerIds = new Set([...pageIds, ...canvasIds, 'temp']);
    const referencedPdfIds = new Set(wsPages.map(item => item.pdfDataId).filter(Boolean));
    const wsBlocks = customBlocks.filter(item => canvasIds.has(item.canvasFileId));
    const wsCanvasData = wsCanvases.map(canvas => {
      const existing = canvasData.find(item => item.canvasFileId === canvas.id);
      const blocks = new Map((existing?.customBlocks ?? []).map((item: any) => [item.id, item]));
      for (const block of wsBlocks.filter(item => item.canvasFileId === canvas.id)) blocks.set(block.id, block);
      return {
        canvasFileId: canvas.id,
        elements: existing?.elements ?? [], appState: existing?.appState ?? {}, files: existing?.files ?? {},
        customBlocks: [...blocks.values()],
        version: existing?.version ?? 1, updatedAt: existing?.updatedAt ?? canvas.updatedAt, userId: existing?.userId ?? canvas.userId ?? null,
      };
    });
    const bundle: WorkspaceMigrationBundle = {
      workspace: { ...workspace, folders: wsFolders, canvasFiles: wsCanvases, notebooks: wsNotebooks, notebookSections: wsSections, notebookPages: wsPages },
      canvasData: wsCanvasData,
      pageContents: pageContents.filter(item => item.workspaceId === workspace.id),
      pageDrawings: pageDrawings.filter(item => item.workspaceId === workspace.id),
      pdfFiles: pdfFiles.filter(item => ownerIds.has(item.canvasFileId) && (item.canvasFileId !== 'temp' || referencedPdfIds.has(item.id))),
      imageFiles: imageFiles.filter(item => ownerIds.has(item.canvasFileId)),
    };
    requireRelationships(bundle);
    return bundle;
  }).filter(bundle => !isPurgedSystemDefaultShell(bundle));

  // Keep at most one legacy unmarked default shell. The old random-ID
  // bootstrap bug can leave dozens of indistinguishable rows in Dexie; each
  // must not become a new filesystem root. Prefer the oldest source row and
  // use the canonical ID as a deterministic tie-breaker.
  const legacyShells = bundles
    .filter(isUnmarkedLegacyDefaultShell)
    .sort((left, right) => {
      const created = Number(left.workspace.createdAt ?? 0) - Number(right.workspace.createdAt ?? 0);
      return created || String(left.workspace.id).localeCompare(String(right.workspace.id));
    });
  const retainedLegacyShellId = legacyShells[0]?.workspace.id;
  return bundles.filter(bundle => !isUnmarkedLegacyDefaultShell(bundle) || bundle.workspace.id === retainedLegacyShellId);
}

export async function runMigrationCoordinator(
  source: MigrationSource,
  importWorkspace: (bundle: WorkspaceMigrationBundle) => Promise<boolean>,
  marker?: MigrationMarker,
): Promise<boolean> {
  try {
    const bundles = await buildWorkspaceMigrationBundles(source);
    let allImported = true;
    for (const bundle of bundles) {
      try {
        if (await importWorkspace(bundle) !== true) throw new Error(`Migration destination rejected workspace ${bundle.workspace.id}.`);
      } catch (error) {
        // A single legacy workspace must not prevent unrelated canonical IDs
        // from becoming available to Cloud Sync. Every source bundle remains
        // in Dexie, and the global marker stays incomplete until all succeed.
        allImported = false;
        console.warn('[Migration] One workspace was not imported. Source data was preserved.', {
          workspaceId: typeof bundle.workspace?.id === 'string' ? bundle.workspace.id : 'unknown',
          errorClass: error instanceof Error ? error.name : 'Error',
        });
      }
    }
    if (!allImported) {
      marker?.removeItem?.('dexie_migrated');
      return false;
    }
    marker?.setItem('dexie_migrated', 'true');
    return true;
  } catch (error) {
    marker?.removeItem?.('dexie_migrated');
    console.warn('[Migration] Dexie-to-filesystem migration did not complete. Source data was preserved.', error);
    return false;
  }
}
