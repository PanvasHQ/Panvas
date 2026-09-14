// ============================================
// Panvas — Workspace Section
// ============================================

import React, { useEffect, useState } from 'react';
import { db } from '@/database/schema';
import { useAuthStore } from '@/stores/authStore';
import { useCloudSyncStore } from '@/stores/cloudSyncStore';
import { HardDrive, Database, LayoutGrid, Cloud, History, FolderOpen } from 'lucide-react';
import { StorageService, type StorageMetrics } from '@/services/storage/StorageService';
import { CLOUD_SYNC_ENABLED } from '@/config/features';
import { getCloudSyncPresentation } from '@/services/cloudsync/presentation';

function timeAgo(timestamp: number) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diffDays = Math.round((timestamp - Date.now()) / (1000 * 60 * 60 * 24));
  if (Math.abs(diffDays) > 0) return rtf.format(diffDays, 'day');
  
  const diffHours = Math.round((timestamp - Date.now()) / (1000 * 60 * 60));
  if (Math.abs(diffHours) > 0) return rtf.format(diffHours, 'hour');
  
  const diffMinutes = Math.round((timestamp - Date.now()) / (1000 * 60));
  return rtf.format(diffMinutes, 'minute');
}

export function WorkspaceSection() {
  const { user } = useAuthStore();
  const { statusByProvider, connectionByProvider, lastSyncedByProvider, lastError, reviewItems, workspaceRecoveryIssues } = useCloudSyncStore();
  const recoveryOnly = statusByProvider.googledrive === 'synced-review' && workspaceRecoveryIssues.length > 0 && reviewItems.length === 0;
  const presentation = getCloudSyncPresentation({ enabled: CLOUD_SYNC_ENABLED, status: statusByProvider.googledrive, connection: connectionByProvider.googledrive, lastError, recoveryOnly });
  const lastSyncedAt = lastSyncedByProvider.googledrive;
  const [stats, setStats] = useState({
    workspaces: 0,
    canvases: 0,
  });
  const [storage, setStorage] = useState<StorageMetrics | null>(null);
  const [storageRoot, setStorageRoot] = useState<{ path: string; configuredPath: string | null; isDefault: boolean; available: boolean } | null>(null);
  const [storageRootError, setStorageRootError] = useState<string | null>(null);
  const [isChoosingStorageRoot, setIsChoosingStorageRoot] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const workspaceCount = await db.workspaces.count();
        const canvasCount = await db.canvasFiles.count();
        const metrics = await StorageService.getMetrics();
        
        setStats({
          workspaces: workspaceCount,
          canvases: canvasCount,
        });
        setStorage(metrics);
      } catch (err) {
        console.error('Failed to load workspace stats', err);
      }
    }
    
    loadStats();
  }, [user]);

  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.panvas?.storage : undefined;
    if (!api) return;
    void api.getRoot()
      .then(setStorageRoot)
      .catch(() => setStorageRootError('Storage location could not be read.'));
  }, []);

  async function chooseStorageRoot() {
    const api = typeof window !== 'undefined' ? window.panvas?.storage : undefined;
    if (!api || isChoosingStorageRoot) return;
    setIsChoosingStorageRoot(true);
    setStorageRootError(null);
    try {
      // The native handler validates and persists only after the user picks a
      // writable directory. A canceled dialog returns null and leaves state
      // unchanged.
      const result = await api.chooseRoot();
      if (result) setStorageRoot(result);
    } catch {
      setStorageRootError('The selected folder is unavailable or not writable.');
    } finally {
      setIsChoosingStorageRoot(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-semibold text-panvas-text-primary mb-1">Workspace & Storage</h2>
        <p className="text-sm text-panvas-text-secondary">View your local data usage and cloud sync status.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="panvas-surface flex flex-col gap-3 p-5">
          <div className="w-10 h-10 rounded-full bg-panvas-bg-tertiary flex items-center justify-center text-panvas-text-secondary">
            <LayoutGrid size={18} />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-panvas-text-primary">{stats.workspaces}</h3>
            <p className="text-sm text-panvas-text-secondary">Total Workspaces</p>
          </div>
        </div>

        <div className="panvas-surface flex flex-col gap-3 p-5">
          <div className="w-10 h-10 rounded-full bg-panvas-bg-tertiary flex items-center justify-center text-panvas-text-secondary">
            <Database size={18} />
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-panvas-text-primary">{stats.canvases}</h3>
            <p className="text-sm text-panvas-text-secondary">Total Canvases</p>
          </div>
        </div>
      </div>

      {storageRoot && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-panvas-text-muted">Panvas Storage Location</label>
          <div className="panvas-surface flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-panvas-text-secondary">New workspaces and desktop assets are stored here.</p>
                <p className="mt-1 break-all text-sm font-medium text-panvas-text-primary">{storageRoot.path}</p>
                {!storageRoot.available && <p className="mt-1 text-xs text-amber-600">The previously selected folder is unavailable; existing data was not moved.</p>}
              </div>
              <button
                type="button"
                onClick={() => void chooseStorageRoot()}
                disabled={isChoosingStorageRoot}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-panvas-border-subtle px-3 py-2 text-sm text-panvas-text-primary hover:bg-panvas-bg-tertiary disabled:opacity-50"
              >
                <FolderOpen size={15} />
                {isChoosingStorageRoot ? 'Choosing…' : 'Change folder'}
              </button>
            </div>
            {storageRootError && <p role="alert" className="text-xs text-red-600">{storageRootError}</p>}
          </div>
        </div>
      )}

      <div className="grid gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-panvas-text-muted">Storage Details</label>
          <div className="panvas-surface overflow-hidden">
            
            {/* Storage Usage Row */}
            <div className="flex flex-col p-4 border-b border-panvas-border-subtle gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <HardDrive size={16} className="text-panvas-text-secondary" />
                  <span className="text-sm text-panvas-text-secondary">Storage Used</span>
                </div>
                {storage ? (
                  <span className="text-sm font-medium text-panvas-text-primary">
                    {StorageService.formatBytes(storage.usedBytes)} 
                    {storage.storageLimitBytes ? ` / ${StorageService.formatBytes(storage.storageLimitBytes, 0)}` : ''}
                  </span>
                ) : (
                  <span className="text-sm text-panvas-text-muted animate-pulse">Calculating...</span>
                )}
              </div>

              {storage?.storageLimitBytes && storage.percentageUsed !== null ? (
                <>
                  <div className="w-full bg-panvas-bg-tertiary h-1.5 rounded-full overflow-hidden mt-1">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        storage.status === 'healthy' ? 'bg-panvas-accent-emerald' : 
                        storage.status === 'warning' ? 'bg-panvas-accent-yellow' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(storage.percentageUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-panvas-text-muted capitalize">Status: {storage.status}</span>
                    <span className="text-xs text-panvas-text-muted">{storage.percentageUsed.toFixed(1)}% Used {storage.plan ? `(${storage.plan} Plan)` : ''}</span>
                  </div>
                </>
              ) : storage ? (
                <>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm text-panvas-text-secondary">Storage Backend</span>
                    <span className="text-sm text-panvas-text-primary">Local workspace storage</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-panvas-text-secondary">Storage Limit</span>
                    <span className="text-sm text-panvas-text-primary">Not Configured</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-panvas-text-secondary">Status</span>
                    <span className="text-sm text-panvas-accent-emerald capitalize">Healthy</span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center justify-between p-4 border-b border-panvas-border-subtle">
              <div className="flex items-center gap-3">
                <Cloud size={16} className="text-panvas-text-secondary" />
                <span className="text-sm text-panvas-text-secondary">Cloud Sync</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${presentation.connected ? 'bg-panvas-accent-emerald/10 text-panvas-accent-emerald' : 'bg-panvas-bg-tertiary text-panvas-text-muted'}`}>
                {presentation.settingsLabel}
              </span>
            </div>
            {presentation.connected && (
              <div className="flex items-center justify-between p-4 border-b border-panvas-border-subtle">
                <div className="flex items-center gap-3">
                  <Cloud size={16} className="text-panvas-text-secondary" />
                  <span className="text-sm text-panvas-text-secondary">Sync Status</span>
                </div>
                <span className="text-sm font-medium text-panvas-text-primary">{presentation.settingsLabel}</span>
              </div>
            )}
            {presentation.showLastSynced && lastSyncedAt && (
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <History size={16} className="text-panvas-text-secondary" />
                  <span className="text-sm text-panvas-text-secondary">Last Synced</span>
                </div>
                <span className="text-sm font-medium text-panvas-text-primary">
                  {timeAgo(lastSyncedAt)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
