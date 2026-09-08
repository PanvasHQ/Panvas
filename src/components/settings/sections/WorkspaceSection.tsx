// ============================================
// Panvas — Workspace Section
// ============================================

import React, { useEffect, useState } from 'react';
import { db } from '@/database/schema';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { HardDrive, Database, LayoutGrid, Cloud, History } from 'lucide-react';
import { StorageService, type StorageMetrics } from '@/services/storage/StorageService';
import { CLOUD_SYNC_ENABLED } from '@/config/features';

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
  const { status, lastSyncedAt } = useSyncStore();
  const [stats, setStats] = useState({
    workspaces: 0,
    canvases: 0,
  });
  const [storage, setStorage] = useState<StorageMetrics | null>(null);

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

  const syncStatusMap: Record<string, string> = {
    idle: 'Idle',
    syncing: 'Syncing...',
    synced: 'Synced',
    error: 'Error',
    offline: 'Offline',
    pending: 'Pending'
  };

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
              <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${CLOUD_SYNC_ENABLED && user ? 'bg-panvas-accent-emerald/10 text-panvas-accent-emerald' : 'bg-panvas-bg-tertiary text-panvas-text-muted'}`}>
                {CLOUD_SYNC_ENABLED && user ? 'Enabled' : CLOUD_SYNC_ENABLED ? 'Not connected' : 'Disabled'}
              </span>
            </div>
            {CLOUD_SYNC_ENABLED && user && (
              <div className="flex items-center justify-between p-4 border-b border-panvas-border-subtle">
                <div className="flex items-center gap-3">
                  <Cloud size={16} className="text-panvas-text-secondary" />
                  <span className="text-sm text-panvas-text-secondary">Sync Status</span>
                </div>
                <span className="text-sm font-medium text-panvas-text-primary capitalize">{syncStatusMap[status] || status}</span>
              </div>
            )}
            {CLOUD_SYNC_ENABLED && user && lastSyncedAt && (
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
