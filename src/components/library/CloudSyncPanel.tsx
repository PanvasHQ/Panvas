import React, { useEffect, useState } from 'react';
import { Cloud, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCloudSyncStore } from '@/stores/cloudSyncStore';
import { useUIStore } from '@/stores/uiStore';
import type { CloudSyncStatus } from '@/services/cloudsync/types';
import { isBrowserGoogleConfigured } from '@/services/cloudsync/browserGoogleAuth';
import { CLOUD_SYNC_V2_ENABLED } from '@/config/features';

/** Official Google Drive brand icon using canonical Google brand vectors and colors */
export function GoogleDriveIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA" />
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44A9.06 9.06 0 0 0 0 53h27.5z" fill="#00AC47" />
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.45z" fill="#EA4335" />
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832D" />
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684FC" />
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5z" fill="#FFBA00" />
    </svg>
  );
}

const STATUS_LABELS: Record<CloudSyncStatus, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  syncing: 'Syncing…',
  synced: 'Up to date',
  'synced-review': 'Synced - changes need review',
  'account-migration-required': 'Account action needed',
  offline: 'Offline',
  conflict: 'Sync error',
  'auth-expired': 'Reconnect Google Drive',
  'rate-limited': 'Sync error',
  error: 'Sync error',
};

function formatLastSynced(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
  if (elapsedSec < 30) return 'Just now';
  if (elapsedSec < 60) return `${elapsedSec} seconds ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin} minute${elapsedMin > 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CloudSyncPanel() {
  const {
    statusByProvider,
    connectionByProvider,
    lastSyncedByProvider,
    autoSync,
    setAutoSync,
    requestConnect,
    requestDisconnect,
    triggerSync,
    isSyncing,
    initialize,
    progress,
    lastError,
    migrationWorkspaceIds,
    moveSyncToCurrentGoogleAccount,
  } = useCloudSyncStore();

  const showToast = useUIStore(state => state.showToast);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const gdStatus = statusByProvider.googledrive;
  const gdConnection = connectionByProvider.googledrive;
  const gdConnected = Boolean(gdConnection && gdStatus !== 'disconnected');
  const hasConnectedProvider = gdConnected;
  const isElectron = typeof window !== 'undefined' && Boolean(window.panvas);
  const browserConfigured = isElectron || isBrowserGoogleConfigured();

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      const success = await requestConnect('googledrive');
      if (success) {
        showToast('Connected to Google Drive!', 'success');
      } else {
        const err = useCloudSyncStore.getState().lastError;
        showToast(err || 'Google Drive needs to be reconnected.', 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    await requestDisconnect('googledrive');
    showToast('Google Drive disconnected. Local data preserved.', 'info');
  };

  const handleSyncNow = async () => {
    showToast('Syncing with Google Drive…', 'info');
    await triggerSync();
    const { statusByProvider, lastError } = useCloudSyncStore.getState();
    const finalStatus = statusByProvider.googledrive;
    if (finalStatus === 'synced') {
      showToast('Up to date', 'success');
    } else if (finalStatus === 'synced-review') {
      showToast('Synced - changes need review. Your work was preserved.', 'info');
    } else if (finalStatus === 'account-migration-required') {
      showToast('Some workspaces are linked to another Google account.', 'info');
    } else if (finalStatus === 'auth-expired') {
      showToast('Google Drive needs to be reconnected.', 'error');
    } else if (finalStatus === 'offline') {
      showToast("You're offline. Changes will sync when you're back online.", 'error');
    } else if (finalStatus === 'rate-limited') {
      showToast("Couldn't sync. Your local data is safe.", 'error');
    } else if (finalStatus === 'error' || finalStatus === 'conflict') {
      showToast(lastError || "Couldn't sync. Your local data is safe.", 'error');
    }
  };

  const handleAccountMigration = async () => {
    const confirmed = window.confirm(
      'Move sync for these local workspaces to the currently connected Google account? Files in the previous Google account will not be deleted.',
    );
    if (!confirmed) return;
    const success = await moveSyncToCurrentGoogleAccount();
    const state = useCloudSyncStore.getState();
    if (success) showToast('Workspace sync moved to this Google account.', 'success');
    else showToast(state.lastError || "Couldn't move workspace sync. Your local data is safe.", 'error');
  };

  return (
    <section className="mx-auto w-full max-w-xl pb-6" aria-labelledby="cloud-sync-heading">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-panvas-border-default bg-panvas-bg-elevated shadow-sm">
          <Cloud size={20} className="text-panvas-accent-blue" aria-hidden="true" />
        </span>
        <div>
          <h2 id="cloud-sync-heading" className="text-lg font-semibold tracking-tight text-panvas-text-primary">
            Cloud Sync
          </h2>
          <p className="text-xs text-panvas-text-secondary">
            Sync your Panvas work across devices using your own cloud account.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Google Drive Card */}
        <div className="rounded-xl border border-panvas-border-default bg-panvas-bg-elevated p-4 transition-all hover:border-panvas-border-strong/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-panvas-border-subtle bg-panvas-bg-primary shadow-xs">
                <GoogleDriveIcon size={24} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-panvas-text-primary truncate">Google Drive</div>
                <div className="text-2xs text-panvas-text-tertiary truncate">
                  {gdConnected ? gdConnection?.email || gdConnection?.displayName || 'Connected' : 'Continue locally or connect your Google account'}
                </div>
              </div>
            </div>

            {gdConnected ? (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  disabled={isSyncing || gdStatus === 'syncing'}
                  onClick={handleSyncNow}
                  className="panvas-action-button panvas-action-button--secondary text-xs focus-ring flex items-center gap-1.5"
                  title="Sync all changes immediately"
                >
                  <RefreshCw size={13} className={isSyncing || gdStatus === 'syncing' ? 'animate-spin' : ''} />
                  <span>Sync now</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoogleDisconnect}
                  className="panvas-action-button panvas-action-button--secondary text-xs text-panvas-accent-rose hover:bg-panvas-accent-rose/10 focus-ring"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isConnecting || gdStatus === 'connecting' || !browserConfigured}
                onClick={handleGoogleConnect}
                className="panvas-action-button panvas-action-button--primary self-start sm:self-auto focus-ring"
              >
                {isConnecting || gdStatus === 'connecting' ? 'Connecting…' : 'Sign in with Google'}
              </button>
            )}
          </div>

          {gdConnected && (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-panvas-border-subtle pt-3 text-xs">
              <div className="flex items-center gap-1.5">
                {gdStatus === 'synced' ? (
                  <CheckCircle2 size={13} className="text-panvas-accent-green" />
                ) : gdStatus === 'synced-review' ? (
                  <AlertCircle size={13} className="text-panvas-accent-amber" />
                ) : gdStatus === 'syncing' ? (
                  <RefreshCw size={13} className="animate-spin text-panvas-accent-blue" />
                ) : gdStatus === 'account-migration-required' ? (
                  <AlertCircle size={13} className="text-panvas-accent-amber" />
                ) : gdStatus === 'error' || gdStatus === 'conflict' || gdStatus === 'auth-expired' || gdStatus === 'rate-limited' ? (
                  <AlertCircle size={13} className="text-panvas-accent-rose" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-panvas-text-tertiary" />
                )}
                <span className="font-medium text-panvas-text-secondary">{STATUS_LABELS[gdStatus]}</span>
              </div>
              <div className="text-2xs text-panvas-text-tertiary">
                Last synced: {formatLastSynced(lastSyncedByProvider.googledrive)}
              </div>
            </div>
          )}
          {!gdConnected && !browserConfigured && (
            <p className="mt-3 border-t border-panvas-border-subtle pt-3 text-2xs text-panvas-text-tertiary">
              Google Drive sign-in is temporarily unavailable.
            </p>
          )}
          {gdConnected && progress && (
            <div className="mt-3" aria-live="polite">
              <div className="mb-1 flex justify-between text-2xs text-panvas-text-tertiary">
                <span>{progress.message}</span>
                {progress.total > 1 && <span>{Math.round((progress.completed / progress.total) * 100)}%</span>}
              </div>
              {progress.total > 1 && <div className="h-1 overflow-hidden rounded bg-panvas-bg-secondary"><div className="h-full bg-panvas-accent-blue transition-[width]" style={{ width: `${Math.min(100, progress.completed / progress.total * 100)}%` }} /></div>}
            </div>
          )}
          {gdConnected && lastError && (gdStatus !== 'account-migration-required' || migrationWorkspaceIds.length === 0) && <p className={`mt-2 text-2xs ${gdStatus === 'synced-review' ? 'text-panvas-accent-amber' : 'text-panvas-accent-rose'}`}>{lastError}</p>}
          {gdConnected && !CLOUD_SYNC_V2_ENABLED && migrationWorkspaceIds.length > 0 && (
            <div className="mt-3 rounded-lg border border-panvas-accent-amber/40 bg-panvas-accent-amber/10 p-3">
              <p className="text-xs font-medium text-panvas-text-primary">Some workspaces are linked to another Google account.</p>
              <p className="mt-1 text-2xs text-panvas-text-secondary">
                Nothing will be uploaded until you explicitly move sync. Files in the previous Google account will remain untouched.
              </p>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleAccountMigration}
                className="panvas-action-button panvas-action-button--secondary mt-3 text-xs focus-ring"
              >
                Move sync to this Google account
              </button>
            </div>
          )}
        </div>



        {/* OneDrive Card (Coming Later) */}
        <div className="rounded-xl border border-panvas-border-default/70 bg-panvas-bg-elevated/60 p-4 opacity-75">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-panvas-border-subtle bg-panvas-bg-primary text-panvas-text-tertiary">
                <Cloud size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-panvas-text-primary truncate">OneDrive</div>
                <div className="text-2xs text-panvas-text-tertiary truncate">Connect your Microsoft account</div>
              </div>
            </div>
            <span className="self-start sm:self-auto rounded-full bg-panvas-bg-secondary px-3 py-1 text-2xs font-medium text-panvas-text-tertiary border border-panvas-border-subtle">
              Coming later
            </span>
          </div>
        </div>
      </div>

      {/* Security & Settings card */}
      <div className="mt-6 rounded-xl border border-panvas-border-subtle bg-panvas-bg-elevated/60 p-4 text-xs text-panvas-text-secondary">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-panvas-accent-green" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium text-panvas-text-primary">
              Cloud sync is optional. Panvas works fully offline without an account.
            </p>
            <p className="text-panvas-text-tertiary text-2xs leading-relaxed">
              Storage mode: Local + Google Drive. Browser authorization uses Google Identity Services; Electron uses desktop OAuth PKCE.
              Panvas never receives or stores your password.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-panvas-border-subtle/80 pt-3">
          <label className={`flex items-center justify-between gap-3 text-xs ${hasConnectedProvider ? 'text-panvas-text-secondary' : 'opacity-60 cursor-not-allowed'}`}>
            <div>
              <span className="font-medium">Auto Sync</span>
              <span className="block text-2xs text-panvas-text-tertiary">
                Automatically sync local edits when connected to your Google Drive
              </span>
            </div>
            <input
              type="checkbox"
              disabled={!hasConnectedProvider}
              checked={autoSync && hasConnectedProvider}
              onChange={event => setAutoSync(event.target.checked)}
              className="h-4 w-4 rounded accent-panvas-accent-blue disabled:cursor-not-allowed"
              aria-label="Auto Sync"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
