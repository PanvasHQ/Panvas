// ============================================
// Panvas — Sync Store (Zustand)
// Tracks UI state for sync indicator
// ============================================
// OSS NOTE: Legacy implementation retained for backward compatibility; review after v0.1.

import { create } from 'zustand';
import type { SyncState } from '@/types/sync';
import { syncScheduler } from '@/services/sync/SyncScheduler';

interface SyncStore extends SyncState {
  lastError: string | null;
  setStatus: (status: SyncState['status']) => void;
  setOnline: (isOnline: boolean) => void;
  setLastSyncedAt: (time: number) => void;
  setPendingChanges: (count: number) => void;
  setLastError: (error: string | null) => void;
  incrementPending: () => void;
  forceSync: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  pendingChanges: 0,
  isOnline: navigator.onLine,
  lastError: null,

  reset: () => {
    set({
      status: 'idle',
      lastSyncedAt: null,
      pendingChanges: 0,
      lastError: null,
    });
  },

  setStatus: (status) => set({ status }),
  setOnline: (isOnline) => set({ isOnline, status: isOnline ? 'idle' : 'offline' }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
  setLastError: (lastError) => set({ lastError }),
  incrementPending: () => {
    set((state) => ({ pendingChanges: state.pendingChanges + 1, status: 'pending' }));
  },
  forceSync: () => {
    syncScheduler.triggerSync();
  },
}));
