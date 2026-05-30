// ============================================
// Panvas — Sync Indicator
// Shows the current sync status in the UI
// ============================================

import React from 'react';
import { useSyncStore } from '@/stores/syncStore';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/auth/AuthService';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';

export function SyncIndicator() {
  const { status, isOnline, pendingChanges, forceSync, lastError } = useSyncStore();
  const { isAuthenticated } = useAuthStore();

  if (!authService.isConfigured || !isAuthenticated) {
    return null; // Don't show sync status if not logged in or configured
  }

  if (!isOnline || status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-tertiary">
        <CloudOff size={13} />
        <span className="text-[10px] font-medium tracking-wide">Offline</span>
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-secondary">
        <RefreshCw size={12} className="animate-spin text-panvas-accent-blue" />
        <span className="text-[10px] font-medium tracking-wide">Syncing...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button 
        onClick={forceSync}
        className="flex items-center gap-1.5 px-2 py-1 text-panvas-accent-rose hover:text-panvas-text-primary transition-colors"
        title={`Sync failed. Click to retry.\nError: ${lastError || 'Unknown'}`}
      >
        <AlertCircle size={13} />
        <span className="text-[10px] font-medium tracking-wide">Error</span>
      </button>
    );
  }

  if (status === 'pending' || pendingChanges > 0) {
    return (
      <button 
        onClick={forceSync}
        className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-tertiary hover:text-panvas-text-primary transition-colors"
        title={`${pendingChanges} pending changes. Click to sync now.`}
      >
        <Cloud size={13} className="text-panvas-accent-amber" />
        <span className="text-[10px] font-medium tracking-wide">Pending</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-tertiary">
      <Cloud size={13} className="text-panvas-accent-emerald" />
      <span className="text-[10px] font-medium tracking-wide">Synced</span>
    </div>
  );
}
