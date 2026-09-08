// ============================================
// Panvas — Sync Indicator
// Shows current cloud sync state in TopBar
// ============================================

import React from 'react';
import { useCloudSyncStore } from '@/stores/cloudSyncStore';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';

export function SyncIndicator() {
  const { statusByProvider, connectionByProvider, triggerSync, lastError } = useCloudSyncStore();

  const gdConnection = connectionByProvider.googledrive;
  const gdStatus = statusByProvider.googledrive;

  // When no provider is connected: Local only
  if (!gdConnection || gdStatus === 'disconnected') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-tertiary" title="Working locally (no cloud account connected)">
        <CloudOff size={13} />
        <span className="text-[10px] font-medium tracking-wide">Local only</span>
      </div>
    );
  }

  if (gdStatus === 'offline' || !navigator.onLine) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-tertiary" title="Offline: changes are saved locally and will sync when back online">
        <CloudOff size={13} />
        <span className="text-[10px] font-medium tracking-wide">Offline</span>
      </div>
    );
  }

  if (gdStatus === 'syncing' || gdStatus === 'connecting') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-secondary" title="Syncing changes with Google Drive…">
        <RefreshCw size={12} className="animate-spin text-panvas-accent-blue" />
        <span className="text-[10px] font-medium tracking-wide">{gdStatus === 'connecting' ? 'Connecting…' : 'Syncing…'}</span>
      </div>
    );
  }

  if (gdStatus === 'account-migration-required') {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-panvas-accent-amber"
        title={lastError || 'Some workspaces are linked to another Google account.'}
      >
        <AlertCircle size={13} />
        <span className="text-[10px] font-medium tracking-wide">Account action needed</span>
      </div>
    );
  }

  if (gdStatus === 'synced-review') {
    return (
      <button
        type="button"
        onClick={() => void triggerSync()}
        className="flex items-center gap-1.5 px-2 py-1 text-panvas-accent-amber hover:text-panvas-text-primary transition-colors focus-ring rounded"
        title="Synced - changes need review. Your work was preserved."
      >
        <AlertCircle size={13} />
        <span className="text-[10px] font-medium tracking-wide">Review changes</span>
      </button>
    );
  }

  if (gdStatus === 'error' || gdStatus === 'conflict' || gdStatus === 'auth-expired' || gdStatus === 'rate-limited') {
    return (
      <button
        type="button"
        onClick={() => void triggerSync()}
        className="flex items-center gap-1.5 px-2 py-1 text-panvas-accent-rose hover:text-panvas-text-primary transition-colors focus-ring rounded"
        title={`Sync error: ${lastError || 'Click to retry'}`}
      >
        <AlertCircle size={13} />
        <span className="text-[10px] font-medium tracking-wide">{gdStatus === 'auth-expired' ? 'Auth expired' : gdStatus === 'rate-limited' ? 'Retry later' : 'Sync error'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void triggerSync()}
      className="flex items-center gap-1.5 px-2 py-1 text-panvas-text-secondary hover:text-panvas-text-primary transition-colors focus-ring rounded"
      title={`Google Drive: ${gdStatus === 'connected' ? 'Connected' : 'Synced'} (${gdConnection.email || gdConnection.displayName || 'Connected'}). Click to sync now.`}
    >
      <Cloud size={13} className="text-panvas-accent-green" />
      <span className="text-[10px] font-medium tracking-wide">{gdStatus === 'connected' ? 'Connected' : 'Synced'}</span>
    </button>
  );
}
