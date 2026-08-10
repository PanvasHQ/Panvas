// ============================================
// Panvas — Sync Engine
// Processes the offline sync queue against Supabase
// Implements outbox pattern with last-write-wins
// ============================================

import { supabase, isSupabaseConfigured } from '@/services/supabase/client';
import { db } from '@/database/schema';
import type { SyncQueueItem } from '@/types/sync';
import { canvasSceneSchema } from '@/lib/validation/sync';
import type { CustomBlock } from '@/types/canvas';

const MAX_ATTEMPTS = 5;

const ENTITY_SYNC_PRIORITY: Record<SyncQueueItem['entityType'], number> = {
  workspace: 0,
  folder: 1,
  canvasFile: 2,
  canvasData: 3,
};

function getSyncPriority(item: SyncQueueItem): number {
  if (item.action === 'delete') {
    return 100 - ENTITY_SYNC_PRIORITY[item.entityType];
  }

  return ENTITY_SYNC_PRIORITY[item.entityType];
}

function assertSupabaseSuccess<T extends { error: unknown }>(result: T): void {
  if (result.error) {
    const error = result.error as { message?: string };
    throw new Error(error.message ?? 'Supabase request failed');
  }
}

async function upsertQueueItem(item: Omit<SyncQueueItem, 'id' | 'attempts' | 'createdAt' | 'status'>) {
  const existing = await db.syncQueue
    .where('entityId')
    .equals(item.entityId)
    .filter(existingItem =>
      existingItem.entityType === item.entityType &&
      existingItem.action === item.action &&
      existingItem.status !== 'processing'
    )
    .first();

  if (existing?.id) {
    await db.syncQueue.update(existing.id, {
      data: item.data,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      error: undefined,
    });
    return;
  }

  await db.syncQueue.add({
    ...item,
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
  });
}

/**
 * Process all pending items in the sync queue.
 * Called by SyncScheduler on interval and on reconnection.
 */
export async function processSyncQueue(userId: string): Promise<{ processed: number; failed: number }> {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return { processed: 0, failed: 0 };
  }

  const pending = await db.syncQueue
    .where('status')
    .anyOf(['pending', 'failed'])
    .sortBy('createdAt');

  // Filter out items that exceeded max attempts
  const retryable = pending
    .filter(item => item.status === 'pending' || item.attempts < MAX_ATTEMPTS)
    .sort((a, b) => {
      const priorityDiff = getSyncPriority(a) - getSyncPriority(b);
      return priorityDiff || a.createdAt - b.createdAt;
    });

  let processed = 0;
  let failed = 0;

  for (const item of retryable) {
    try {
      await db.syncQueue.update(item.id!, { status: 'processing' });

      switch (item.entityType) {
        case 'workspace':
          await syncWorkspace(item, userId);
          break;
        case 'folder':
          await syncFolder(item, userId);
          break;
        case 'canvasFile':
          await syncCanvasFile(item, userId);
          break;
        case 'canvasData':
          await syncCanvasData(item, userId);
          break;
      }

      // Success — remove from queue and mark entity as synced
      await db.syncQueue.delete(item.id!);
      await markEntitySynced(item.entityType, item.entityId);
      processed++;
    } catch (err) {
      if (String(err).includes('violates row-level security policy')) {
        console.warn(`[SyncEngine] Dropping cross-account item ${item.entityType}:${item.entityId}`);
        await db.syncQueue.delete(item.id!);
        // Purge the offending item from local DB to prevent it from getting re-queued
        if (item.entityType === 'workspace') await db.workspaces.delete(item.entityId);
        if (item.entityType === 'folder') await db.folders.delete(item.entityId);
        if (item.entityType === 'canvasFile') {
          await db.canvasFiles.delete(item.entityId);
          await db.canvasData.delete(item.entityId);
        }
        continue;
      }

      console.error(`[SyncEngine] Failed: ${item.entityType}:${item.entityId}`, err);
      const newAttempts = item.attempts + 1;
      if (newAttempts >= MAX_ATTEMPTS) {
        await db.syncQueue.update(item.id!, {
          status: 'failed',
          attempts: newAttempts,
          lastAttemptAt: Date.now(),
          error: String(err),
        });
      } else {
        // Reset to pending for retry
        await db.syncQueue.update(item.id!, {
          status: 'pending',
          attempts: newAttempts,
          lastAttemptAt: Date.now(),
          error: String(err),
        });
      }
      failed++;
      
      // Critical: if a parent item (like a workspace) fails due to network/auth,
      // stop processing the queue. Continuing would cause all child folders/canvases 
      // to instantly fail with Foreign Key violations, racking up false max attempts.
      break;
    }
  }

  return { processed, failed };
}

/**
 * Get count of pending sync items
 */
export async function getPendingCount(): Promise<number> {
  return db.syncQueue
    .where('status')
    .anyOf(['pending', 'processing'])
    .count();
}

/**
 * Get the most recent sync error
 */
export async function getLastSyncError(): Promise<string | null> {
  const failedItems = await db.syncQueue
    .where('status')
    .equals('failed')
    .sortBy('lastAttemptAt');
  
  if (failedItems.length > 0) {
    const latest = failedItems[failedItems.length - 1];
    return `[${latest.entityType}] ${latest.error || 'Unknown error'}`;
  }

  const retryingItems = await db.syncQueue
    .where('status')
    .equals('pending')
    .filter(item => item.attempts > 0 && !!item.error)
    .sortBy('lastAttemptAt');

  if (retryingItems.length > 0) {
    const latest = retryingItems[retryingItems.length - 1];
    return `[${latest.entityType}] (Retry ${latest.attempts}) ${latest.error || 'Unknown error'}`;
  }

  return null;
}

/**
 * Queue current local data for upload after a user signs in.
 * This claims pre-login local data for the authenticated user without
 * requiring components to know anything about cloud state.
 */
export async function queueLocalSnapshotForSync(userId: string): Promise<void> {
  let workspaces = await db.workspaces
    .filter(item => item.deletedAt === null || item.deletedAt === undefined)
    .toArray();
  let folders = await db.folders
    .filter(item => item.deletedAt === null || item.deletedAt === undefined)
    .toArray();
  let canvasFiles = await db.canvasFiles
    .filter(item => item.deletedAt === null || item.deletedAt === undefined)
    .toArray();
  let canvasData = await db.canvasData.toArray();

  // DE-DUPLICATION LOGIC:
  // If the user already has cloud workspaces (they are an existing user),
  // we must purge the local `isSystem` default workspace to prevent it from
  // being adopted and synced to the cloud, causing duplicates.
  const hasCloudWorkspaces = workspaces.some(ws => ws.userId === userId && ws.syncStatus === 'synced');
  
  if (hasCloudWorkspaces) {
    const systemWorkspaces = workspaces.filter(ws => ws.userId === null && ws.isSystem === true);
    for (const sysWs of systemWorkspaces) {
      // Check if the user drew anything on the local system canvases before logging in
      let hasUserDrawings = false;
      const sysCanvases = canvasFiles.filter(cf => cf.workspaceId === sysWs.id);
      for (const sc of sysCanvases) {
        const cd = canvasData.find(d => d.canvasFileId === sc.id);
        if (cd && cd.elements && cd.elements.length > 0) {
          hasUserDrawings = true;
          break;
        }
      }

      // Only purge if it's completely untouched. If they drew something, we adopt it so they don't lose work.
      if (!hasUserDrawings) {
        console.log('[SyncEngine] Purging untouched local system workspace to prevent duplication.');
        await db.workspaces.delete(sysWs.id);
        for (const sc of sysCanvases) {
          await db.canvasFiles.delete(sc.id);
          await db.canvasData.delete(sc.id);
        }
      }
    }

    // Refresh memory arrays after potential purge
    workspaces = await db.workspaces
      .filter(item => item.deletedAt === null || item.deletedAt === undefined)
      .toArray();
    folders = await db.folders
      .filter(item => item.deletedAt === null || item.deletedAt === undefined)
      .toArray();
    canvasFiles = await db.canvasFiles
      .filter(item => item.deletedAt === null || item.deletedAt === undefined)
      .toArray();
    canvasData = await db.canvasData.toArray();
  }

  for (const workspace of workspaces) {
    if (workspace.userId === null || (workspace.userId === userId && workspace.syncStatus !== 'synced')) {
      const data = { ...workspace, userId, syncStatus: 'pending' as const };
      await db.workspaces.update(workspace.id, { userId, syncStatus: 'pending' });
      await upsertQueueItem({
        entityType: 'workspace',
        entityId: workspace.id,
        action: 'update',
        data,
      });
    }
  }

  for (const folder of folders) {
    if (folder.userId === null || (folder.userId === userId && folder.syncStatus !== 'synced')) {
      const data = { ...folder, userId, syncStatus: 'pending' as const };
      await db.folders.update(folder.id, { userId, syncStatus: 'pending' });
      await upsertQueueItem({
        entityType: 'folder',
        entityId: folder.id,
        action: 'update',
        data,
      });
    }
  }

  for (const canvasFile of canvasFiles) {
    if (canvasFile.userId === null || (canvasFile.userId === userId && canvasFile.syncStatus !== 'synced')) {
      const data = { ...canvasFile, userId, syncStatus: 'pending' as const };
      await db.canvasFiles.update(canvasFile.id, { userId, syncStatus: 'pending' });
      await upsertQueueItem({
        entityType: 'canvasFile',
        entityId: canvasFile.id,
        action: 'update',
        data,
      });
    }
  }

  for (const data of canvasData) {
    if (data.userId === null) {
      // Data claiming is done via canvasFile sync naturally but queue it
      await db.canvasData.update(data.canvasFileId, { userId });
      await upsertQueueItem({
        entityType: 'canvasData',
        entityId: data.canvasFileId,
        action: 'update',
        data: { ...data, userId },
      });
    }
  }
}

export async function bootstrapCloudSync(userId: string): Promise<{ processed: number; failed: number }> {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return { processed: 0, failed: 0 };
  }

  await pullFromCloud(userId);
  await queueLocalSnapshotForSync(userId);
  return processSyncQueue(userId);
}

// ---- Individual sync handlers ----

async function syncWorkspace(item: SyncQueueItem, userId: string) {
  if (!supabase) return;
  const data = item.data as any;

  if (item.action === 'delete') {
    assertSupabaseSuccess(await supabase.from('workspaces').delete().eq('id', item.entityId));
  } else {
    assertSupabaseSuccess(await supabase.from('workspaces').upsert({
      id: item.entityId,
      user_id: userId,
      name: data.name,
      is_pinned: data.isPinned,
      color: data.color || null,
      created_at: new Date(data.createdAt ?? data.updatedAt).toISOString(),
      updated_at: new Date(data.updatedAt).toISOString(),
      deleted_at: data.deletedAt ? new Date(data.deletedAt).toISOString() : null,
    }));
  }
}

async function syncFolder(item: SyncQueueItem, userId: string) {
  if (!supabase) return;
  const data = item.data as any;

  if (item.action === 'delete') {
    assertSupabaseSuccess(await supabase.from('folders').delete().eq('id', item.entityId));
  } else {
    assertSupabaseSuccess(await supabase.from('folders').upsert({
      id: item.entityId,
      workspace_id: data.workspaceId,
      parent_id: data.parentId || null,
      user_id: userId,
      name: data.name,
      sort_order: data.order ?? 0,
      is_expanded: data.isExpanded ?? true,
      created_at: new Date(data.createdAt ?? data.updatedAt).toISOString(),
      updated_at: new Date(data.updatedAt).toISOString(),
      deleted_at: data.deletedAt ? new Date(data.deletedAt).toISOString() : null,
    }));
  }
}

async function syncCanvasFile(item: SyncQueueItem, userId: string) {
  if (!supabase) return;
  const data = item.data as any;

  if (item.action === 'delete') {
    assertSupabaseSuccess(await supabase.from('canvas_files').delete().eq('id', item.entityId));
  } else {
    assertSupabaseSuccess(await supabase.from('canvas_files').upsert({
      id: item.entityId,
      workspace_id: data.workspaceId,
      folder_id: data.folderId || null,
      user_id: userId,
      name: data.name,
      is_pinned: data.isPinned ?? false,
      sort_order: data.order ?? 0,
      created_at: new Date(data.createdAt ?? data.updatedAt).toISOString(),
      updated_at: new Date(data.updatedAt).toISOString(),
      last_opened_at: new Date(data.lastOpenedAt ?? data.updatedAt).toISOString(),
      deleted_at: data.deletedAt ? new Date(data.deletedAt).toISOString() : null,
    }));
  }
}

async function syncCanvasData(item: SyncQueueItem, userId: string) {
  if (!supabase) return;
  const queuedData = item.data as any;
  const currentData = await db.canvasData.get(item.entityId);
  const customBlocks = await db.customBlocks.where('canvasFileId').equals(item.entityId).toArray();
  const localData = currentData ?? queuedData;

  const scenePath = `${userId}/${item.entityId}.json`;

  // 1. Download current cloud data to merge (CRDT-lite)
  let mergedElements = localData.elements ?? [];
  let mergedFiles = localData.files ?? {};
  
  const downloadResult = await supabase.storage.from('canvas-scenes').download(scenePath);
  if (downloadResult.data) {
    try {
      const rawScene = JSON.parse(await downloadResult.data.text());
      const cloudElements = rawScene.elements || [];
      const cloudFiles = rawScene.files || {};
      
      // Merge elements by ID & Version
      const elMap = new Map();
      for (const el of cloudElements) elMap.set(el.id, el);
      for (const el of mergedElements) {
        const existing = elMap.get(el.id);
        if (!existing || (el.version || 0) > (existing.version || 0)) {
          elMap.set(el.id, el);
        }
      }
      mergedElements = Array.from(elMap.values());
      
      // Merge files
      mergedFiles = { ...cloudFiles, ...mergedFiles };
    } catch (e) {
      console.warn('[SyncEngine] Failed to parse cloud scene for merge', e);
    }
  }

  // Upload merged scene JSON to Supabase Storage
  const sceneData = JSON.stringify({
    elements: mergedElements,
    appState: localData.appState ?? {},
    files: mergedFiles,
    customBlocks,
  });

  assertSupabaseSuccess(await supabase.storage
    .from('canvas-scenes')
    .upload(scenePath, new Blob([sceneData], { type: 'application/json' }), {
      upsert: true,
    }));

  // Update metadata
  assertSupabaseSuccess(await supabase.from('canvas_data').upsert({
    canvas_file_id: item.entityId,
    user_id: userId,
    scene_version: localData.version ?? queuedData.version ?? 1,
    updated_at: new Date(localData.updatedAt ?? queuedData.updatedAt ?? Date.now()).toISOString(),
  }));
}

// ---- Mark entity as synced in local DB ----

async function markEntitySynced(entityType: string, entityId: string) {
  try {
    switch (entityType) {
      case 'workspace':
        await db.workspaces.update(entityId, { syncStatus: 'synced' });
        break;
      case 'folder':
        await db.folders.update(entityId, { syncStatus: 'synced' });
        break;
      case 'canvasFile':
        await db.canvasFiles.update(entityId, { syncStatus: 'synced' });
        break;
      // canvasData doesn't have its own syncStatus field
    }
  } catch {
    // Entity may have been deleted; that's fine
  }
}

// ---- Pull from Cloud (full download for login / new device) ----

export async function pullFromCloud(userId: string): Promise<void> {
  if (!supabase) return;

  // Pull workspaces
  const workspacesResult = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', userId);
  assertSupabaseSuccess(workspacesResult);
  const { data: workspaces } = workspacesResult;

  if (workspaces) {
    for (const ws of workspaces) {
      const existing = await db.workspaces.get(ws.id);
      if (!existing || new Date(ws.updated_at).getTime() > existing.updatedAt) {
        await db.workspaces.put({
          id: ws.id,
          name: ws.name,
          isPinned: ws.is_pinned,
          color: ws.color,
          createdAt: new Date(ws.created_at).getTime(),
          updatedAt: new Date(ws.updated_at).getTime(),
          syncStatus: 'synced',
          userId,
          deletedAt: ws.deleted_at ? new Date(ws.deleted_at).getTime() : null,
        });
      }
    }
  }

  // Pull folders
  const foldersResult = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId);
  assertSupabaseSuccess(foldersResult);
  const { data: folders } = foldersResult;

  if (folders) {
    for (const f of folders) {
      const existing = await db.folders.get(f.id);
      if (!existing || new Date(f.updated_at).getTime() > existing.updatedAt) {
        await db.folders.put({
          id: f.id,
          workspaceId: f.workspace_id,
          parentId: f.parent_id,
          name: f.name,
          order: f.sort_order,
          isExpanded: f.is_expanded,
          createdAt: new Date(f.created_at).getTime(),
          updatedAt: new Date(f.updated_at).getTime(),
          syncStatus: 'synced',
          userId,
          deletedAt: f.deleted_at ? new Date(f.deleted_at).getTime() : null,
        });
      }
    }
  }

  // Pull canvas files
  const canvasFilesResult = await supabase
    .from('canvas_files')
    .select('*')
    .eq('user_id', userId);
  assertSupabaseSuccess(canvasFilesResult);
  const { data: canvasFiles } = canvasFilesResult;

  if (canvasFiles) {
    for (const cf of canvasFiles) {
      const existing = await db.canvasFiles.get(cf.id);
      if (!existing || new Date(cf.updated_at).getTime() > existing.updatedAt) {
        await db.canvasFiles.put({
          id: cf.id,
          workspaceId: cf.workspace_id,
          folderId: cf.folder_id,
          name: cf.name,
          isPinned: cf.is_pinned,
          order: cf.sort_order,
          createdAt: new Date(cf.created_at).getTime(),
          updatedAt: new Date(cf.updated_at).getTime(),
          lastOpenedAt: new Date(cf.last_opened_at).getTime(),
          syncStatus: 'synced',
          userId,
          deletedAt: cf.deleted_at ? new Date(cf.deleted_at).getTime() : null,
        });
      }
    }
  }

  // Pull canvas scenes from storage
  const canvasDataResult = await supabase
    .from('canvas_data')
    .select('*')
    .eq('user_id', userId);
  assertSupabaseSuccess(canvasDataResult);
  const { data: canvasDataRows } = canvasDataResult;

  if (canvasDataRows) {
    for (const row of canvasDataRows) {
      const updatedAt = new Date(row.updated_at).getTime();
      const existing = await db.canvasData.get(row.canvas_file_id);

      if (existing && existing.updatedAt >= updatedAt) {
        continue;
      }

      const scenePath = `${userId}/${row.canvas_file_id}.json`;
      const downloadResult = await supabase.storage
        .from('canvas-scenes')
        .download(scenePath);

      if (downloadResult.error || !downloadResult.data) {
        console.warn(`[SyncEngine] Scene download failed: ${scenePath}`, downloadResult.error);
        continue;
      }

      const rawScene = JSON.parse(await downloadResult.data.text());
      const scene = canvasSceneSchema.parse(rawScene);
      
      // Element-level merge with local un-synced data
      let mergedElements = scene.elements;
      let mergedFiles = scene.files;
      
      if (existing) {
        const elMap = new Map();
        for (const el of scene.elements as any[]) elMap.set(el.id, el);
        for (const el of existing.elements as any[]) {
          const cloudEl = elMap.get(el.id);
          if (!cloudEl || (el.version || 0) > (cloudEl.version || 0)) {
            elMap.set(el.id, el);
          }
        }
        mergedElements = Array.from(elMap.values());
        mergedFiles = { ...(existing.files || {}), ...(scene.files || {}) };
      }

      const customBlocks = scene.customBlocks
        .filter((block): block is CustomBlock => {
          return !!block && typeof block === 'object' && 'id' in block;
        })
        .map(block => ({ ...block, canvasFileId: row.canvas_file_id, userId }));

      await db.transaction('rw', [db.canvasData, db.customBlocks], async () => {
        await db.canvasData.put({
          canvasFileId: row.canvas_file_id,
          elements: mergedElements,
          appState: scene.appState,
          files: mergedFiles,
          customBlocks,
          version: row.scene_version ?? 1,
          updatedAt,
          userId,
        });

        await db.customBlocks.where('canvasFileId').equals(row.canvas_file_id).delete();
        if (customBlocks.length > 0) {
          await db.customBlocks.bulkPut(customBlocks);
        }
      });
    }
  }
}
