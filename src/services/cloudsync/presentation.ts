import type { CloudSyncStatus, ProviderConnectionInfo, WorkspaceCloudStatus } from './types';

export type CloudSyncVisualKind = 'disconnected' | 'offline' | 'busy' | 'attention' | 'ready';

export interface CloudSyncPresentation {
  kind: CloudSyncVisualKind;
  indicatorLabel: string;
  settingsLabel: string;
  connectivityLabel: string;
  title: string;
  connected: boolean;
  showLastSynced: boolean;
}

export function mergeWorkspaceCloudStatuses(
  current: Readonly<Record<string, WorkspaceCloudStatus>>,
  updates: Iterable<readonly [string, WorkspaceCloudStatus]>,
): Record<string, WorkspaceCloudStatus> {
  return { ...current, ...Object.fromEntries(updates) };
}

export function getCloudSyncPresentation(input: {
  enabled: boolean;
  status: CloudSyncStatus;
  connection: ProviderConnectionInfo | null;
  lastError?: string | null;
  recoveryOnly?: boolean;
}): CloudSyncPresentation {
  if (!input.enabled) {
    return { kind: 'disconnected', indicatorLabel: 'Cloud Sync', settingsLabel: 'Disabled', connectivityLabel: 'Local only', title: 'Cloud Sync is unavailable in this build. Your work remains local.', connected: false, showLastSynced: false };
  }
  if (!input.connection || input.status === 'disconnected') {
    return { kind: 'disconnected', indicatorLabel: 'Cloud Sync', settingsLabel: 'Not connected', connectivityLabel: 'Local only', title: 'Cloud Sync is disconnected. Open Cloud Sync to connect Google Drive.', connected: false, showLastSynced: false };
  }
  if (input.status === 'offline') {
    return { kind: 'offline', indicatorLabel: 'Offline', settingsLabel: 'Offline', connectivityLabel: 'Offline · saved locally', title: "You're offline. Changes are saved locally and will sync when you're back online.", connected: true, showLastSynced: true };
  }
  if (input.status === 'connecting' || input.status === 'syncing') {
    const connecting = input.status === 'connecting';
    return { kind: 'busy', indicatorLabel: connecting ? 'Connecting…' : 'Syncing…', settingsLabel: connecting ? 'Connecting…' : 'Syncing…', connectivityLabel: connecting ? 'Cloud connecting' : 'Cloud syncing', title: 'Google Drive connection is being updated.', connected: true, showLastSynced: true };
  }
  if (input.status === 'synced-review' && input.recoveryOnly) {
    return {
      kind: 'ready',
      indicatorLabel: 'Synced',
      settingsLabel: 'Synced',
      connectivityLabel: 'Cloud synced',
      title: 'Google Drive is synced. Some older data was preserved for recovery.',
      connected: true,
      showLastSynced: true,
    };
  }
  if (['account-migration-required', 'synced-review', 'error', 'conflict', 'auth-expired', 'rate-limited'].includes(input.status)) {
    const label = input.status === 'account-migration-required' ? 'Account action' : input.status === 'synced-review' ? 'Review changes' : input.status === 'auth-expired' ? 'Reconnect' : 'Sync issue';
    return { kind: 'attention', indicatorLabel: label, settingsLabel: label, connectivityLabel: label, title: input.lastError || 'Open Cloud Sync to review this connection.', connected: true, showLastSynced: true };
  }
  const synced = input.status === 'synced';
  return { kind: 'ready', indicatorLabel: synced ? 'Synced' : 'Connected', settingsLabel: synced ? 'Synced' : 'Connected', connectivityLabel: synced ? 'Cloud synced' : 'Cloud connected', title: `Google Drive: ${synced ? 'Synced' : 'Connected'}. Open Cloud Sync to manage connection.`, connected: true, showLastSynced: true };
}
