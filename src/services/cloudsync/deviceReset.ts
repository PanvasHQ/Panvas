import { clearDeviceResetPending, db, markDeviceResetPending } from '@/database/schema';
import { dexieSyncV2ConflictStore } from './v2/conflictStore';
import { LocalStorageSyncV2BaselineStore } from './v2/baselineStore';
import { removeWorkspaceBindingsForIds } from './workspaceBindings';

const sameOwner = (value: { userId?: string | null }, userId: string | null): boolean => (value.userId ?? null) === (userId ?? null);

/**
 * Clears the browser's current Panvas replica in one transaction. The
 * verified Drive account is intentionally not involved here: reset deletes
 * local content and sync metadata only, then the normal V2 run rehydrates it.
 */
// SECURITY: Isolated local device reset safety invariant.
// Device reset purges ONLY the local IndexedDB/Dexie replica and local sync baselines.
// It NEVER issues remote deletions to Google Drive, preserves OAuth credentials,
// and ensures remote cloud backups remain untouched before re-hydration.
export async function resetBrowserLocalData(userId: string | null): Promise<string[]> {
  markDeviceResetPending();
  let workspaceIds: string[] = [];
  await db.transaction('rw', db.tables, async () => {
    const [workspaces, folders, canvases, notebooks, sections, pages, contents, drawings, scenes, blocks, pdfs, images, journals] = await Promise.all([
      db.workspaces.toArray(), db.folders.toArray(), db.canvasFiles.toArray(), db.notebooks.toArray(), db.notebookSections.toArray(), db.notebookPages.toArray(),
      db.notebookPageContents.toArray(), db.notebookPageDrawings.toArray(), db.canvasData.toArray(), db.customBlocks.toArray(), db.pdfFiles.toArray(), db.imageFiles.toArray(), db.syncJournal.toArray(),
    ]);
    const ownedWorkspaces = workspaces.filter(item => sameOwner(item, userId));
    // Include workspace IDs carried by owned child rows as well. This makes
    // stale/orphaned workspace bindings disposable even when an older local
    // migration lost the workspace root row itself.
    const workspaceIdSet = new Set([
      ...ownedWorkspaces.map(item => item.id),
      ...folders.filter(item => sameOwner(item, userId)).map(item => item.workspaceId),
      ...canvases.filter(item => sameOwner(item, userId)).map(item => item.workspaceId),
      ...notebooks.filter(item => sameOwner(item, userId)).map(item => item.workspaceId),
      ...contents.filter(item => sameOwner(item, userId)).map(item => item.workspaceId),
      ...drawings.filter(item => sameOwner(item, userId)).map(item => item.workspaceId),
    ]);
    const ownedFolders = folders.filter(item => sameOwner(item, userId) || workspaceIdSet.has(item.workspaceId));
    const ownedCanvases = canvases.filter(item => sameOwner(item, userId) || workspaceIdSet.has(item.workspaceId));
    const ownedNotebooks = notebooks.filter(item => sameOwner(item, userId) || workspaceIdSet.has(item.workspaceId));
    const notebookIdSet = new Set(ownedNotebooks.map(item => item.id));
    const ownedSections = sections.filter(item => sameOwner(item, userId) || notebookIdSet.has(item.notebookId));
    const sectionIdSet = new Set(ownedSections.map(item => item.id));
    const ownedPages = pages.filter(item => sameOwner(item, userId) || notebookIdSet.has(item.notebookId) || sectionIdSet.has(item.sectionId));
    const pageIdSet = new Set(ownedPages.map(item => item.id));
    const canvasIdSet = new Set(ownedCanvases.map(item => item.id));
    const ownedContents = contents.filter(item => sameOwner(item, userId) || workspaceIdSet.has(item.workspaceId) || pageIdSet.has(item.pageId));
    const ownedDrawings = drawings.filter(item => sameOwner(item, userId) || workspaceIdSet.has(item.workspaceId) || pageIdSet.has(item.pageId));
    const ownedScenes = scenes.filter(item => sameOwner(item, userId) || canvasIdSet.has(item.canvasFileId));
    const ownedBlocks = blocks.filter(item => sameOwner(item, userId) || canvasIdSet.has(item.canvasFileId));
    const ownedPdfs = pdfs.filter(item => sameOwner(item, userId) || canvasIdSet.has(item.canvasFileId));
    const ownedImages = images.filter(item => sameOwner(item, userId) || canvasIdSet.has(item.canvasFileId));
    const ownedJournals = journals.filter(item => workspaceIdSet.has(item.workspaceId));
    workspaceIds = [...workspaceIdSet];
    await Promise.all([
      db.workspaces.bulkDelete(ownedWorkspaces.map(item => item.id)),
      db.folders.bulkDelete(ownedFolders.map(item => item.id)),
      db.canvasFiles.bulkDelete(ownedCanvases.map(item => item.id)),
      db.notebooks.bulkDelete(ownedNotebooks.map(item => item.id)),
      db.notebookSections.bulkDelete(ownedSections.map(item => item.id)),
      db.notebookPages.bulkDelete(ownedPages.map(item => item.id)),
      db.notebookPageContents.bulkDelete(ownedContents.map(item => item.pageId)),
      db.notebookPageDrawings.bulkDelete(ownedDrawings.map(item => item.pageId)),
      db.canvasData.bulkDelete(ownedScenes.map(item => item.canvasFileId)),
      db.customBlocks.bulkDelete(ownedBlocks.map(item => item.id)),
      db.pdfFiles.bulkDelete(ownedPdfs.map(item => item.id)),
      db.imageFiles.bulkDelete(ownedImages.map(item => item.id)),
      db.syncJournal.bulkDelete(ownedJournals.map(item => item.entryId)),
      db.syncQueue.clear(),
    ]);
  });
  removeWorkspaceBindingsForIds(workspaceIds);
  const baselineStore = new LocalStorageSyncV2BaselineStore();
  await baselineStore.clear?.();
  await dexieSyncV2ConflictStore.clear?.();
  return workspaceIds;
}

/** Called only after the normal post-reset V2 run has reached a terminal
 * success state. A failed run deliberately keeps the marker so startup does
 * not recreate a local shell before the next retry. */
export function completeDeviceResetHydration(): void { clearDeviceResetPending(); }
