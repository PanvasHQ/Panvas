// ============================================
// Panvas — Type Definitions: Sync
// ============================================

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'pending';

export type SyncAction = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id?: number; // auto-increment
  entityType: 'workspace' | 'folder' | 'canvasFile' | 'canvasData';
  entityId: string;
  action: SyncAction;
  data: unknown;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  createdAt: number;
  lastAttemptAt?: number;
  error?: string;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  pendingChanges: number;
  isOnline: boolean;
}
