import { db } from '@/database/schema';

/**
 * Migrates data from Dexie (IndexedDB) to the local file system (via Electron IPC).
 * This migration is idempotent and does not delete Dexie data, ensuring safe rollback.
 */
export async function migrateFromDexieToFs(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.panvas) {
    return false;
  }
  
  // Check if we've already migrated
  const isMigrated = localStorage.getItem('dexie_migrated');
  if (isMigrated === 'true') {
    return true;
  }

  try {
    const workspaces = await db.workspaces.toArray();
    if (workspaces.length === 0) {
      // Nothing to migrate
      return true;
    }

    console.log('[Migration] Starting Dexie to Filesystem migration...');

    // Fetch all related entities from Dexie
    const allFolders = await db.folders.toArray();
    const allCanvasFiles = await db.canvasFiles.toArray();
    const allNotebooks = await db.notebooks.toArray();
    const allNotebookSections = await db.notebookSections.toArray();
    const allNotebookPages = await db.notebookPages.toArray();
    const allCanvasData = await db.canvasData.toArray();

    for (const ws of workspaces) {
      console.log(`[Migration] Migrating workspace: ${ws.name}`);

      // Filter entities belonging to this workspace
      const wsFolders = allFolders.filter(f => f.workspaceId === ws.id);
      const wsCanvasFiles = allCanvasFiles.filter(c => c.workspaceId === ws.id);
      const wsNotebooks = allNotebooks.filter(n => n.workspaceId === ws.id);
      
      const wsNotebookIds = new Set(wsNotebooks.map(n => n.id));
      const wsSections = allNotebookSections.filter(s => wsNotebookIds.has(s.notebookId));
      const wsPages = allNotebookPages.filter(p => wsNotebookIds.has(p.notebookId));

      const wsCanvasFileIds = new Set(wsCanvasFiles.map(c => c.id));
      const wsCanvasData = allCanvasData.filter(d => wsCanvasFileIds.has(d.canvasFileId));

      const workspaceObj = {
        ...ws,
        folders: wsFolders,
        canvasFiles: wsCanvasFiles,
        notebooks: wsNotebooks,
        notebookSections: wsSections,
        notebookPages: wsPages,
      };

      // Call the IPC handler to write everything idempotently
      await window.panvas.migration.importWorkspace(workspaceObj, wsCanvasData);
    }

    console.log('[Migration] Migration complete. Filesystem is now populated.');
    localStorage.setItem('dexie_migrated', 'true');
    return true;

  } catch (err) {
    console.error('[Migration] Failed to migrate Dexie to FS:', err);
    return false;
  }
}
