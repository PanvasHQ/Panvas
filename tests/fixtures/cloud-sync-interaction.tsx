import React from 'react';
import { CloudSyncPanel } from '../../src/components/library/CloudSyncPanel';

let syncCalls = 0;
const state = {
  statusByProvider: { googledrive: 'synced' },
  connectionByProvider: { googledrive: { accountIdentifier: 'test-account', email: 'test@example.com' } },
  lastSyncedByProvider: { googledrive: Date.now() },
  autoSync: false,
  setAutoSync: () => undefined,
  requestConnect: async () => true,
  requestDisconnect: async () => undefined,
  triggerSync: async () => {
    syncCalls += 1;
    await new Promise(resolve => setTimeout(resolve, 100));
  },
  isSyncing: false,
  initialize: async () => undefined,
  progress: null,
  lastError: null,
  migrationWorkspaceIds: [],
  moveSyncToCurrentGoogleAccount: async () => true,
  reviewItems: [],
  workspaceRecoveryIssues: [],
  loadReviewChanges: async () => undefined,
  resolveReviewChanges: async () => true,
  resetThisDevice: async () => true,
  isResetting: false,
};

Object.assign(globalThis, {
  __syncPanelState: state,
  __syncPanelCount: () => syncCalls,
  __syncPanelUiState: { showToast: () => undefined },
});

export default function CloudSyncInteractionFixture() {
  return React.createElement(CloudSyncPanel);
}
