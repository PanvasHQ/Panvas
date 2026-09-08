// ============================================
// Panvas — Sync Scheduler
// Manages the background interval and online/offline states
// ============================================

import { processSyncQueue, getPendingCount, getLastSyncError } from './SyncEngine';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { CLOUD_SYNC_ENABLED } from '@/config/features';

const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

export class SyncScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  start() {
    if (!CLOUD_SYNC_ENABLED) return;
    if (this.timer) return;

    // Listen to network events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Initial state
    useSyncStore.getState().setOnline(navigator.onLine);

    // Start interval
    this.timer = setInterval(() => {
      this.triggerSync();
    }, SYNC_INTERVAL_MS);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  async triggerSync() {
    if (!CLOUD_SYNC_ENABLED) return;
    if (this.isProcessing) return;
    if (!navigator.onLine) return;

    const user = useAuthStore.getState().user;
    if (!user) return; // Must be logged in

    const syncStore = useSyncStore.getState();

    try {
      this.isProcessing = true;
      
      const pendingCount = await getPendingCount();
      if (pendingCount === 0) {
        this.isProcessing = false;
        return; // Nothing to sync
      }

      syncStore.setStatus('syncing');

      const { failed } = await processSyncQueue(user.id);

      if (failed > 0) {
        syncStore.setStatus('error');
        syncStore.setLastError(await getLastSyncError());
      } else {
        syncStore.setStatus('synced');
        syncStore.setLastError(null);
        syncStore.setLastSyncedAt(Date.now());
      }
    } catch (err) {
      console.error('[SyncScheduler] Sync failed:', err);
      syncStore.setStatus('error');
      syncStore.setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      this.isProcessing = false;
      // Update pending count safely
      try {
        syncStore.setPendingChanges(await getPendingCount());
      } catch (e) {
        // Ignore quota/db errors here
      }
    }
  }

  private handleOnline = () => {
    useSyncStore.getState().setOnline(true);
    // Trigger immediately on reconnect
    this.triggerSync();
  };

  private handleOffline = () => {
    useSyncStore.getState().setOnline(false);
    useSyncStore.getState().setStatus('offline');
  };
}

export const syncScheduler = new SyncScheduler();
